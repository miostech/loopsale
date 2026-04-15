import * as React from "react";

const variants = {
  primary:
    "bg-[linear-gradient(120deg,#8b5cf6_0%,var(--loop-primary)_55%,#5b21b6_100%)] text-white shadow-sm hover:brightness-110 active:brightness-95 transition-[filter,box-shadow] duration-200",
  cta:
    "bg-[linear-gradient(115deg,var(--loop-cta)_0%,var(--loop-accent-mid)_48%,var(--loop-primary)_100%)] text-white shadow-md shadow-[color-mix(in_srgb,var(--loop-cta)_35%,transparent)] hover:brightness-110 active:brightness-95 transition-[filter,box-shadow] duration-200",
  secondary:
    "bg-[var(--loop-bg-alt)] text-[var(--loop-text)] border border-[var(--loop-border)] hover:bg-[var(--loop-border)]",
  ghost:
    "bg-transparent text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-lg",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
