"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-md border border-line bg-ink-850 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "bg-ink-600 text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {o.label}
            {o.count !== undefined ? <span className="ml-1.5 tabular-nums text-fg-dim">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-xs text-fg-dim ${className}`}>
      {label ? <span className="whitespace-nowrap">{label}</span> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 max-w-[14rem] rounded-md border border-line bg-ink-850 px-2 text-xs text-fg hover:border-line-strong focus:border-signal/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-dim" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-md border border-line bg-ink-850 pl-8 pr-8 text-xs text-fg placeholder:text-fg-dim hover:border-line-strong focus:border-signal/50"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-fg-dim hover:text-fg"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-signal/40 bg-signal/15 text-signal hover:bg-signal/25",
  secondary: "border-line-strong bg-ink-800 text-fg hover:bg-ink-700",
  ghost: "border-transparent text-fg-muted hover:bg-ink-800 hover:text-fg",
  danger: "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md"): string {
  const pad = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-xs";
  return `inline-flex ${pad} items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  children,
  onClick,
  disabled,
  title,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  children,
  className = "",
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

export function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-line-strong bg-ink-700 text-fg" : "border-line bg-transparent text-fg-dim hover:text-fg-muted"
      }`}
    >
      {color ? (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.35 }} />
      ) : null}
      {children}
    </button>
  );
}
