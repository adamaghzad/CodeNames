import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-violet-500 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-950/50 ring-1 ring-white/20 hover:shadow-indigo-900/60 hover:brightness-110",
        red: "bg-gradient-to-br from-rose-400 via-rose-600 to-red-700 text-white shadow-lg shadow-rose-950/50 ring-1 ring-white/20 hover:brightness-110",
        blue: "bg-gradient-to-br from-sky-400 via-sky-600 to-blue-700 text-white shadow-lg shadow-sky-950/50 ring-1 ring-white/20 hover:brightness-110",
        outline: "border border-white/15 bg-white/[0.06] text-slate-100 backdrop-blur hover:bg-white/[0.11] hover:border-white/25",
        ghost: "text-slate-300 hover:bg-white/10 hover:text-white",
      },
      size: {
        sm: "h-9 px-3.5 text-xs",
        default: "h-11 px-5",
        lg: "h-13 px-8 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
