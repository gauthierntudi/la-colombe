"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Banknote, FileText, Search, XCircle, Plus, CheckCircle } from "lucide-react";
import { apiFetch, formatCdf, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { TablePagination } from "@/components/ui/table-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { DEFAULT_PAGE_SIZE, EMPTY_PAGINATION, type PaginationMeta } from "@/lib/pagination";
import { InvoiceModal, type InvoiceFormResult } from "@/components/invoices/invoice-modal";

type PointOfSale = { id: string; code: string; name: string; type: string };

type ProductOption = { id: string; sku: string; name: string; unitPrice: number };

type InvoiceSummary = {
  id: string;
  number: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  totalTtc: number;
  createdAt: string;
  validatedAt: string | null;
  paidAt: string | null;
  pointOfSale: PointOfSale;
  createdBy: { name: string };
  lineCount: number;
};

type InvoiceDetail = InvoiceSummary & {
  subtotalHt: number;
  taxAmount: number;
  discountAmount: number;
  notes: string | null;
  lines: {
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    lineTotalTtc: number;
  }[];
  payments: {
    method: string;
    status: string;
    amount: number;
    provider: string | null;
    flexpaieReference: string | null;
  }[];
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "badge-warn" },
  PENDING_PAYMENT: { label: "En attente", className: "badge-store" },
  PAID: { label: "Payée", className: "badge-success" },
  CANCELLED: { label: "Annulée", className: "badge-warn" },
  EXPIRED: { label: "Expirée", className: "badge-warn" },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function InvoicesPage() {
  const user = getUser()!;
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? ""
  );
  const [siteFilter, setSiteFilter] = useState(
    () => searchParams.get("pointOfSaleId") ?? ""
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_PAGINATION);

  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<InvoiceSummary | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [payTarget, setPayTarget] = useState<InvoiceSummary | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const [validateTarget, setValidateTarget] = useState<InvoiceSummary | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);

  const canCreate =
    user.role === "ADMIN" || user.role === "MANAGER" || user.role === "FACTURANT";

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (siteFilter) params.set("pointOfSaleId", siteFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    try {
      const [invRes, sitesRes] = await Promise.all([
        apiFetch<{ data: InvoiceSummary[]; meta: PaginationMeta }>(`/invoices?${params}`),
        apiFetch<{ data: PointOfSale[] }>("/points-of-sale"),
      ]);
      setInvoices(invRes.data);
      setMeta(invRes.meta);
      setSites(sitesRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, siteFilter, dateFrom, dateTo]);

  useEffect(() => {
    load().catch(console.error);
  }, [search, statusFilter, siteFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    const q = searchParams.get("search");
    const st = searchParams.get("status");
    const site = searchParams.get("pointOfSaleId");
    if (q !== null) setSearch(q);
    if (st !== null) setStatusFilter(st);
    if (site !== null) setSiteFilter(site);
  }, [searchParams]);

  useEffect(() => {
    if (!createOpen) return;
    apiFetch<{ data: ProductOption[] }>("/products?limit=100")
      .then((res) => setProducts(res.data))
      .catch(console.error);
  }, [createOpen]);

  async function handleCreateInvoice(data: InvoiceFormResult) {
    setCreateLoading(true);
    setCreateError("");
    try {
      await submitToast(
        (async () => {
          const created = await apiFetch<{ id: string }>("/invoices", {
            method: "POST",
            body: JSON.stringify({
              pointOfSaleId: data.pointOfSaleId,
              customerName: data.customerName || null,
              customerPhone: data.customerPhone || null,
              notes: data.notes || null,
              lines: data.lines,
            }),
          });
          if (data.validateImmediately) {
            await apiFetch(`/invoices/${created.id}/validate`, { method: "POST" });
            window.dispatchEvent(new Event("ges-notifications-refresh"));
          }
        })(),
        {
          pending: "Création de la facture...",
          success: data.validateImmediately
            ? "Facture créée et validée"
            : "Facture créée",
        }
      );
      setCreateOpen(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreateLoading(false);
    }
  }
  async function openDetail(invoice: InvoiceSummary) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await apiFetch<InvoiceDetail>(`/invoices/${invoice.id}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function canCancel(inv: InvoiceSummary) {
    if (inv.status === "CANCELLED" || inv.status === "EXPIRED") return false;
    if (inv.status === "DRAFT") {
      return user.role === "ADMIN" || user.role === "MANAGER" || user.role === "FACTURANT";
    }
    if (inv.status === "PAID") return user.role === "ADMIN";
    return user.role === "ADMIN" || user.role === "MANAGER";
  }

  function canPay(inv: InvoiceSummary) {
    return (
      inv.status === "PENDING_PAYMENT" &&
      (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "CAISSIER")
    );
  }

  function canValidate(inv: InvoiceSummary) {
    if (inv.status !== "DRAFT") return false;
    return user.role === "ADMIN" || user.role === "MANAGER" || user.role === "FACTURANT";
  }

  async function handlePaySuccess() {
    setPayTarget(null);
    setDetailOpen(false);
    window.dispatchEvent(new Event("ges-notifications-refresh"));
    await load();
  }

  async function handlePay() {
    if (!payTarget) return;
    setPayLoading(true);
    setError("");
    try {
      await submitToast(
        apiFetch("/payments", {
          method: "POST",
          body: JSON.stringify({
            invoiceId: payTarget.id,
            payments: [{ method: "CASH", amount: payTarget.totalTtc }],
          }),
        }),
        {
          pending: "Encaissement en cours...",
          success: "Paiement enregistré",
        }
      );
      await handlePaySuccess();
    } catch {
      /* toast affiché */
    } finally {
      setPayLoading(false);
    }
  }

  async function handleValidate() {
    if (!validateTarget) return;
    setValidateLoading(true);
    setError("");
    try {
      await submitToast(
        apiFetch(`/invoices/${validateTarget.id}/validate`, { method: "POST" }),
        {
          pending: "Validation de la facture...",
          success: "Facture validée",
        }
      );
      setValidateTarget(null);
      setDetailOpen(false);
      window.dispatchEvent(new Event("ges-notifications-refresh"));
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setValidateLoading(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await submitToast(
        apiFetch(`/invoices/${cancelTarget.id}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason: cancelReason || undefined }),
        }),
        {
          pending: "Annulation de la facture...",
          success: "Facture annulée",
          successType: "warning",
        }
      );
      setCancelTarget(null);
      setCancelReason("");
      setDetailOpen(false);
      window.dispatchEvent(new Event("ges-notifications-refresh"));
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <>
      <DashboardHeader
        title="Factures"
        subtitle={`${meta.total.toLocaleString("fr-FR")} facture(s)`}
        user={user}
        actions={
          canCreate ? (
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              Nouvelle facture
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="filter-bar mb-5">
        <div className="filter-search flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="text-[var(--muted)] shrink-0" />
          <input
            placeholder="N°, client, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-field min-w-[160px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillons</option>
          <option value="PENDING_PAYMENT">En attente</option>
          <option value="PAID">Payées</option>
          <option value="CANCELLED">Annulées</option>
          <option value="EXPIRED">Expirées</option>
        </select>
        <select
          className="select-field min-w-[180px]"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">Tous les sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <DatePicker
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="Du"
          max={dateTo || undefined}
          clearable
          className="min-w-[11rem]"
        />
        <DatePicker
          value={dateTo}
          onChange={setDateTo}
          placeholder="Au"
          min={dateFrom || undefined}
          clearable
          className="min-w-[11rem]"
        />
      </div>

      <div className="glass-card table-wrap p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-[var(--muted)]">Chargement...</p>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)]">
            <FileText size={32} className="mx-auto opacity-40 mb-3" />
            <p className="text-sm">Aucune facture trouvée</p>
            <p className="text-xs mt-1">Les factures apparaîtront ici après validation depuis l'app mobile La Colombe.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Site</th>
                <th>Client</th>
                <th className="text-right">Total TTC</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = STATUS_LABELS[inv.status] ?? {
                  label: inv.status,
                  className: "badge-store",
                };
                return (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs text-[var(--accent)]">{inv.number}</td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="text-sm">{inv.pointOfSale.code}</td>
                    <td>
                      {inv.customerName || inv.customerPhone ? (
                        <div>
                          {inv.customerName && (
                            <p className="text-sm font-medium">{inv.customerName}</p>
                          )}
                          {inv.customerPhone && (
                            <p className="text-xs text-[var(--muted)]">{inv.customerPhone}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)] text-sm">Anonyme</span>
                      )}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatCdf(inv.totalTtc)}
                    </td>
                    <td>
                      <span className={`badge ${st.className}`}>{st.label}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <IconButton
                          icon={Eye}
                          title="Voir le détail"
                          variant="primary"
                          onClick={() => openDetail(inv)}
                        />
                        {canValidate(inv) && (
                          <IconButton
                            icon={CheckCircle}
                            title="Valider la facture"
                            variant="primary"
                            onClick={() => setValidateTarget(inv)}
                          />
                        )}
                        {canPay(inv) && (
                          <IconButton
                            icon={Banknote}
                            title="Encaisser (espèces)"
                            variant="primary"
                            onClick={() => setPayTarget(inv)}
                          />
                        )}
                        {canCancel(inv) && (
                          <IconButton
                            icon={XCircle}
                            title="Annuler"
                            variant="danger"
                            onClick={() => {
                              setCancelReason("");
                              setCancelTarget(inv);
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && meta.total > 0 && (
          <TablePagination meta={meta} onPageChange={setPage} disabled={loading} />
        )}
      </div>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail ? `Facture ${detail.number}` : "Détail facture"}
        size="lg"
        footer={
          detail ? (
            <div className="flex justify-end gap-2 w-full flex-wrap">
              {canValidate(detail) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setValidateTarget(detail)}
                >
                  <CheckCircle size={16} />
                  Valider
                </button>
              )}
              {canPay(detail) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setPayTarget(detail)}
                >
                  <Banknote size={16} />
                  Encaisser en espèces
                </button>
              )}
              {canCancel(detail) && (
                <button
                  type="button"
                  className="btn btn-ghost text-[var(--danger)]"
                  onClick={() => {
                    setCancelReason("");
                    setCancelTarget(detail);
                  }}
                >
                  <XCircle size={16} />
                  Annuler
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {detailLoading ? (
          <p className="text-sm text-[var(--muted)]">Chargement...</p>
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--muted)] text-xs">Site</p>
                <p className="font-medium">{detail.pointOfSale.name}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs">Créée par</p>
                <p className="font-medium">{detail.createdBy.name}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs">Client</p>
                <p className="font-medium">
                  {detail.customerName ?? detail.customerPhone ?? "Anonyme"}
                </p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs">Statut</p>
                <span className={`badge ${STATUS_LABELS[detail.status]?.className ?? ""}`}>
                  {STATUS_LABELS[detail.status]?.label ?? detail.status}
                </span>
              </div>
            </div>

            <table className="data text-sm">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">P.U.</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-xs font-mono text-[var(--muted)]">{l.productSku}</p>
                    </td>
                    <td className="text-right">{l.quantity}</td>
                    <td className="text-right">{formatCdf(l.unitPrice)}</td>
                    <td className="text-right font-medium">{formatCdf(l.lineTotalTtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col items-end gap-1 text-sm border-t border-[var(--border-light)] pt-4">
              <p className="text-[var(--muted)]">
                HT : {formatCdf(detail.subtotalHt)} · TVA : {formatCdf(detail.taxAmount)}
              </p>
              <p className="text-lg font-bold">Total TTC : {formatCdf(detail.totalTtc)}</p>
            </div>

            {detail.payments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] mb-2">Paiements</p>
                {detail.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span>
                      {p.method} {p.provider ? `(${p.provider})` : ""}
                    </span>
                    <span className="font-medium">{formatCdf(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Annuler la facture"
        message={
          cancelTarget
            ? `Annuler la facture « ${cancelTarget.number} » ? ${
                cancelTarget.status === "PAID"
                  ? "Le stock sera réintégré sur le site."
                  : cancelTarget.status === "DRAFT"
                    ? "Le brouillon sera marqué comme annulé."
                    : "La réservation de stock sera libérée."
              }`
            : ""
        }
        confirmLabel="Annuler la facture"
        variant="danger"
        loading={cancelLoading}
      />

      <ConfirmModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={handlePay}
        title="Encaisser la facture"
        message={
          payTarget
            ? `Encaisser ${formatCdf(payTarget.totalTtc)} en espèces pour « ${payTarget.number} » ? Le stock sera déduit définitivement.`
            : ""
        }
        confirmLabel="Confirmer l'encaissement"
        variant="primary"
        loading={payLoading}
      />

      <ConfirmModal
        open={!!validateTarget}
        onClose={() => setValidateTarget(null)}
        onConfirm={handleValidate}
        title="Valider la facture"
        message={
          validateTarget
            ? `Valider « ${validateTarget.number} » ? La facture passera en attente de caisse et le stock sera réservé.`
            : ""
        }
        confirmLabel="Valider"
        variant="primary"
        loading={validateLoading}
      />

      <InvoiceModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError("");
        }}
        onSubmit={handleCreateInvoice}
        sites={sites}
        products={products}
        loading={createLoading}
        error={createError}
      />
    </>
  );
}
