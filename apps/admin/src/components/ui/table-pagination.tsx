"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/lib/pagination";
import { IconButton } from "@/components/ui/icon-button";

type TablePaginationProps = {
  meta: Pick<PaginationMeta, "page" | "totalPages" | "total" | "limit">;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function TablePagination({ meta, onPageChange, disabled }: TablePaginationProps) {
  if (meta.total === 0) return null;

  const { page, totalPages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="px-5 py-3 border-t border-[var(--border-light)] flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--muted)]">
        {from}–{to} sur {total.toLocaleString("fr-FR")} résultat{total > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-2">
        <IconButton
          icon={ChevronLeft}
          title="Page précédente"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="text-sm text-[var(--muted)] tabular-nums px-1 min-w-[5rem] text-center">
          {page} / {totalPages}
        </span>
        <IconButton
          icon={ChevronRight}
          title="Page suivante"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}
