import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { Navbar } from "@/components/layout/Navbar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CodenamesIA — AI-powered word game",
  description:
    "Enter ANY categories and Groq AI (openai/gpt-oss-20b) generates a complete Codenames-style game: 25 words, spymasters, operatives, AI players and multiplayer rooms.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}>
        <LanguageProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-[88rem] px-4 pb-20 sm:px-6">{children}</main>
          <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
            CodenamesIA · AI boards by Groq <span className="font-mono">openai/gpt-oss-20b</span> · Server-authoritative
            game engine · Original fan-made design — not affiliated with CGE / Codenames.
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
