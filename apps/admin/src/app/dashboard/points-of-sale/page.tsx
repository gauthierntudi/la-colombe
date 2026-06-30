"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Power, PowerOff, Search, Trash2 } from "lucide-react";
import { apiFetch, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmModal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateArray } from "@/lib/pagination";
import {
  PointOfSaleModal,
  PointOfSaleFormData,
  POS_TYPE_LABELS,
  emptyPointOfSaleForm,
} from "@/components/points-of-sale/point-of-sale-modal";

type PointOfSale = {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  invoicePrefix: string;
  yocoPrintEnabled: boolean;
  yocoDeviceId: string | null;
};

type ConfirmAction = "deactivate" | "reactivate" | "delete" | null;

function siteToForm(site: PointOfSale): PointOfSaleFormData {
  return {
    code: site.code,
    name: site.name,
    type: site.type,
    address: site.address ?? "",
    phone: site.phone ?? "",
    invoicePrefix: site.invoicePrefix,
    yocoPrintEnabled: site.yocoPrintEnabled,
    yocoDeviceId: site.yocoDeviceId ?? "",
    active: site.active,
  };
}

function formToPayload(data: PointOfSaleFormData) {
  return {
    code: data.code.trim(),
    name: data.name.trim(),
    type: data.type,
    address: data.address.trim() || null,
    phone: data.phone.trim() || null,
    invoicePrefix: data.invoicePrefix.trim() || "FAC",
    yocoPrintEnabled: data.yocoPrintEnabled,
    yocoDeviceId: data.yocoDeviceId.trim() || null,
    active: data.active,
  };
}

export default function PointsOfSalePage() {
  const user = getUser()!;
  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingSite, setEditingSite] = useState<PointOfSale | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [targetSite, setTargetSite] = useState<PointOfSale | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await apiFetch<{ data: PointOfSale[] }>("/points-of-sale?active=all");
    let list = res.data;
    if (!showInactive) {
      list = list.filter((s) => s.active);
    }
    setSites(list);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, [showInactive]);

  useEffect(() => {
    setTablePage(1);
  }, [showInactive, search]);

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => {
      const typeLabel = (POS_TYPE_LABELS[s.type] ?? s.type).toLowerCase();
      return (
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        typeLabel.includes(q) ||
        s.invoicePrefix.toLowerCase().includes(q) ||
        (s.address?.toLowerCase().includes(q) ?? false) ||
        (s.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [sites, search]);

  const { data: pagedSites, meta: sitesTableMeta } = useMemo(
    () => paginateArray(filteredSites, tablePage),
    [filteredSites, tablePage]
  );

  function openCreate() {
    setModalMode("create");
    setEditingSite(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(site: PointOfSale) {
    setModalMode("edit");
    setEditingSite(site);
    setModalError("");
    setModalOpen(true);
  }

  async function handleSubmit(data: PointOfSaleFormData) {
    setSubmitLoading(true);
    setModalError("");
    try {
      await submitToast(
        (async () => {
          const payload = formToPayload(data);
          if (modalMode === "create") {
            const { active: _a, ...createPayload } = payload;
            await apiFetch("/points-of-sale", {
              method: "POST",
              body: JSON.stringify(createPayload),
            });
          } else if (editingSite) {
            await apiFetch(`/points-of-sale/${editingSite.id}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          }
        })(),
        {
          pending: "Enregistrement du site...",
          success: modalMode === "create" ? "Point de vente créé" : "Point de vente mis à jour",
        }
      );
      setModalOpen(false);
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleConfirm() {
    if (!targetSite || !confirmAction) return;
    setConfirmLoading(true);
    setError("");

    const toastByAction = {
      deactivate: { pending: "Désactivation...", success: "Point de vente désactivé" },
      reactivate: { pending: "Réactivation...", success: "Point de vente réactivé" },
      delete: { pending: "Suppression...", success: "Point de vente supprimé" },
    } as const;

    try {
      await submitToast(
        (async () => {
          if (confirmAction === "deactivate") {
            await apiFetch(`/points-of-sale/${targetSite.id}`, {
              method: "PUT",
              body: JSON.stringify({ active: false }),
            });
          } else if (confirmAction === "reactivate") {
            await apiFetch(`/points-of-sale/${targetSite.id}`, {
              method: "PUT",
              body: JSON.stringify({ active: true }),
            });
          } else if (confirmAction === "delete") {
            await apiFetch(`/points-of-sale/${targetSite.id}`, { method: "DELETE" });
          }
        })(),
        toastByAction[confirmAction]
      );
      setConfirmAction(null);
      setTargetSite(null);
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setConfirmLoading(false);
    }
  }

  function openConfirm(site: PointOfSale, action: ConfirmAction) {
    setTargetSite(site);
    setConfirmAction(action);
    setError("");
  }

  const activeCount = sites.filter((s) => s.active).length;

  const confirmConfig = {
    deactivate: {
      title: "Désactiver le point de vente",
      message: `Désactiver « ${targetSite?.name} » ? Il ne sera plus disponible pour les ventes et assignations.`,
      confirmLabel: "Désactiver",
      variant: "danger" as const,
    },
    reactivate: {
      title: "Réactiver le point de vente",
      message: `Réactiver « ${targetSite?.name} » ?`,
      confirmLabel: "Réactiver",
      variant: "primary" as const,
    },
    delete: {
      title: "Supprimer le point de vente",
      message: `Supprimer définitivement « ${targetSite?.name} » ? Irréversible. Les sites avec historique ne peuvent pas être supprimés.`,
      confirmLabel: "Supprimer",
      variant: "danger" as const,
    },
  };

  const confirm = confirmAction ? confirmConfig[confirmAction] : null;

  return (
    <>
      <DashboardHeader
        title="Points de vente"
        subtitle={
          search.trim()
            ? `${filteredSites.length} résultat(s) · ${activeCount} actif(s)`
            : `${sites.length} site(s) · ${activeCount} actif(s)`
        }
        user={user}
        actions={
          user.role === "ADMIN" ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Nouveau site
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
            placeholder="Code, nom, adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ToggleSwitch
          label="Afficher inactifs"
          checked={showInactive}
          onChange={setShowInactive}
        />
      </div>

      <div className="glass-card table-wrap p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-[var(--muted)] text-sm">Chargement...</p>
        ) : sites.length === 0 ? (
          <p className="p-12 text-center text-sm text-[var(--muted)]">Aucun point de vente trouvé</p>
        ) : filteredSites.length === 0 ? (
          <p className="p-12 text-center text-sm text-[var(--muted)]">
            Aucun point de vente ne correspond à la recherche
          </p>
        ) : (
          <>
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Préfixe</th>
                  <th>Yoco</th>
                  <th>Adresse</th>
                  {user.role === "ADMIN" && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pagedSites.map((s) => (
                  <tr key={s.id} className={!s.active ? "opacity-70" : ""}>
                    <td className="font-mono text-xs text-[var(--accent)]">{s.code}</td>
                    <td className="font-medium">{s.name}</td>
                    <td>
                      <span className={`badge ${s.type === "STORE" ? "badge-store" : "badge-depot"}`}>
                        {POS_TYPE_LABELS[s.type] ?? s.type}
                      </span>
                    </td>
                    <td>
                      {s.active ? (
                        <span className="badge badge-success">Actif</span>
                      ) : (
                        <span className="badge badge-warn">Inactif</span>
                      )}
                    </td>
                    <td>{s.invoicePrefix}</td>
                    <td>{s.yocoPrintEnabled ? <span className="badge badge-success">Oui</span> : "—"}</td>
                    <td className="text-[var(--muted)] text-sm">{s.address ?? "—"}</td>
                    {user.role === "ADMIN" && (
                      <td>
                        <div className="table-actions">
                          <IconButton
                            icon={Pencil}
                            title="Modifier"
                            variant="primary"
                            onClick={() => openEdit(s)}
                          />
                          {s.active && (
                            <IconButton
                              icon={PowerOff}
                              title="Désactiver"
                              variant="danger"
                              onClick={() => openConfirm(s, "deactivate")}
                            />
                          )}
                          {!s.active && (
                            <IconButton
                              icon={Power}
                              title="Réactiver"
                              variant="primary"
                              onClick={() => openConfirm(s, "reactivate")}
                            />
                          )}
                          <IconButton
                            icon={Trash2}
                            title="Supprimer"
                            variant="danger"
                            onClick={() => openConfirm(s, "delete")}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {sitesTableMeta.total > 0 && (
              <TablePagination meta={sitesTableMeta} onPageChange={setTablePage} disabled={loading} />
            )}
          </>
        )}
      </div>

      <PointOfSaleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initial={editingSite ? siteToForm(editingSite) : emptyPointOfSaleForm}
        mode={modalMode}
        loading={submitLoading}
        error={modalError}
      />

      {confirm && (
        <ConfirmModal
          open={!!confirmAction}
          onClose={() => {
            setConfirmAction(null);
            setTargetSite(null);
          }}
          onConfirm={handleConfirm}
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
          loading={confirmLoading}
        />
      )}
    </>
  );
}
