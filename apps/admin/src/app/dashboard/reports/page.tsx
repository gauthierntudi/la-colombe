"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Filter,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch, formatCdf, getUser } from "@/lib/client-api";
import { DashboardHeader } from "@/components/dashboard/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TablePagination } from "@/components/ui/table-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import {
  formatDisplayDate,
  monthStartIso,
  todayIso,
} from "@/lib/date-utils";

type SalesPoint = { date: string; total: number; count: number };
type TopProduct = { productId: string; name: string; quantity: number; revenue: number };
type PointOfSale = { id: string; code: string; name: string };
type ProductOption = { id: string; sku: string; name: string };

type SalesLine = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  paidAt: string | null;
  createdAt: string;
  pointOfSale: PointOfSale;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  lineTotalTtc: number;
  customerName: string | null;
  customerPhone: string | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "badge-warn" },
  PENDING_PAYMENT: { label: "En attente", className: "badge-store" },
  PAID: { label: "Payée", className: "badge-success" },
  CANCELLED: { label: "Annulée", className: "badge-warn" },
  EXPIRED: { label: "Expirée", className: "badge-warn" },
};

function formatShortDate(iso: string) {
  if (iso.length === 7) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(
    new Date(iso)
  );
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function buildReportParams(filters: {
  dateFrom: string;
  dateTo: string;
  pointOfSaleId: string;
  productId: string;
  status: string;
}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.pointOfSaleId) params.set("pointOfSaleId", filters.pointOfSaleId);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.status) params.set("status", filters.status);
  return params;
}

export default function ReportsPage() {
  const user = getUser()!;
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalSales: 0, invoiceCount: 0 });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [valuation, setValuation] = useState({ totalValue: 0, totalUnits: 0 });
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);
  const [linesSummary, setLinesSummary] = useState({ totalQuantity: 0, totalAmount: 0 });
  const [linesMeta, setLinesMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [dateFrom, setDateFrom] = useState(monthStartIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [pointOfSaleId, setPointOfSaleId] = useState("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("PAID");
  const [page, setPage] = useState(1);

  const filters = { dateFrom, dateTo, pointOfSaleId, productId, status };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const params = buildReportParams(filters);
    params.set("groupBy", "day");

    try {
      const [salesRes, topRes, valRes] = await Promise.all([
        apiFetch<{ data: SalesPoint[]; summary: { totalSales: number; invoiceCount: number } }>(
          `/reports?type=sales&${params}`
        ),
        apiFetch<{ data: TopProduct[] }>(`/reports?type=top-products&${params}&limit=8`),
        apiFetch<{ totalValue: number; totalUnits: number }>(
          pointOfSaleId
            ? `/reports?type=inventory-valuation&pointOfSaleId=${pointOfSaleId}`
            : "/reports?type=inventory-valuation"
        ),
      ]);

      setSales(salesRes.data);
      setSalesSummary(salesRes.summary);
      setTopProducts(topRes.data);
      setValuation(valRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, pointOfSaleId, productId, status]);

  const loadTable = useCallback(async () => {
    setTableLoading(true);
    const params = buildReportParams(filters);
    params.set("type", "sales-lines");
    params.set("page", String(page));
    params.set("limit", "20");

    try {
      const res = await apiFetch<{
        data: SalesLine[];
        meta: { total: number; page: number; limit: number; totalPages: number };
        summary: { totalQuantity: number; totalAmount: number };
      }>(`/reports?${params}`);

      setSalesLines(res.data);
      setLinesMeta(res.meta);
      setLinesSummary(res.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  }, [dateFrom, dateTo, pointOfSaleId, productId, status, page]);

  useEffect(() => {
    apiFetch<{ data: PointOfSale[] }>("/points-of-sale")
      .then((res) => setSites(res.data))
      .catch(console.error);
    apiFetch<{ data: ProductOption[] }>("/products?limit=200")
      .then((res) => setProducts(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, pointOfSaleId, productId, status]);

  useEffect(() => {
    if (user.role !== "ADMIN" && user.role !== "MANAGER") return;
    loadOverview().catch(console.error);
  }, [loadOverview, user.role]);

  useEffect(() => {
    if (user.role !== "ADMIN" && user.role !== "MANAGER") return;
    loadTable().catch(console.error);
  }, [loadTable, user.role]);

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return (
      <>
        <DashboardHeader title="Rapports" user={user} />
        <p className="text-sm text-[var(--muted)]">Réservé aux administrateurs et managers.</p>
      </>
    );
  }

  const chartData = sales.map((d) => ({
    label: formatShortDate(d.date),
    total: d.total,
    count: d.count,
  }));

  const periodLabel =
    dateFrom && dateTo
      ? `${formatDisplayDate(dateFrom)} — ${formatDisplayDate(dateTo)}`
      : "Période";

  return (
    <>
      <DashboardHeader
        title="Rapports"
        subtitle="Chiffre d'affaires et performance"
        user={user}
      />

      <div className="glass-card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-[var(--muted)]" />
          <span className="text-sm font-medium">Filtres</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <DatePicker
            label="Du"
            value={dateFrom}
            onChange={setDateFrom}
            max={dateTo || todayIso()}
          />
          <DatePicker
            label="Au"
            value={dateTo}
            onChange={setDateTo}
            min={dateFrom}
            max={todayIso()}
          />
          <label className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-xs text-[var(--muted)]">Point de vente</span>
            <select
              className="select-field min-w-[160px]"
              value={pointOfSaleId}
              onChange={(e) => setPointOfSaleId(e.target.value)}
            >
              <option value="">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-sm">
            <span className="text-xs text-[var(--muted)]">Produit</span>
            <select
              className="select-field min-w-[200px]"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Tous les produits</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-xs text-[var(--muted)]">Statut facture</span>
            <select
              className="select-field min-w-[140px]"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="PAID">Payées</option>
              <option value="PENDING_PAYMENT">En attente</option>
              <option value="DRAFT">Brouillons</option>
              <option value="CANCELLED">Annulées</option>
              <option value="ALL">Tous les statuts</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">
          Les graphiques et le CA concernent les factures payées. Le tableau applique tous les filtres.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Chiffre d'affaires"
          value={loading ? "—" : formatCdf(salesSummary.totalSales)}
          hint="Factures payées · TTC"
          badge={periodLabel}
          icon={ShoppingBag}
          tone="primary"
          loading={loading}
        />
        <KpiCard
          label="Factures"
          value={salesSummary.invoiceCount}
          hint="Sur la période filtrée"
          badge={periodLabel}
          icon={TrendingUp}
          tone="info"
          loading={loading}
        />
        <KpiCard
          label="Valeur stock"
          value={loading ? "—" : formatCdf(valuation.totalValue)}
          hint={pointOfSaleId ? "Site sélectionné" : "Tous sites confondus"}
          badge="CDF"
          icon={Package}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Lignes filtrées"
          value={tableLoading ? "—" : linesMeta.total.toLocaleString("fr-FR")}
          hint={`${linesSummary.totalQuantity.toLocaleString("fr-FR")} unité(s) · ${formatCdf(linesSummary.totalAmount)}`}
          badge="Détail"
          icon={BarChart3}
          tone="violet"
          loading={tableLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <div className="xl:col-span-2 glass-card p-6">
          <h3 className="font-semibold mb-1">Ventes journalières</h3>
          <p className="text-xs text-[var(--muted)] mb-6">CA TTC par jour (factures payées)</p>
          {loading ? (
            <p className="text-sm text-[var(--muted)] py-12 text-center">Chargement...</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-12 text-center">
              Aucune vente sur cette période
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f8" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatCdf(Number(value ?? 0)), "CA"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  }}
                />
                <Bar dataKey="total" fill="#0d30f5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="font-semibold mb-1">Top produits</h3>
          <p className="text-xs text-[var(--muted)] mb-5">Par chiffre d'affaires</p>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Chargement...</p>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div
                  key={p.productId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg)]"
                >
                  <span className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">{p.quantity} vendu(s)</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {formatCdf(p.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card table-wrap p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-semibold">Détail des ventes</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {linesMeta.total.toLocaleString("fr-FR")} ligne(s) · {formatCdf(linesSummary.totalAmount)} ·{" "}
            {linesSummary.totalQuantity.toLocaleString("fr-FR")} unité(s)
          </p>
        </div>

        {tableLoading ? (
          <p className="p-6 text-sm text-[var(--muted)]">Chargement...</p>
        ) : salesLines.length === 0 ? (
          <p className="p-12 text-sm text-[var(--muted)] text-center">
            Aucune ligne de vente pour ces filtres
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Facture</th>
                <th>PDV</th>
                <th>Produit</th>
                <th className="text-right">Qté</th>
                <th className="text-right">Montant TTC</th>
                <th>Client</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {salesLines.map((line) => {
                const st = STATUS_LABELS[line.invoiceStatus] ?? {
                  label: line.invoiceStatus,
                  className: "badge-warn",
                };
                const displayDate =
                  line.invoiceStatus === "PAID" && line.paidAt
                    ? line.paidAt
                    : line.createdAt;

                return (
                  <tr key={line.id}>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">
                      {formatDateTime(displayDate)}
                    </td>
                    <td className="font-mono text-xs text-[var(--accent)]">{line.invoiceNumber}</td>
                    <td className="text-sm">{line.pointOfSale.code}</td>
                    <td>
                      <p className="text-sm font-medium">{line.productName}</p>
                      <p className="text-xs font-mono text-[var(--accent)] mt-0.5">{line.productSku}</p>
                    </td>
                    <td className="text-right tabular-nums">{line.quantity}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatCdf(line.lineTotalTtc)}
                    </td>
                    <td>
                      {line.customerName || line.customerPhone ? (
                        <div>
                          {line.customerName && (
                            <p className="text-sm font-medium">{line.customerName}</p>
                          )}
                          {line.customerPhone && (
                            <p className="text-xs text-[var(--muted)]">{line.customerPhone}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)] text-sm">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${st.className}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!tableLoading && linesMeta.total > 0 && (
          <TablePagination meta={linesMeta} onPageChange={setPage} disabled={tableLoading} />
        )}
      </div>
    </>
  );
}
