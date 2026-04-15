import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-lg border bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)] focus:border-[var(--loop-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--loop-primary)] disabled:opacity-50 ${
            error ? "border-[var(--loop-error)]" : "border-[var(--loop-border)]"
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--loop-error)]">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
