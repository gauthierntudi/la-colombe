"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "icon-btn" }: ThemeToggleProps) {
  const { theme, mounted, toggleTheme } = useTheme();

  if (!mounted) {
    return (
      <button
        type="button"
        className={className}
        aria-hidden
        tabIndex={-1}
        disabled
      >
        <Moon size={18} className="opacity-0" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
      aria-label={
        theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"
      }
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
