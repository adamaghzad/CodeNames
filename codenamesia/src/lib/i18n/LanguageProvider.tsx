"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, isRtl, type Dict } from "./dictionary";
import type { Language } from "@/lib/game-engine/types";

interface LangCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: Dict;
  dir: "ltr" | "rtl";
}

const Ctx = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: dictionaries.en, dir: "ltr" });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("codenamesia-lang") as Language | null;
    if (saved && dictionaries[saved]) setLangState(saved);
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("codenamesia-lang", l);
  };

  const value = useMemo<LangCtx>(
    () => ({ lang, setLang, t: dictionaries[lang], dir: isRtl(lang) ? "rtl" : "ltr" }),
    [lang]
  );

  return (
    <Ctx.Provider value={value}>
      <div dir={value.dir} lang={lang}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export const useLanguage = () => useContext(Ctx);
