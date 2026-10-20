"use client";

import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export interface CategoryValue {
  name: string;
  weight?: number;
}

const SUGGESTIONS = [
  "Artificial Intelligence",
  "Data Science",
  "Morocco",
  "Football",
  "Anime",
  "Video Games",
  "Medicine",
  "History",
  "Movies",
  "Music",
  "Mathematics",
  "Space",
];

/**
 * Free-text custom category editor (spec §4) — the core innovation.
 * Users can type ANY topic, combine up to 5, and optionally set weights.
 * Suggestions are only shortcuts; the input is never restricted to them.
 */
export function CategoryInput({
  value,
  onChange,
  showWeights,
}: {
  value: CategoryValue[];
  onChange: (v: CategoryValue[]) => void;
  showWeights: boolean;
}) {
  const { t } = useLanguage();

  const update = (i: number, patch: Partial<CategoryValue>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = (name = "") => value.length < 5 && onChange([...value, { name }]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-2xl border border-violet-400/30 bg-violet-500/10 py-1.5 ps-2 pe-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" />
            <input
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={t.categoryPlaceholder}
              aria-label={`Category ${i + 1}`}
              className="w-44 bg-transparent text-sm font-semibold text-violet-100 placeholder:font-normal placeholder:text-slate-500 focus:outline-none"
            />
            {showWeights && (
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight ?? ""}
                onChange={(e) => update(i, { weight: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="%"
                aria-label={t.weight}
                title={t.weight}
                className="w-14 rounded-lg border border-white/15 bg-black/30 px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`${t.remove} ${c.name}`}
              className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < 5 && (
          <Button type="button" variant="outline" size="sm" onClick={() => add()} className="h-10 rounded-2xl">
            <Plus className="h-4 w-4" /> {t.addCategory}
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">{t.categoriesHint}</p>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.filter((s) => !value.some((c) => c.name.toLowerCase() === s.toLowerCase())).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => add(s)}
            className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition hover:border-violet-400/50 hover:text-violet-200"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
