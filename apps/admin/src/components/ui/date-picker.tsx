"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  formatDisplayDate,
  getMonthGrid,
  isAfterDay,
  isBeforeDay,
  isSameDay,
  parseIsoDate,
  toIsoDate,
} from "@/lib/date-utils";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Choisir une date",
  min,
  max,
  disabled,
  clearable = false,
  className = "",
}: DatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min ?? "");
  const maxDate = parseIsoDate(max ?? "");
  const today = new Date();

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function isDisabledDay(date: Date) {
    if (minDate && isBeforeDay(date, minDate)) return true;
    if (maxDate && isAfterDay(date, maxDate)) return true;
    return false;
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function selectDay(date: Date) {
    if (isDisabledDay(date)) return;
    onChange(toIsoDate(date));
    setOpen(false);
  }

  const grid = getMonthGrid(viewYear, viewMonth);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs text-[var(--muted)] mb-1">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`date-picker-trigger ${open ? "date-picker-trigger-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "text-[var(--text)]" : "text-[var(--muted)]"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="date-picker-clear"
              aria-label="Effacer la date"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                  setOpen(false);
                }
              }}
            >
              <X size={14} />
            </span>
          )}
          <Calendar size={15} className="text-[var(--muted)]" />
        </span>
      </button>

      {open && (
        <div className="date-picker-popup" role="dialog" aria-label={label ?? "Calendrier"}>
          <div className="date-picker-header">
            <button
              type="button"
              className="btn-circle"
              aria-label="Mois précédent"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="date-picker-month">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="btn-circle"
              aria-label="Mois suivant"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="date-picker-weekdays">
            {WEEKDAY_LABELS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {grid.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="date-picker-day-empty" />;
              }

              const selectedDay = selected && isSameDay(date, selected);
              const todayDay = isSameDay(date, today);
              const disabledDay = isDisabledDay(date);

              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => selectDay(date)}
                  className={[
                    "date-picker-day",
                    selectedDay ? "date-picker-day-selected" : "",
                    todayDay && !selectedDay ? "date-picker-day-today" : "",
                    disabledDay ? "date-picker-day-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
