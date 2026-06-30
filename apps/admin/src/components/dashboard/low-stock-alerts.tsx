"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export type LowStockAlertRow = {
  productId: string;
  sku: string;
  name: string;
  pointOfSaleId: string;
  siteCode: string;
  siteName: string;
  availableStock: number;
  minStockLevel: number;
  deficit: number;
};

type LowStockAlertsProps = {
  alerts: LowStockAlertRow[];
  loading?: boolean;
};

export function LowStockAlerts({ alerts, loading }: LowStockAlertsProps) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-[var(--warning)]" />
            Alertes stock
          </h3>
          <p className="text-xs text-[var(--muted)] mt-1">
            Produits sous le seuil minimum par site
          </p>
        </div>
        {alerts.length > 0 && (
          <Link
            href="/dashboard/inventory?alerts=1"
            className="text-xs font-semibold text-[var(--accent)] hover:underline shrink-0"
          >
            Voir tout
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-[var(--bg)] animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-4 text-center">
          Aucune alerte — tous les stocks sont au-dessus du seuil.
        </p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 8).map((a) => (
            <Link
              key={`${a.productId}-${a.pointOfSaleId}`}
              href={`/dashboard/inventory?alerts=1&site=${encodeURIComponent(a.siteCode)}`}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--warning-soft)]/30 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-[var(--warning)]">
                  {a.name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {a.siteCode} · {a.sku}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-[var(--warning)]">
                  {a.availableStock} / {a.minStockLevel}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  −{a.deficit} unité{a.deficit > 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
