"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Fingerprint, Home, LayoutDashboard, Users, LogIn, PlusCircle, Settings, User } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Language } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { t, lang, setLang } = useLanguage();
  const pathname = usePathname();

  const links = [
    { href: "/", label: t.home, icon: Home },
    { href: "/create-game", label: t.createGame, icon: PlusCircle },
    { href: "/multiplayer", label: t.multiplayer, icon: Users },
    { href: "/dashboard", label: t.dashboard, icon: LayoutDashboard },
    { href: "/profile", label: t.profile, icon: User },
    { href: "/settings", label: t.settings, icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
      <div className="glass-panel mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 rounded-full py-1.5 pe-2 ps-3 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)]">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative grid h-10 w-10 place-items-center">
            <span
              className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_210deg,#ff4658,#8b5cf6,#22b8f0,#ff4658)] opacity-90 transition-transform duration-700 group-hover:rotate-[25deg]"
              aria-hidden
            />
            <span className="absolute inset-[2px] rounded-[14px] bg-[#0a0f22]" aria-hidden />
            <Fingerprint className="relative h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Codenames<span className="gradient-text">IA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition",
                  active ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15"
                    aria-hidden
                  />
                )}
                <Icon className="relative h-4 w-4" aria-hidden />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="h-9 cursor-pointer rounded-full border border-white/15 bg-white/5 px-2 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="ar">العربية</option>
          </select>
          <Link
            href="/login"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-sky-500 px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(139,92,246,0.8)] transition hover:brightness-110 active:scale-95 sm:inline-flex"
          >
            <LogIn className="h-4 w-4" aria-hidden /> {t.login}
          </Link>
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="glass-panel mx-auto mt-2 flex w-full max-w-7xl items-center justify-around rounded-full px-2 py-1.5 md:hidden"
        aria-label="Mobile"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition",
                active ? "bg-white/10 text-white" : "text-slate-400"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
