"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, FileText } from "lucide-react";
import { apiFetch, formatCdf } from "@/lib/client-api";

type PendingInvoice = {
  id: string;
  number: string;
  customerName: string | null;
  customerPhone: string | null;
  totalTtc: number;
  createdAt: string;
  validatedAt: string | null;
  pointOfSale: { code: string; name: string };
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

function NotificationItem({ inv, onNavigate }: { inv: PendingInvoice; onNavigate: () => void }) {
  const client = inv.customerName ?? inv.customerPhone ?? "Anonyme";
  const when = timeAgo(inv.validatedAt ?? inv.createdAt);

  return (
    <li>
      <Link
        href={`/dashboard/invoices?status=PENDING_PAYMENT&search=${encodeURIComponent(inv.number)}`}
        className="notification-item group"
        onClick={onNavigate}
      >
        <span className="notification-item-dot" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold font-mono text-[var(--text)] truncate">
              {inv.number}
            </span>
            <span className="text-[13px] font-bold text-[var(--accent)] tabular-nums shrink-0">
              {formatCdf(inv.totalTtc)}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted)] truncate mt-0.5 leading-snug">
            {client}
            <span className="mx-1 opacity-40">·</span>
            {inv.pointOfSale.code}
            <span className="mx-1 opacity-40">·</span>
            {when}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{
        data: PendingInvoice[];
        meta: { total: number };
      }>("/invoices?status=PENDING_PAYMENT&limit=8");
      setInvoices(res.data);
      setTotal(res.meta.total);
    } catch {
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const onRefresh = () => load();
    window.addEventListener("ges-notifications-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("ges-notifications-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const count = total;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label={`Notifications${count > 0 ? `, ${count} facture(s) en attente` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="notification-badge">{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="notification-panel"
        >
          <div className="notification-panel-header">
            <p className="text-sm font-semibold leading-tight">En attente de paiement</p>
            {count > 0 && (
              <span className="badge badge-store text-[10px] px-2 py-0.5">{count}</span>
            )}
          </div>

          <div className="notification-panel-body">
            {loading ? (
              <p className="text-xs text-[var(--muted)] py-8 text-center">Chargement...</p>
            ) : invoices.length === 0 ? (
              <div className="py-10 px-4 text-center text-[var(--muted)]">
                <FileText size={22} className="mx-auto opacity-25 mb-2" />
                <p className="text-xs">Aucune facture en attente</p>
              </div>
            ) : (
              <ul>
                {invoices.map((inv) => (
                  <NotificationItem
                    key={inv.id}
                    inv={inv}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>

          {count > 0 && (
            <div className="notification-panel-footer">
              <Link
                href="/dashboard/invoices?status=PENDING_PAYMENT"
                className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
                onClick={() => setOpen(false)}
              >
                Tout voir ({count})
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
