"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { AvatarUploadField } from "@/components/users/avatar-upload-field";
import { PointOfSalePicker } from "@/components/users/point-of-sale-picker";

const ROLES = [
  { value: "ADMIN", label: "Administrateur" },
  { value: "MANAGER", label: "Manager" },
  { value: "FACTURANT", label: "Facturant" },
  { value: "CAISSIER", label: "Caissier" },
] as const;

export type UserFormData = {
  email: string;
  password: string;
  name: string;
  role: string;
  active: boolean;
  avatarUrl: string;
  pointOfSaleIds: string[];
};

export const emptyUserForm: UserFormData = {
  email: "",
  password: "",
  name: "",
  role: "FACTURANT",
  active: true,
  avatarUrl: "",
  pointOfSaleIds: [],
};

type PointOfSale = { id: string; code: string; name: string; type: string };

type UserModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  pointsOfSale: PointOfSale[];
  initial?: UserFormData;
  mode: "create" | "edit";
  editingUserId?: string;
  loading?: boolean;
  error?: string;
};

export function UserModal({
  open,
  onClose,
  onSubmit,
  pointsOfSale,
  initial,
  mode,
  editingUserId,
  loading,
  error,
}: UserModalProps) {
  const [form, setForm] = useState<UserFormData>(emptyUserForm);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(initial ?? emptyUserForm);
    }
    wasOpen.current = open;
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  const needsSites = form.role === "FACTURANT" || form.role === "CAISSIER" || form.role === "MANAGER";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nouvel utilisateur" : "Modifier l'utilisateur"}
      description={
        mode === "create"
          ? "Créez un compte et assignez les points de vente."
          : "Mettez à jour le profil et les accès."
      }
      size="lg"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="submit"
            form="user-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Enregistrement..." : mode === "create" ? "Créer le compte" : "Enregistrer"}
          </button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <AvatarUploadField
          value={form.avatarUrl}
          name={form.name || "Utilisateur"}
          onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
          userId={mode === "edit" ? editingUserId : undefined}
          persist={mode === "edit"}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nom complet" required>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Jean Dupont"
            />
          </FormField>

          <FormField label="Email" required>
            <input
              className="input-field"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="user@ges.local"
            />
          </FormField>

          <FormField
            label={mode === "create" ? "Mot de passe" : "Nouveau mot de passe"}
            required={mode === "create"}
            hint={mode === "edit" ? "Laisser vide pour ne pas changer" : "Minimum 6 caractères"}
          >
            <input
              className="input-field"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={mode === "create"}
              minLength={mode === "create" ? 6 : undefined}
              placeholder="••••••••"
            />
          </FormField>

          <FormField label="Rôle" required>
            <select
              className="input-field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormField>

          {mode === "edit" && (
            <FormField label="Statut du compte">
              <select
                className="input-field"
                value={form.active ? "true" : "false"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
              >
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </FormField>
          )}
        </div>

        {needsSites && (
          <FormField
            label="Points de vente assignés"
            hint="Recherchez et sélectionnez les sites accessibles par cet utilisateur"
          >
            <PointOfSalePicker
              key={mode === "edit" ? editingUserId : "create"}
              sites={pointsOfSale}
              value={form.pointOfSaleIds}
              onChange={(pointOfSaleIds) => setForm((f) => ({ ...f, pointOfSaleIds }))}
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  FACTURANT: "Facturant",
  CAISSIER: "Caissier",
};
