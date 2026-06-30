"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { POS_TYPE_LABELS } from "@/components/points-of-sale/point-of-sale-modal";

export type PointOfSaleOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type PointOfSalePickerProps = {
  sites: PointOfSaleOption[];
  value: string[];
  onChange: (ids: string[]) => void;
};

export function PointOfSalePicker({ sites, value, onChange }: PointOfSalePickerProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sites.filter((site) => {
      if (typeFilter && site.type !== typeFilter) return false;
      if (!q) return true;
      const typeLabel = (POS_TYPE_LABELS[site.type] ?? site.type).toLowerCase();
      return (
        site.code.toLowerCase().includes(q) ||
        site.name.toLowerCase().includes(q) ||
        typeLabel.includes(q)
      );
    });
  }, [sites, search, typeFilter]);

  const selectedSites = useMemo(
    () => sites.filter((site) => selectedSet.has(site.id)),
    [sites, selectedSet]
  );

  function toggleSite(id: string) {
    onChange(
      selectedSet.has(id) ? value.filter((s) => s !== id) : [...value, id]
    );
  }

  function removeSite(id: string) {
    onChange(value.filter((s) => s !== id));
  }

  function selectAllVisible() {
    const next = new Set(value);
    filteredSites.forEach((site) => next.add(site.id));
    onChange(Array.from(next));
  }

  function clearAll() {
    onChange([]);
  }

  if (sites.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Aucun point de vente configuré.</p>;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <div className="p-3 border-b border-[var(--border-light)] flex flex-wrap gap-2">
        <div className="filter-search flex-1 min-w-[160px]">
          <Search size={15} className="text-[var(--muted)] shrink-0" />
          <input
            placeholder="Rechercher un site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-field min-w-[130px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Tous types</option>
          <option value="STORE">Points de vente</option>
          <option value="DEPOT">Dépôts</option>
        </select>
      </div>

      <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)] border-b border-[var(--border-light)]">
        <span>
          {value.length} sélectionné(s)
          {filteredSites.length !== sites.length &&
            ` · ${filteredSites.length} affiché(s)`}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-[var(--accent)] hover:underline disabled:opacity-40"
            onClick={selectAllVisible}
            disabled={filteredSites.length === 0}
          >
            Tout sélectionner
          </button>
          <button
            type="button"
            className="text-[var(--accent)] hover:underline disabled:opacity-40"
            onClick={clearAll}
            disabled={value.length === 0}
          >
            Tout retirer
          </button>
        </div>
      </div>

      {selectedSites.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border-b border-[var(--border-light)]">
          {selectedSites.map((site) => (
            <span
              key={site.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-medium"
            >
              <span className="font-mono">{site.code}</span>
              <button
                type="button"
                className="p-0.5 rounded-full hover:bg-[var(--accent)]/15 transition-colors"
                title={`Retirer ${site.name}`}
                onClick={() => removeSite(site.id)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="max-h-52 overflow-y-auto">
        {filteredSites.length === 0 ? (
          <p className="px-3 py-6 text-sm text-center text-[var(--muted)]">
            Aucun site ne correspond à la recherche
          </p>
        ) : (
          filteredSites.map((site) => {
            const checked = selectedSet.has(site.id);
            return (
              <label
                key={site.id}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-[var(--border-light)] last:border-b-0 transition-colors ${
                  checked ? "bg-[var(--accent-soft)]/60" : "hover:bg-[var(--surface)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSite(site.id)}
                  className="accent-[var(--accent)] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{site.name}</p>
                  <p className="text-xs text-[var(--muted)] font-mono">{site.code}</p>
                </div>
                <span
                  className={`badge shrink-0 text-[10px] ${
                    site.type === "STORE" ? "badge-store" : "badge-depot"
                  }`}
                >
                  {POS_TYPE_LABELS[site.type] ?? site.type}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
