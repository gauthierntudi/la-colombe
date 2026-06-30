"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  Lock,
  Receipt,
  Scale,
  Search,
  Smartphone,
  Unlock,
  Wallet,
} from "lucide-react";
import { formatCdf } from "@/lib/client-api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateArray } from "@/lib/pagination";

export type CashSessionDetail = {
  id: string;
  status: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashVariance: number | null;
  totalMobileMoney: number;
  totalSales: number;
  invoiceCount: number;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  user: { id: string; name: string };
  pointOfSale: { code: string; name: string };
  payments: {
    id: string;
    method: string;
    amount: number;
    invoiceNumber: string;
    completedAt: string | null;
  }[];
  summary: {
    cashCount: number;
    cashTotal: number;
    mobileMoneyCount: number;
    mobileMoneyTotal: number;
  };
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  OTHER: "Autre",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type CashSessionDetailViewProps = {
  detail: CashSessionDetail;
  paymentSearch?: string;
  onPaymentSearchChange?: (value: string) => void;
};

export function CashSessionDetailView({
  detail,
  paymentSearch = "",
  onPaymentSearchChange,
}: CashSessionDetailViewProps) {
  const isOpen = detail.status === "OPEN";
  const [paymentsPage, setPaymentsPage] = useState(1);
  const hasVariance = detail.cashVariance != null && detail.cashVariance !== 0;

  const filteredPayments = detail.payments.filter((p) => {
    if (!paymentSearch.trim()) return true;
    const q = paymentSearch.toLowerCase();
    return (
      p.invoiceNumber.toLowerCase().includes(q) ||
      (METHOD_LABELS[p.method] ?? p.method).toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setPaymentsPage(1);
  }, [paymentSearch]);

  const { data: pagedPayments, meta: paymentsMeta } = useMemo(
    () => paginateArray(filteredPayments, paymentsPage),
    [filteredPayments, paymentsPage]
  );

  const filteredTotal = filteredPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {isOpen ? (
          <span className="badge badge-success flex items-center gap-1">
            <Unlock size={11} /> Session ouverte
          </span>
        ) : (
          <span className="badge badge-warn flex items-center gap-1">
            <Lock size={11} /> Session clôturée
          </span>
        )}
        <span className="text-sm text-[var(--muted)]">
          Ouverture {formatDateTime(detail.openedAt)}
          {detail.closedAt && ` · Clôture ${formatDateTime(detail.closedAt)}`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Fond initial"
          value={formatCdf(detail.openingCash)}
          hint="Espèces au démarrage"
          badge="Caisse"
          icon={Wallet}
          tone="neutral"
        />
        <KpiCard
          label="Espèces encaissées"
          value={formatCdf(detail.summary.cashTotal)}
          hint={`${detail.summary.cashCount} paiement(s) espèces`}
          badge="Cash"
          icon={Banknote}
          tone="success"
        />
        <KpiCard
          label="Mobile Money"
          value={formatCdf(detail.summary.mobileMoneyTotal)}
          hint={`${detail.summary.mobileMoneyCount} paiement(s) mobile`}
          badge="MM"
          icon={Smartphone}
          tone="info"
        />
        <KpiCard
          label="Ventes totales"
          value={formatCdf(detail.totalSales)}
          hint={`${detail.invoiceCount} facture(s) sur la session`}
          badge="TTC"
          icon={Receipt}
          tone="primary"
        />
      </div>

      {!isOpen && detail.expectedCash != null && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Espèces attendues"
            value={formatCdf(detail.expectedCash)}
            hint="Fond initial + encaissements espèces"
            badge="Théorique"
            icon={Calculator}
            tone="violet"
          />
          <KpiCard
            label="Espèces comptées"
            value={
              detail.closingCash != null ? formatCdf(detail.closingCash) : "—"
            }
            hint="Montant déclaré à la clôture"
            badge="Réel"
            icon={Scale}
            tone="neutral"
          />
          <KpiCard
            label="Écart caisse"
            value={
              detail.cashVariance != null ? formatCdf(detail.cashVariance) : "—"
            }
            hint={
              hasVariance
                ? "Écart entre attendu et compté"
                : "Caisse conforme au attendu"
            }
            badge={hasVariance ? "Écart" : "OK"}
            icon={Banknote}
            tone={hasVariance ? "warning" : "success"}
          />
        </div>
      )}

      {detail.notes && (
        <div className="glass-card-flat px-4 py-3 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text)]">Notes : </span>
          {detail.notes}
        </div>
      )}

      <div className="glass-card table-wrap p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-light)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Paiements</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {detail.payments.length} enregistrement(s)
              {paymentSearch.trim() && filteredPayments.length !== detail.payments.length
                ? ` · ${filteredPayments.length} affiché(s) · ${formatCdf(filteredTotal)}`
                : ` · ${formatCdf(filteredTotal)}`}
            </p>
          </div>
          {onPaymentSearchChange && detail.payments.length > 0 && (
            <div className="filter-search min-w-[200px] max-w-xs">
              <Search size={16} className="text-[var(--muted)] shrink-0" />
              <input
                placeholder="Facture, mode..."
                value={paymentSearch}
                onChange={(e) => onPaymentSearchChange(e.target.value)}
              />
            </div>
          )}
        </div>

        {detail.payments.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-16 text-center">
            Aucun paiement enregistré sur cette session
          </p>
        ) : filteredPayments.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-16 text-center">
            Aucun paiement ne correspond à la recherche
          </p>
        ) : (
          <>
            <table className="data">
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {pagedPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs text-[var(--accent)]">{p.invoiceNumber}</td>
                    <td>
                      <span className="badge badge-store text-[10px]">
                        {METHOD_LABELS[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">
                      {p.completedAt ? formatDateTime(p.completedAt) : "—"}
                    </td>
                    <td className="text-right tabular-nums font-medium">
                      {formatCdf(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--bg)] font-semibold">
                  <td colSpan={3} className="text-right text-sm text-[var(--muted)]">
                    Total filtré
                  </td>
                  <td className="text-right tabular-nums">{formatCdf(filteredTotal)}</td>
                </tr>
              </tfoot>
            </table>
            {paymentsMeta.total > 0 && (
              <TablePagination meta={paymentsMeta} onPageChange={setPaymentsPage} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
