"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  ShoppingBag,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { apiFetch, formatCdf, getUser } from "@/lib/client-api";
import { DashboardHeader } from "@/components/dashboard/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  StockActivityChart,
  CategoryChart,
  SitesOverview,
} from "@/components/dashboard/charts";
import {
  LowStockAlerts,
  type LowStockAlertRow,
} from "@/components/dashboard/low-stock-alerts";
import {
  daysAgoIso,
  formatDisplayDate,
  todayIso,
} from "@/lib/date-utils";

const CATEGORY_COLORS = ["#0d30f5", "#f59e0b", "#10b981", "#8b5cf6"];

type DashboardSummary = {
  salesLast30Days: number;
  invoicesLast30Days: number;
  activeProducts: number;
  activeSites: number;
  lowStockAlerts: number;
  totalStockValue: number;
};

type StockActivityPoint = { month: string; entrees: number; sorties: number };
type PointOfSale = { id: string; code: string; name: string; type: string };

function buildFilterParams(pointOfSaleId: string, dateFrom: string, dateTo: string) {
  const params = new URLSearchParams();
  if (pointOfSaleId) params.set("pointOfSaleId", pointOfSaleId);
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);
  return params;
}

export default function DashboardPage() {
  const user = getUser()!;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stockActivity, setStockActivity] = useState<StockActivityPoint[]>([]);
  const [categories, setCategories] = useState<
    { name: string; value: number; color: string }[]
  >([]);
  const [siteStocks, setSiteStocks] = useState<
    { name: string; code: string; type: string; stock: number }[]
  >([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlertRow[]>([]);
  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [loading, setLoading] = useState(true);

  const [pointOfSaleId, setPointOfSaleId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(30));
  const [dateTo, setDateTo] = useState(todayIso);

  const selectedSite = sites.find((s) => s.id === pointOfSaleId);

  const periodLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      return `${formatDisplayDate(dateFrom)} — ${formatDisplayDate(dateTo)}`;
    }
    return undefined;
  }, [dateFrom, dateTo]);

  const periodBadge = useMemo(() => {
    if (selectedSite) return selectedSite.code;
    return "Période";
  }, [selectedSite]);

  const load = useCallback(async () => {
    setLoading(true);
    const filterParams = buildFilterParams(pointOfSaleId, dateFrom, dateTo);
    const filterQuery = filterParams.toString();
    const filterSuffix = filterQuery ? `&${filterQuery}` : "";

    try {
      const [summaryRes, activityRes, valuationRes, productsRes, alertsRes, sitesRes] =
        await Promise.all([
          apiFetch<DashboardSummary>(`/reports?type=summary${filterSuffix}`),
          apiFetch<{ data: StockActivityPoint[] }>("/reports?type=stock-activity"),
          apiFetch<{
            sites: { code: string; name: string; units: number }[];
            totalValue: number;
          }>(`/reports?type=inventory-valuation${pointOfSaleId ? `&pointOfSaleId=${pointOfSaleId}` : ""}`),
          apiFetch<{
            data: { category: { name: string } | null }[];
            meta: { total: number };
          }>("/products?limit=100"),
          apiFetch<{ data: LowStockAlertRow[] }>(
            `/reports?type=low-stock&limit=20${pointOfSaleId ? `&pointOfSaleId=${pointOfSaleId}` : ""}`
          ),
          apiFetch<{ data: PointOfSale[] }>("/points-of-sale"),
        ]);

      setSummary(summaryRes);
      setStockActivity(activityRes.data);
      setLowStockAlerts(alertsRes.data);
      setSites(sitesRes.data);

      const siteList = pointOfSaleId
        ? sitesRes.data.filter((s) => s.id === pointOfSaleId)
        : sitesRes.data;

      setSiteStocks(
        siteList.map((site) => {
          const val = valuationRes.sites.find((s) => s.code === site.code);
          return {
            name: site.name,
            code: site.code,
            type: site.type,
            stock: val?.units ?? 0,
          };
        })
      );

      const catCount: Record<string, number> = {};
      productsRes.data.forEach((p) => {
        const cat = p.category?.name ?? "Sans catégorie";
        catCount[cat] = (catCount[cat] ?? 0) + 1;
      });
      setCategories(
        Object.entries(catCount).map(([name, value], i) => ({
          name,
          value,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pointOfSaleId, dateFrom, dateTo]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  return (
    <>
      <DashboardHeader
        title="Tableau de bord"
        subtitle={periodLabel}
        user={user}
        filters={
          <>
            <select
              className="select-field min-w-[10.5rem] text-[0.8125rem] py-2"
              value={pointOfSaleId}
              onChange={(e) => setPointOfSaleId(e.target.value)}
              aria-label="Point de vente"
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
              max={dateTo || todayIso()}
              className="dashboard-header-date"
            />
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="Au"
              min={dateFrom}
              max={todayIso()}
              className="dashboard-header-date"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Chiffre d'affaires"
          value={summary ? formatCdf(summary.salesLast30Days) : "—"}
          hint={
            selectedSite
              ? `Factures payées · ${selectedSite.name}`
              : "Factures payées sur la période"
          }
          badge={periodBadge}
          icon={ShoppingBag}
          tone="primary"
          loading={loading}
        />
        <KpiCard
          label="Factures payées"
          value={summary?.invoicesLast30Days ?? "—"}
          hint={selectedSite ? selectedSite.code : "Sur la période sélectionnée"}
          badge={periodBadge}
          icon={Receipt}
          tone="info"
          loading={loading}
        />
        <KpiCard
          label="Valeur stock totale"
          value={summary ? formatCdf(summary.totalStockValue) : "—"}
          hint={
            selectedSite
              ? `${summary?.activeProducts ?? "—"} produits · ${selectedSite.name}`
              : `${summary?.activeProducts ?? "—"} produits · ${summary?.activeSites ?? "—"} sites`
          }
          badge={selectedSite ? selectedSite.code : "CDF"}
          icon={Package}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Alertes stock"
          value={summary?.lowStockAlerts ?? "—"}
          hint={
            summary && summary.lowStockAlerts > 0
              ? "Réapprovisionnement recommandé"
              : "Tous les seuils sont OK"
          }
          badge={summary && summary.lowStockAlerts > 0 ? "Seuil" : "OK"}
          icon={AlertTriangle}
          tone={summary && summary.lowStockAlerts > 0 ? "danger" : "violet"}
          loading={loading}
        />
      </div>

      {summary && summary.lowStockAlerts > 0 && (
        <div className="mb-6">
          <LowStockAlerts alerts={lowStockAlerts} loading={loading} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="xl:col-span-2">
          <StockActivityChart data={stockActivity} />
        </div>
        <CategoryChart categories={categories} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SitesOverview sites={siteStocks} />

        <div className="glass-card p-6">
          <h3 className="font-semibold mb-1">Accès rapide</h3>
          <p className="text-xs text-[var(--muted)] mb-5">Actions fréquentes</p>
          <div className="space-y-2">
            {[
              { href: "/dashboard/inventory", label: "Gérer l'inventaire", desc: "Entrées, transferts, ajustements" },
              { href: "/dashboard/invoices", label: "Consulter les factures", desc: "Suivi et annulations" },
              { href: "/dashboard/products", label: "Catalogue produits", desc: "Prix et catégories CDF" },
              { href: "/dashboard/points-of-sale", label: "Points de vente", desc: "Magasins & dépôts" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--accent-soft)] transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold group-hover:text-[var(--accent)]">
                    {item.label}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{item.desc}</p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors"
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
