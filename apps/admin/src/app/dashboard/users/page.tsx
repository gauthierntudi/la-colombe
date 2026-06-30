"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, UserCheck, UserX, Trash2 } from "lucide-react";
import { apiFetch, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmModal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { TablePagination } from "@/components/ui/table-pagination";
import { DEFAULT_PAGE_SIZE, EMPTY_PAGINATION, type PaginationMeta } from "@/lib/pagination";
import {
  UserModal,
  UserFormData,
  ROLE_LABELS,
} from "@/components/users/user-modal";
import { UserAvatar } from "@/components/users/user-avatar";

type UserRow = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  active: boolean;
  pointOfSales: { id: string; code: string; name: string; type: string }[];
};

type PointOfSale = { id: string; code: string; name: string; type: string };

type ConfirmAction = "deactivate" | "reactivate" | "delete" | null;

export default function UsersPage() {
  const currentUser = getUser()!;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [targetUser, setTargetUser] = useState<UserRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
      active: showInactive ? "all" : "true",
    });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);

    const [usersRes, sitesRes] = await Promise.all([
      apiFetch<{ data: UserRow[]; meta: PaginationMeta }>(`/users?${params}`),
      apiFetch<{ data: PointOfSale[] }>("/points-of-sale"),
    ]);

    setUsers(usersRes.data);
    setMeta(usersRes.meta);
    setSites(sitesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, showInactive]);

  useEffect(() => {
    load().catch(console.error);
  }, [search, roleFilter, showInactive, page]);

  function openCreate() {
    setModalMode("create");
    setEditingUser(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(user: UserRow) {
    setModalMode("edit");
    setEditingUser(user);
    setModalError("");
    setModalOpen(true);
  }

  function userToForm(user: UserRow): UserFormData {
    return {
      email: user.email,
      password: "",
      name: user.name,
      role: user.role,
      active: user.active,
      avatarUrl: user.avatarUrl ?? "",
      pointOfSaleIds: user.pointOfSales.map((p) => p.id),
    };
  }

  async function handleSubmit(data: UserFormData) {
    setSubmitLoading(true);
    setModalError("");
    try {
      await submitToast(
        (async () => {
          if (modalMode === "create") {
            await apiFetch("/users", {
              method: "POST",
              body: JSON.stringify({
                email: data.email,
                password: data.password,
                name: data.name,
                role: data.role,
                pointOfSaleIds: data.pointOfSaleIds,
                avatarUrl: data.avatarUrl?.trim() || null,
              }),
            });
          } else if (editingUser) {
            const payload: Record<string, unknown> = {
              email: data.email,
              name: data.name,
              role: data.role,
              active: data.active,
              pointOfSaleIds: data.pointOfSaleIds,
              avatarUrl: data.avatarUrl?.trim() || null,
            };
            if (data.password) payload.password = data.password;
            await apiFetch(`/users/${editingUser.id}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          }
        })(),
        {
          pending: "Enregistrement de l'utilisateur...",
          success:
            modalMode === "create"
              ? "Utilisateur créé avec succès"
              : "Utilisateur mis à jour",
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
    if (!targetUser || !confirmAction) return;
    setConfirmLoading(true);
    setActionError("");

    const toastByAction = {
      deactivate: {
        pending: "Désactivation...",
        success: "Utilisateur désactivé",
      },
      reactivate: {
        pending: "Réactivation...",
        success: "Utilisateur réactivé",
      },
      delete: {
        pending: "Suppression...",
        success: "Utilisateur supprimé",
      },
    } as const;

    try {
      await submitToast(
        (async () => {
          if (confirmAction === "deactivate") {
            await apiFetch(`/users/${targetUser.id}`, {
              method: "PUT",
              body: JSON.stringify({ active: false }),
            });
          } else if (confirmAction === "reactivate") {
            await apiFetch(`/users/${targetUser.id}`, {
              method: "PUT",
              body: JSON.stringify({ active: true }),
            });
          } else if (confirmAction === "delete") {
            await apiFetch(`/users/${targetUser.id}`, { method: "DELETE" });
          }
        })(),
        toastByAction[confirmAction]
      );
      setConfirmAction(null);
      setTargetUser(null);
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setConfirmLoading(false);
    }
  }

  function openConfirm(user: UserRow, action: ConfirmAction) {
    setTargetUser(user);
    setConfirmAction(action);
    setActionError("");
  }

  const isSelf = (u: UserRow) => u.id === currentUser.id;
  const activeCount = users.filter((u) => u.active).length;

  const confirmConfig = {
    deactivate: {
      title: "Désactiver l'utilisateur",
      message: `Désactiver « ${targetUser?.name} » ? Il ne pourra plus se connecter.`,
      confirmLabel: "Désactiver",
      variant: "danger" as const,
    },
    reactivate: {
      title: "Réactiver l'utilisateur",
      message: `Réactiver « ${targetUser?.name} » ? Il pourra à nouveau se connecter.`,
      confirmLabel: "Réactiver",
      variant: "primary" as const,
    },
    delete: {
      title: "Supprimer l'utilisateur",
      message: `Supprimer définitivement « ${targetUser?.name} » ? Cette action est irréversible. Les comptes avec historique ne peuvent pas être supprimés.`,
      confirmLabel: "Supprimer",
      variant: "danger" as const,
    },
  };

  const confirm = confirmAction ? confirmConfig[confirmAction] : null;

  return (
    <>
      <DashboardHeader
        title="Utilisateurs"
        subtitle={`${users.length} compte(s) · ${activeCount} actif(s)`}
        user={currentUser}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Nouvel utilisateur
          </button>
        }
      />

      {actionError && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="glass-card-flat p-3 flex items-center gap-3 flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="text-[var(--muted)] shrink-0" />
          <input
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[var(--muted)]"
            placeholder="Rechercher nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-field min-w-[160px]"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ToggleSwitch
          label="Afficher inactifs"
          checked={showInactive}
          onChange={setShowInactive}
        />
      </div>

      <div className="glass-card table-wrap p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-[var(--muted)] text-sm">Chargement...</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Sites assignés</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={!u.active ? "opacity-70" : ""}>
                  <td>
                    <div className="flex items-center gap-3">
                      <UserAvatar src={u.avatarUrl} name={u.name} size="sm" />
                      <div>
                        <p className="font-medium">
                          {u.name}
                          {isSelf(u) && (
                            <span className="ml-1.5 text-[10px] text-[var(--muted)]">(vous)</span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-store">{ROLE_LABELS[u.role] ?? u.role}</span>
                  </td>
                  <td>
                    {u.pointOfSales.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.pointOfSales.map((p) => (
                          <span
                            key={p.id}
                            className="text-xs bg-[var(--bg)] px-2 py-0.5 rounded-md text-[var(--text-secondary)]"
                          >
                            {p.code}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--muted)] text-sm">—</span>
                    )}
                  </td>
                  <td>
                    {u.active ? (
                      <span className="badge badge-success flex items-center gap-1 w-fit">
                        <UserCheck size={11} /> Actif
                      </span>
                    ) : (
                      <span className="badge badge-warn flex items-center gap-1 w-fit">
                        <UserX size={11} /> Inactif
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <IconButton
                        icon={Pencil}
                        title="Modifier"
                        variant="primary"
                        onClick={() => openEdit(u)}
                      />
                      {u.active && !isSelf(u) && (
                        <IconButton
                          icon={UserX}
                          title="Désactiver"
                          variant="danger"
                          onClick={() => openConfirm(u, "deactivate")}
                        />
                      )}
                      {!u.active && (
                        <IconButton
                          icon={UserCheck}
                          title="Réactiver"
                          variant="primary"
                          onClick={() => openConfirm(u, "reactivate")}
                        />
                      )}
                      {!isSelf(u) && (
                        <IconButton
                          icon={Trash2}
                          title="Supprimer"
                          variant="danger"
                          onClick={() => openConfirm(u, "delete")}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-[var(--muted)] py-12">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {!loading && meta.total > 0 && (
          <TablePagination meta={meta} onPageChange={setPage} disabled={loading} />
        )}
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        pointsOfSale={sites}
        initial={editingUser ? userToForm(editingUser) : undefined}
        mode={modalMode}
        editingUserId={editingUser?.id}
        loading={submitLoading}
        error={modalError}
      />

      {confirm && (
        <ConfirmModal
          open={!!confirmAction}
          onClose={() => {
            setConfirmAction(null);
            setTargetUser(null);
            setActionError("");
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
