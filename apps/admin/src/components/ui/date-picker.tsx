"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Préférence d'alignement horizontal du calendrier */
  align?: "start" | "end";
};

const POPUP_GAP = 6;
const VIEWPORT_PADDING = 8;
const POPUP_WIDTH = 288;
const POPUP_HEIGHT_ESTIMATE = 320;

type PopupPosition = { top: number; left: number };

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
  align = "start",
}: DatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popupPos, setPopupPos] = useState<PopupPosition | null>(null);

  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min ?? "");
  const maxDate = parseIsoDate(max ?? "");
  const today = new Date();

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  const updatePopupPosition = () => {
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const popupWidth = popup?.offsetWidth ?? POPUP_WIDTH;
    const popupHeight = popup?.offsetHeight ?? POPUP_HEIGHT_ESTIMATE;

    let top = rect.bottom + POPUP_GAP;
    if (top + popupHeight > window.innerHeight - VIEWPORT_PADDING) {
      top = rect.top - popupHeight - POPUP_GAP;
    }
    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, window.innerHeight - popupHeight - VIEWPORT_PADDING)
    );

    let left = align === "end" ? rect.right - popupWidth : rect.left;
    if (left + popupWidth > window.innerWidth - VIEWPORT_PADDING) {
      left = rect.right - popupWidth;
    }
    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    }
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - popupWidth - VIEWPORT_PADDING)
    );

    setPopupPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPopupPos(null);
      return;
    }
    updatePopupPosition();
    const frame = requestAnimationFrame(() => updatePopupPosition());
    return () => cancelAnimationFrame(frame);
  }, [open, viewYear, viewMonth, align]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function handleReposition() {
      updatePopupPosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, viewYear, viewMonth, align]);

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

  const popup =
    open && mounted && popupPos
      ? createPortal(
          <div
            ref={popupRef}
            className="date-picker-popup date-picker-popup-portal"
            style={{ top: popupPos.top, left: popupPos.left }}
            role="dialog"
            aria-label={label ?? "Calendrier"}
          >
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
                  return (
                    <span key={`empty-${index}`} className="date-picker-day-empty" />
                  );
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs text-[var(--muted)] mb-1">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
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

      {popup}
    </div>
  );
}
