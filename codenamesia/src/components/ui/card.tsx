import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-panel rounded-3xl", className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "red" | "blue" | "neutral" | "violet" }) {
  const tones = {
    red: "bg-rose-500/15 text-rose-200 border-rose-400/35",
    blue: "bg-sky-500/15 text-sky-200 border-sky-400/35",
    neutral: "bg-white/10 text-slate-200 border-white/15",
    violet: "bg-violet-500/15 text-violet-200 border-violet-400/35",
  };
  const { tone = "neutral", ...rest } = props as HTMLAttributes<HTMLSpanElement> & { tone: "red" | "blue" | "neutral" | "violet" };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...rest}
    />
  );
}
