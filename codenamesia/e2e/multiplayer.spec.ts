import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * REAL two-browser multiplayer test (spec §14):
 * Context A (host) creates a room with AI spymasters; Context B joins via
 * the room code; roster/teams synchronize live; host starts; BOTH browsers
 * render the same 25 words; a guess in one browser appears in the other.
 */

async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto("/multiplayer");
  await page.getByLabel(/your display name/i).fill(name);
  await page.getByLabel(/AI spymaster \(Red\)/i).check();
  await page.getByLabel(/AI spymaster \(Blue\)/i).check();
  await page.getByRole("button", { name: /create multiplayer room/i }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 30_000 });
  const code = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByText("Lobby")).toBeVisible();
  return code;
}

async function joinRoom(page: Page, code: string, name: string) {
  await page.goto(`/room/${code}`);
  const nameInput = page.getByLabel(/your display name/i);
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill(name);
    await page.getByRole("button", { name: /^join$/i }).click();
  }
  await expect(page.getByText("Lobby")).toBeVisible({ timeout: 30_000 });
}

test("two browsers play the same real-time game", async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext();
  const ctxB: BrowserContext = await browser.newContext();
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();

  const code = await createRoom(host, "HostReda");
  await joinRoom(guest, code, "GuestLina");

  // Roster sync: host sees the guest appear WITHOUT reloading.
  await expect(host.getByText("GuestLina").first()).toBeVisible({ timeout: 15_000 });

  // Guest joins Blue (host auto-joined Red); host sees the change live.
  await guest.getByRole("button", { name: /join team/i }).nth(1).click();
  await expect(host.getByText(/Both teams are set/i)).toBeVisible({ timeout: 15_000 });

  // Only host can start — guest has no enabled Start button.
  await expect(guest.getByRole("button", { name: /start game/i })).toHaveCount(0);

  await host.getByRole("button", { name: /start game/i }).click();

  // Both browsers land on the same game with the same 25 words.
  await host.waitForURL(/\/game\//, { timeout: 60_000 });
  await guest.waitForURL(/\/game\//, { timeout: 60_000 });
  expect(new URL(host.url()).pathname).toBe(new URL(guest.url()).pathname);

  const words = async (p: Page) =>
    p.locator('[role="grid"] button').evaluateAll((btns) => btns.map((b) => b.getAttribute("aria-label")));
  await expect(host.locator('[role="grid"] button')).toHaveCount(25, { timeout: 30_000 });
  await expect(guest.locator('[role="grid"] button')).toHaveCount(25, { timeout: 30_000 });
  expect(await words(host)).toEqual(await words(guest));

  // AI spymaster produces a clue both sides can see.
  await expect(host.getByText(/current clue/i)).toBeVisible({ timeout: 45_000 });
  await expect(guest.getByText(/current clue/i)).toBeVisible({ timeout: 45_000 });

  // Current team's operative (host=Red starts or guest=Blue — whoever can
  // click) reveals a card; the OTHER browser must show the reveal live.
  const tryGuess = async (p: Page): Promise<boolean> => {
    const card = p.locator('[role="grid"] button:not([disabled])').first();
    if ((await card.count()) === 0) return false;
    await card.click();
    const confirm = p.getByRole("button", { name: /^reveal$/i });
    if (!(await confirm.isVisible().catch(() => false))) return false;
    await confirm.click();
    return true;
  };
  const guessed = (await tryGuess(host)) || (await tryGuess(guest));
  expect(guessed).toBe(true);

  const revealedCount = async (p: Page) =>
    p.locator('[role="grid"] button').evaluateAll(
      (btns) => btns.filter((b) => /\((red|blue|neutral|assassin)\)/.test(b.getAttribute("aria-label") ?? "")).length
    );
  await expect.poll(() => revealedCount(host), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => revealedCount(guest), { timeout: 20_000 }).toBeGreaterThan(0);
  expect(await revealedCount(host)).toBe(await revealedCount(guest));

  await ctxA.close();
  await ctxB.close();
});
