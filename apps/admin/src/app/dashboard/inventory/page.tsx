"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  History,
  Lock,
  MapPin,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";
import { apiFetch, formatCdf, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { DEFAULT_PAGE_SIZE, EMPTY_PAGINATION, paginateArray, type PaginationMeta } from "@/lib/pagination";
import { ReceiveStockModal } from "@/components/inventory/receive-stock-modal";
import { AdjustStockModal } from "@/components/inventory/adjust-stock-modal";
import { TransferStockModal } from "@/components/inventory/transfer-stock-modal";

type PointOfSale = { id: string; code: string; name: string; type: string };
type InventoryRow = {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  unitPrice: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  minStockLevel: number;
  belowMin: boolean;
};

type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { sku: string; name: string };
  pointOfSale: { code: string; name: string };
  user: { name: string } | null;
};

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_IN: "Réception",
  ADJUSTMENT: "Ajustement",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  SALE_OUT: "Vente",
  RESERVATION: "Réservation",
  RELEASE_RESERVATION: "Libération",
  RETURN: "Retour",
};

function StockLevelBar({
  available,
  min,
  belowMin,
}: {
  available: number;
  min: number;
  belowMin: boolean;
}) {
  const target = Math.max(min * 2, min, 1);
  const pct = Math.min(100, Math.round((available / target) * 100));

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            belowMin ? "bg-[var(--warning)]" : "bg-[var(--success)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[var(--muted)] w-8 text-right">{available}</span>
    </div>
  );
}

function formatMovementDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function InventoryPage() {
  const user = getUser()!;
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; sku: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(searchParams.get("alerts") === "1");
  const [showMovements, setShowMovements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsMeta, setMovementsMeta] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const canManage = user.role === "ADMIN" || user.role === "MANAGER";

  useEffect(() => {
    apiFetch<{ data: PointOfSale[] }>("/points-of-sale?active=all")
      .then((res) => {
        setSites(res.data);
        const siteCode = searchParams.get("site");
        const fromUrl = siteCode
          ? res.data.find((s) => s.code === siteCode)
          : undefined;
        if (fromUrl) {
          setSiteId(fromUrl.id);
        } else if (res.data[0]) {
          setSiteId(res.data[0].id);
        }
      })
      .catch(console.error);
  }, [searchParams]);

  useEffect(() => {
    apiFetch<{ data: { id: string; sku: string; name: string }[] }>("/products?limit=100&active=all")
      .then((res) => setAllProducts(res.data))
      .catch(console.error);
  }, []);

  async function loadInventory() {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: InventoryRow[] }>(
        `/inventory?pointOfSaleId=${siteId}&search=${encodeURIComponent(search)}`
      );
      setRows(res.data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements() {
    if (!siteId) return;
    setMovementsLoading(true);
    try {
      const params = new URLSearchParams({
        pointOfSaleId: siteId,
        page: String(movementsPage),
        limit: String(DEFAULT_PAGE_SIZE),
      });
      if (movementDateFrom) params.set("from", movementDateFrom);
      if (movementDateTo) params.set("to", movementDateTo);
      const res = await apiFetch<{ data: Movement[]; meta: PaginationMeta }>(
        `/inventory/movements?${params}`
      );
      setMovements(res.data);
      setMovementsMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => {
    setInventoryPage(1);
  }, [siteId, search, alertsOnly]);

  useEffect(() => {
    setMovementsPage(1);
  }, [siteId, showMovements, movementDateFrom, movementDateTo]);

  useEffect(() => {
    loadInventory().catch(console.error);
    if (showMovements) loadMovements().catch(console.error);
  }, [siteId, search, showMovements]);

  useEffect(() => {
    if (showMovements) loadMovements().catch(console.error);
  }, [movementsPage, movementDateFrom, movementDateTo]);

  const selectedSite = sites.find((s) => s.id === siteId);

  const displayedRows = useMemo(
    () => (alertsOnly ? rows.filter((r) => r.belowMin) : rows),
    [rows, alertsOnly]
  );

  const { data: pagedRows, meta: inventoryMeta } = useMemo(
    () => paginateArray(displayedRows, inventoryPage),
    [displayedRows, inventoryPage]
  );

  const stats = useMemo(() => {
    const totalAvailable = rows.reduce((s, r) => s + r.availableStock, 0);
    const totalReserved = rows.reduce((s, r) => s + r.reservedStock, 0);
    const totalValue = rows.reduce((s, r) => s + r.availableStock * r.unitPrice, 0);
    const belowMin = rows.filter((r) => r.belowMin).length;
    return { totalAvailable, totalReserved, totalValue, belowMin };
  }, [rows]);

  async function afterStockAction() {
    await loadInventory();
    if (showMovements) await loadMovements();
  }

  async function handleReceive(data: {
    productId: string;
    quantity: string;
    reason: string;
  }) {
    setActionLoading(true);
    setActionError("");
    try {
      await submitToast(
        apiFetch("/inventory/receive", {
          method: "POST",
          body: JSON.stringify({
            pointOfSaleId: siteId,
            productId: data.productId,
            quantity: parseInt(data.quantity, 10),
            reason: data.reason || "Réception stock",
          }),
        }),
        {
          pending: "Enregistrement de l'entrée...",
          success: "Entrée de stock enregistrée",
        }
      );
      setReceiveOpen(false);
      await afterStockAction();
    } catch {
      /* toast affiché */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdjust(data: {
    productId: string;
    direction: "add" | "remove";
    quantity: string;
    reason: string;
  }) {
    setActionLoading(true);
    setActionError("");
    try {
      const qty = parseInt(data.quantity, 10);
      await submitToast(
        apiFetch("/inventory/adjust", {
          method: "POST",
          body: JSON.stringify({
            pointOfSaleId: siteId,
            productId: data.productId,
            quantity: data.direction === "remove" ? -qty : qty,
            reason: data.reason,
          }),
        }),
        {
          pending: "Enregistrement de l'ajustement...",
          success: "Ajustement enregistré",
        }
      );
      setAdjustOpen(false);
      await afterStockAction();
    } catch {
      /* toast affiché */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransfer(data: {
    fromId: string;
    toId: string;
    lines: { productId: string; quantity: string }[];
    notes: string;
  }) {
    setActionLoading(true);
    setActionError("");
    try {
      await submitToast(
        apiFetch("/inventory/transfer", {
          method: "POST",
          body: JSON.stringify({
            fromId: data.fromId,
            toId: data.toId,
            notes: data.notes,
            lines: data.lines.map((l) => ({
              productId: l.productId,
              quantity: parseInt(l.quantity, 10),
            })),
          }),
        }),
        {
          pending: "Transfert en cours...",
          success: "Transfert effectué avec succès",
        }
      );
      setTransferOpen(false);
      await afterStockAction();
    } catch {
      /* toast affiché */
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <DashboardHeader
        title="Inventaire"
        subtitle={
          selectedSite
            ? `${selectedSite.name} · ${selectedSite.code}`
            : "Stock par point de vente"
        }
        user={user}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setActionError("");
                  setAdjustOpen(true);
                }}
              >
                <SlidersHorizontal size={16} />
                Ajustement
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setActionError("");
                  setTransferOpen(true);
                }}
              >
                <ArrowLeftRight size={16} />
                Transfert
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setActionError("");
                  setReceiveOpen(true);
                }}
              >
                <PackagePlus size={16} />
                Entrée stock
              </button>
            </div>
          ) : undefined
        }
      />

      {message && (
        <div
          className={`text-sm rounded-xl px-4 py-3 mb-4 ${
            messageType === "error"
              ? "text-[var(--danger)] bg-[var(--danger-soft)]"
              : "text-[var(--success)] bg-[var(--success-soft)]"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Références en stock"
          value={rows.length}
          hint={selectedSite ? `Site ${selectedSite.code}` : "Tous les sites"}
          badge="Refs"
          icon={Boxes}
          tone="violet"
          loading={loading}
        />
        <KpiCard
          label="Unités disponibles"
          value={stats.totalAvailable.toLocaleString("fr-FR")}
          hint="Prêtes à la vente"
          badge="Dispo"
          icon={Warehouse}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Unités réservées"
          value={stats.totalReserved.toLocaleString("fr-FR")}
          hint="Factures en cours"
          badge="Réserv."
          icon={Lock}
          tone="warning"
          loading={loading}
        />
        <KpiCard
          label="Alertes seuil"
          value={stats.belowMin}
          hint={
            stats.belowMin > 0
              ? "Sous le stock minimum"
              : "Aucune rupture imminente"
          }
          badge={stats.belowMin > 0 ? "Seuil" : "OK"}
          icon={AlertTriangle}
          tone={stats.belowMin > 0 ? "danger" : "neutral"}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 min-w-[220px]">
          <MapPin size={16} className="text-[var(--muted)] shrink-0" />
          <select
            className="select-field min-w-[200px] flex-1"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="glass-card-flat p-3 flex items-center gap-3 flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="text-[var(--muted)] shrink-0" />
          <input
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[var(--muted)]"
            placeholder="Rechercher SKU, nom, code-barres..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ToggleSwitch label="Alertes seulement" checked={alertsOnly} onChange={setAlertsOnly} />
        <ToggleSwitch
          label="Historique mouvements"
          checked={showMovements}
          onChange={setShowMovements}
        />
      </div>

      {selectedSite && !loading && stats.totalValue > 0 && (
        <p className="text-sm text-[var(--muted)] mb-4">
          Valeur stock disponible estimée :{" "}
          <span className="font-semibold text-[var(--text)]">{formatCdf(stats.totalValue)}</span>
        </p>
      )}

      <div className="glass-card table-wrap p-0 overflow-hidden mb-6">
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)]">Chargement de l'inventaire...</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th className="text-right">Physique</th>
                <th className="text-right">Réservé</th>
                <th>Disponible</th>
                <th className="text-right">Seuil min.</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.productId} className={r.belowMin ? "bg-[var(--warning-soft)]/40" : ""}>
                  <td>
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs font-mono text-[var(--accent)] mt-0.5">{r.sku}</p>
                    </div>
                  </td>
                  <td>
                    {r.category ? (
                      <span className="text-xs bg-[var(--bg)] px-2 py-0.5 rounded-md text-[var(--text-secondary)]">
                        {r.category}
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{r.physicalStock}</td>
                  <td className="text-right tabular-nums text-[var(--muted)]">
                    {r.reservedStock > 0 ? r.reservedStock : "—"}
                  </td>
                  <td>
                    <StockLevelBar
                      available={r.availableStock}
                      min={r.minStockLevel}
                      belowMin={r.belowMin}
                    />
                  </td>
                  <td className="text-right tabular-nums text-[var(--muted)]">{r.minStockLevel}</td>
                  <td>
                    {r.belowMin ? (
                      <span className="badge badge-warn flex items-center gap-1 w-fit">
                        <AlertTriangle size={11} />
                        Sous seuil
                      </span>
                    ) : (
                      <span className="badge badge-success w-fit">OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {displayedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
                      <Warehouse size={32} className="opacity-40" />
                      <p className="text-sm">
                        {alertsOnly
                          ? "Aucune alerte de stock sur ce site"
                          : "Aucun stock enregistré sur ce site"}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {!loading && inventoryMeta.total > 0 && (
          <TablePagination
            meta={inventoryMeta}
            onPageChange={setInventoryPage}
            disabled={loading}
          />
        )}
      </div>

      {showMovements && (
        <div className="glass-card table-wrap p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-light)] flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[var(--accent)]" />
              <h3 className="font-semibold text-sm">Mouvements de stock</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <DatePicker
                label="Du"
                value={movementDateFrom}
                onChange={setMovementDateFrom}
                max={movementDateTo || undefined}
                clearable
                className="min-w-[11rem]"
              />
              <DatePicker
                label="Au"
                value={movementDateTo}
                onChange={setMovementDateTo}
                min={movementDateFrom || undefined}
                clearable
                className="min-w-[11rem]"
              />
            </div>
          </div>
          {movementsLoading ? (
            <p className="p-6 text-sm text-[var(--muted)]">Chargement...</p>
          ) : movementsMeta.total === 0 ? (
            <p className="p-6 text-sm text-[var(--muted)] text-center">Aucun mouvement enregistré</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Produit</th>
                  <th className="text-right">Qté</th>
                  <th>Motif</th>
                  <th>Par</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs text-[var(--muted)] whitespace-nowrap">
                      {formatMovementDate(m.createdAt)}
                    </td>
                    <td>
                      <span className="badge badge-store text-[10px]">
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                      </span>
                    </td>
                    <td>
                      <p className="text-sm font-medium">{m.product.name}</p>
                      <p className="text-xs font-mono text-[var(--muted)]">{m.product.sku}</p>
                    </td>
                    <td
                      className={`text-right tabular-nums font-medium ${
                        m.quantity > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="text-sm text-[var(--muted)] max-w-[200px] truncate">
                      {m.reason ?? "—"}
                    </td>
                    <td className="text-sm text-[var(--muted)]">{m.user?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!movementsLoading && movementsMeta.total > 0 && (
            <TablePagination
              meta={movementsMeta}
              onPageChange={setMovementsPage}
              disabled={movementsLoading}
            />
          )}
        </div>
      )}

      <ReceiveStockModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onSubmit={handleReceive}
        products={allProducts}
        siteLabel={selectedSite?.name}
        loading={actionLoading}
        error={actionError}
      />

      <AdjustStockModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onSubmit={handleAdjust}
        products={allProducts}
        siteLabel={selectedSite?.name}
        loading={actionLoading}
        error={actionError}
      />

      <TransferStockModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSubmit={handleTransfer}
        products={allProducts}
        sites={sites}
        loading={actionLoading}
        error={actionError}
      />
    </>
  );
}
