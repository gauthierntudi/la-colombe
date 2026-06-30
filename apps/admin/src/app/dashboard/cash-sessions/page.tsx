"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Eye,
  Lock,
  Plus,
  Search,
  Unlock,
  Wallet,
} from "lucide-react";
import { apiFetch, formatCdf, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { IconButton } from "@/components/ui/icon-button";
import { UserAvatar } from "@/components/users/user-avatar";
import { TablePagination } from "@/components/ui/table-pagination";
import { DatePicker } from "@/components/ui/date-picker";
import { DEFAULT_PAGE_SIZE, EMPTY_PAGINATION, type PaginationMeta } from "@/lib/pagination";

type Session = {
  id: string;
  status: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashVariance: number | null;
  totalSales: number;
  invoiceCount: number;
  openedAt: string;
  closedAt: string | null;
  user: { name: string; avatarUrl: string | null };
  pointOfSale: { code: string; name: string };
};

type Site = { id: string; code: string; name: string; type: string };

type SessionsSummary = {
  openCount: number;
  closedCount: number;
  totalSales: number;
};

function formatSessionDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function CashSessionsPage() {
  const router = useRouter();
  const user = getUser()!;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [summary, setSummary] = useState<SessionsSummary>({
    openCount: 0,
    closedCount: 0,
    totalSales: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_PAGINATION);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [openSiteId, setOpenSiteId] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [openLoading, setOpenLoading] = useState(false);

  const [closeTarget, setCloseTarget] = useState<Session | null>(null);
  const [closingCash, setClosingCash] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);

  const canManage =
    user.role === "ADMIN" || user.role === "MANAGER" || user.role === "CAISSIER";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(DEFAULT_PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (siteFilter) params.set("pointOfSaleId", siteFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const [sessRes, sitesRes] = await Promise.all([
        apiFetch<{
          data: Session[];
          meta: PaginationMeta;
          summary: SessionsSummary;
        }>(`/cash-sessions?${params}`),
        apiFetch<{ data: Site[] }>("/points-of-sale"),
      ]);
      setSessions(sessRes.data);
      setMeta(sessRes.meta);
      setSummary(sessRes.summary);
      setSites(sitesRes.data.filter((s) => s.type === "STORE"));
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

  async function handleOpen() {
    setOpenLoading(true);
    setError("");
    try {
      await submitToast(
        apiFetch("/cash-sessions", {
          method: "POST",
          body: JSON.stringify({
            pointOfSaleId: openSiteId,
            openingCash: parseInt(openingCash, 10) || 0,
          }),
        }),
        {
          pending: "Ouverture de la session...",
          success: "Session caisse ouverte",
        }
      );
      setOpenModal(false);
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setOpenLoading(false);
    }
  }

  async function handleClose() {
    if (!closeTarget) return;
    setCloseLoading(true);
    try {
      await submitToast(
        apiFetch(`/cash-sessions/${closeTarget.id}/close`, {
          method: "POST",
          body: JSON.stringify({
            closingCash: parseInt(closingCash, 10) || 0,
          }),
        }),
        {
          pending: "Clôture de la session...",
          success: "Session caisse clôturée",
        }
      );
      setCloseTarget(null);
      setClosingCash("");
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setCloseLoading(false);
    }
  }

  return (
    <>
      <DashboardHeader
        title="Sessions caisse"
        subtitle={`${meta.total.toLocaleString("fr-FR")} session(s) · ${summary.openCount} ouverte(s)`}
        user={user}
        actions={
          canManage ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setOpenSiteId(siteFilter || (sites[0]?.id ?? ""));
                setOpeningCash("0");
                setOpenModal(true);
              }}
            >
              <Plus size={16} />
              Ouvrir une session
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Sessions"
          value={meta.total}
          hint="Selon les filtres actifs"
          badge="Total"
          icon={Wallet}
          tone="primary"
          loading={loading}
        />
        <KpiCard
          label="Ouvertes"
          value={summary.openCount}
          hint="Sessions en cours"
          badge="Live"
          icon={Unlock}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Clôturées"
          value={summary.closedCount}
          hint="Sur la période filtrée"
          badge="Fermées"
          icon={Lock}
          tone="violet"
          loading={loading}
        />
        <KpiCard
          label="Ventes caisse"
          value={loading ? "—" : formatCdf(summary.totalSales)}
          hint="Total TTC des sessions filtrées"
          badge="CDF"
          icon={Banknote}
          tone="info"
          loading={loading}
        />
      </div>

      <div className="filter-bar mb-5">
        <div className="filter-search flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="text-[var(--muted)] shrink-0" />
          <input
            placeholder="Caissier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-field min-w-[150px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="OPEN">Ouvertes</option>
          <option value="CLOSED">Clôturées</option>
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
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)]">
            <Wallet size={32} className="mx-auto opacity-30 mb-3" />
            <p className="text-sm">Aucune session trouvée</p>
            <p className="text-xs mt-1">Modifiez les filtres ou ouvrez une nouvelle session.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Caissier</th>
                <th>Site</th>
                <th>Ouverture</th>
                <th>Clôture</th>
                <th className="text-right">Fond</th>
                <th className="text-right">Ventes</th>
                <th>Statut</th>
                <th className="text-right">Écart</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-[var(--bg)]/80"
                  onClick={() => router.push(`/dashboard/cash-sessions/${s.id}`)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <UserAvatar src={s.user.avatarUrl} name={s.user.name} size="sm" />
                      <span className="font-medium">{s.user.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-[var(--accent)]">{s.pointOfSale.code}</span>
                    <p className="text-xs text-[var(--muted)] hidden sm:block">{s.pointOfSale.name}</p>
                  </td>
                  <td className="text-sm text-[var(--muted)] whitespace-nowrap">
                    {formatSessionDate(s.openedAt)}
                  </td>
                  <td className="text-sm text-[var(--muted)] whitespace-nowrap">
                    {s.closedAt ? formatSessionDate(s.closedAt) : "—"}
                  </td>
                  <td className="text-right tabular-nums">{formatCdf(s.openingCash)}</td>
                  <td className="text-right tabular-nums font-medium">
                    {formatCdf(s.totalSales)}
                    <span className="text-xs text-[var(--muted)] ml-1 font-normal">
                      ({s.invoiceCount})
                    </span>
                  </td>
                  <td>
                    {s.status === "OPEN" ? (
                      <span className="badge badge-success flex items-center gap-1 w-fit">
                        <Unlock size={11} /> Ouverte
                      </span>
                    ) : (
                      <span className="badge badge-warn flex items-center gap-1 w-fit">
                        <Lock size={11} /> Clôturée
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {s.cashVariance != null ? (
                      <span className={s.cashVariance !== 0 ? "text-[var(--warning)] font-medium" : ""}>
                        {formatCdf(s.cashVariance)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <IconButton
                        icon={Eye}
                        title="Voir le détail"
                        variant="primary"
                        onClick={() => router.push(`/dashboard/cash-sessions/${s.id}`)}
                      />
                      {canManage && s.status === "OPEN" && (
                        <IconButton
                          icon={Lock}
                          title="Clôturer la session"
                          variant="danger"
                          onClick={() => {
                            setCloseTarget(s);
                            setClosingCash("");
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && meta.total > 0 && (
          <TablePagination meta={meta} onPageChange={setPage} disabled={loading} />
        )}
      </div>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Ouvrir une session"
        description="Déclarez le fond de caisse avant d'encaisser les factures."
        size="sm"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenModal(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={openLoading || !openSiteId}
              onClick={handleOpen}
            >
              {openLoading ? "Ouverture..." : "Ouvrir la session"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Point de vente" required>
            <select
              className="select-field w-full"
              value={openSiteId}
              onChange={(e) => setOpenSiteId(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Fond de caisse (CDF)" hint="Montant en espèces au démarrage">
            <input
              type="number"
              min={0}
              className="input-field"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        title="Clôturer la session"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button type="button" className="btn btn-ghost" onClick={() => setCloseTarget(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleClose}
              disabled={closeLoading}
            >
              {closeLoading ? "Clôture..." : "Clôturer"}
            </button>
          </div>
        }
      >
        {closeTarget && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Session de {closeTarget.user.name} — {closeTarget.pointOfSale.code}
            </p>
            <FormField label="Espèces comptées (CDF)">
              <input
                type="number"
                min={0}
                className="input-field"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                autoFocus
              />
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
