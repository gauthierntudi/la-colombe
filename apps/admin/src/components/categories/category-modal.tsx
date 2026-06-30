"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";

export type CategoryFormData = {
  name: string;
  sortOrder: number;
  active: boolean;
};

export const emptyCategoryForm: CategoryFormData = {
  name: "",
  sortOrder: 0,
  active: true,
};

type CategoryModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  initial?: CategoryFormData;
  mode: "create" | "edit";
  loading?: boolean;
  error?: string;
};

export function CategoryModal({
  open,
  onClose,
  onSubmit,
  initial,
  mode,
  loading,
  error,
}: CategoryModalProps) {
  const [form, setForm] = useState<CategoryFormData>(emptyCategoryForm);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(initial ?? emptyCategoryForm);
    }
    wasOpen.current = open;
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  function set<K extends keyof CategoryFormData>(key: K, value: CategoryFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nouvelle catégorie" : "Modifier la catégorie"}
      description={
        mode === "create"
          ? "Ajoutez une catégorie pour classer vos produits."
          : "Mettez à jour le nom ou l'ordre d'affichage."
      }
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="submit"
            form="category-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <FormField label="Nom" required>
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            placeholder="Ex: Électronique, Alimentation..."
          />
        </FormField>

        <FormField label="Ordre d'affichage" hint="Plus petit = affiché en premier">
          <input
            type="number"
            min={0}
            className="input-field"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", parseInt(e.target.value, 10) || 0)}
          />
        </FormField>

        {mode === "edit" && (
          <FormField label="Statut">
            <select
              className="input-field"
              value={form.active ? "true" : "false"}
              onChange={(e) => set("active", e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
        )}
      </form>
    </Modal>
  );
}
