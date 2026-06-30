"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Tags, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { apiFetch, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmModal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateArray } from "@/lib/pagination";
import {
  CategoryModal,
  CategoryFormData,
  emptyCategoryForm,
} from "@/components/categories/category-modal";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

type ConfirmAction = "deactivate" | "reactivate" | "delete" | null;

function categoryToForm(cat: Category): CategoryFormData {
  return {
    name: cat.name,
    sortOrder: cat.sortOrder,
    active: cat.active,
  };
}

export default function CategoriesPage() {
  const user = getUser()!;
  const [categories, setCategories] = useState<Category[]>([]);
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [targetCategory, setTargetCategory] = useState<Category | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    const res = await apiFetch<{ data: Category[] }>("/categories?active=all");
    let list = res.data;
    if (!showInactive) {
      list = list.filter((c) => c.active);
    }
    setCategories(list);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
  }, [showInactive]);

  useEffect(() => {
    setPage(1);
  }, [showInactive]);

  const { data: pagedCategories, meta: categoriesMeta } = useMemo(
    () => paginateArray(categories, page),
    [categories, page]
  );

  function openCreate() {
    setModalMode("create");
    setEditingCategory(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(cat: Category) {
    setModalMode("edit");
    setEditingCategory(cat);
    setModalError("");
    setModalOpen(true);
  }

  async function handleSubmit(data: CategoryFormData) {
    setSubmitLoading(true);
    setModalError("");
    try {
      await submitToast(
        (async () => {
          if (modalMode === "create") {
            await apiFetch("/categories", {
              method: "POST",
              body: JSON.stringify({
                name: data.name.trim(),
                sortOrder: data.sortOrder,
              }),
            });
          } else if (editingCategory) {
            await apiFetch(`/categories/${editingCategory.id}`, {
              method: "PUT",
              body: JSON.stringify({
                name: data.name.trim(),
                sortOrder: data.sortOrder,
                active: data.active,
              }),
            });
          }
        })(),
        {
          pending: "Enregistrement de la catégorie...",
          success:
            modalMode === "create" ? "Catégorie créée" : "Catégorie mise à jour",
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
    if (!targetCategory || !confirmAction) return;
    setConfirmLoading(true);
    setError("");

    const toastByAction = {
      deactivate: { pending: "Désactivation...", success: "Catégorie désactivée" },
      reactivate: { pending: "Réactivation...", success: "Catégorie réactivée" },
      delete: { pending: "Suppression...", success: "Catégorie supprimée" },
    } as const;

    try {
      await submitToast(
        (async () => {
          if (confirmAction === "deactivate") {
            await apiFetch(`/categories/${targetCategory.id}`, {
              method: "PUT",
              body: JSON.stringify({ active: false }),
            });
          } else if (confirmAction === "reactivate") {
            await apiFetch(`/categories/${targetCategory.id}`, {
              method: "PUT",
              body: JSON.stringify({ active: true }),
            });
          } else if (confirmAction === "delete") {
            await apiFetch(`/categories/${targetCategory.id}`, { method: "DELETE" });
          }
        })(),
        toastByAction[confirmAction]
      );
      setConfirmAction(null);
      setTargetCategory(null);
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setConfirmLoading(false);
    }
  }

  function openConfirm(cat: Category, action: ConfirmAction) {
    setTargetCategory(cat);
    setConfirmAction(action);
    setError("");
  }

  const activeCount = categories.filter((c) => c.active).length;

  const confirmConfig = {
    deactivate: {
      title: "Désactiver la catégorie",
      message: `Désactiver « ${targetCategory?.name} » ? Elle ne sera plus proposée lors de la création de produits.`,
      confirmLabel: "Désactiver",
      variant: "danger" as const,
    },
    reactivate: {
      title: "Réactiver la catégorie",
      message: `Réactiver « ${targetCategory?.name} » ?`,
      confirmLabel: "Réactiver",
      variant: "primary" as const,
    },
    delete: {
      title: "Supprimer la catégorie",
      message: `Supprimer définitivement « ${targetCategory?.name} » ? Seules les catégories sans produits peuvent être supprimées.`,
      confirmLabel: "Supprimer",
      variant: "danger" as const,
    },
  };

  const confirm = confirmAction ? confirmConfig[confirmAction] : null;

  return (
    <>
      <DashboardHeader
        title="Catégories"
        subtitle={`${categories.length} catégorie(s) · ${activeCount} active(s)`}
        user={user}
        actions={
          user.role === "ADMIN" ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Nouvelle catégorie
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <ToggleSwitch
          label="Afficher inactives"
          checked={showInactive}
          onChange={setShowInactive}
        />
      </div>

      <div className="glass-card table-wrap p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-[var(--muted)] text-sm">Chargement...</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-[var(--muted)] text-sm text-center">
            Aucune catégorie trouvée
          </p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Ordre</th>
                <th>Produits</th>
                <th>Statut</th>
                {user.role === "ADMIN" && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pagedCategories.map((c) => (
                <tr key={c.id} className={!c.active ? "opacity-70" : ""}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] shrink-0">
                        <Tags size={14} />
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="text-[var(--muted)]">{c.sortOrder}</td>
                  <td>
                    <span className="badge badge-store">{c.productCount}</span>
                  </td>
                  <td>
                    {c.active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-warn">Inactive</span>
                    )}
                  </td>
                  {user.role === "ADMIN" && (
                    <td>
                      <div className="table-actions">
                        <IconButton
                          icon={Pencil}
                          title="Modifier"
                          variant="primary"
                          onClick={() => openEdit(c)}
                        />
                        {c.active && (
                          <IconButton
                            icon={PowerOff}
                            title="Désactiver"
                            variant="danger"
                            onClick={() => openConfirm(c, "deactivate")}
                          />
                        )}
                        {!c.active && (
                          <IconButton
                            icon={Power}
                            title="Réactiver"
                            variant="primary"
                            onClick={() => openConfirm(c, "reactivate")}
                          />
                        )}
                        <IconButton
                          icon={Trash2}
                          title="Supprimer"
                          variant="danger"
                          onClick={() => openConfirm(c, "delete")}
                          disabled={c.productCount > 0}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && categoriesMeta.total > 0 && (
          <TablePagination meta={categoriesMeta} onPageChange={setPage} disabled={loading} />
        )}
      </div>

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        initial={editingCategory ? categoryToForm(editingCategory) : emptyCategoryForm}
        mode={modalMode}
        loading={submitLoading}
        error={modalError}
      />

      {confirm && (
        <ConfirmModal
          open={!!confirmAction}
          onClose={() => {
            setConfirmAction(null);
            setTargetCategory(null);
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
