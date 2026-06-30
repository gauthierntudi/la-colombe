"use client";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
};

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: ToggleSwitchProps) {
  const switchId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <label
      htmlFor={switchId}
      className={`inline-flex items-center gap-3 text-sm text-[var(--text-secondary)] cursor-pointer glass-card-flat px-4 py-2 select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {label && <span>{label}</span>}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
