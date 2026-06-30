"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";

type Product = { id: string; sku: string; name: string };

type AdjustStockModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    productId: string;
    direction: "add" | "remove";
    quantity: string;
    reason: string;
  }) => Promise<void>;
  products: Product[];
  siteLabel?: string;
  loading?: boolean;
  error?: string;
};

const defaultForm: {
  productId: string;
  direction: "add" | "remove";
  quantity: string;
  reason: string;
} = {
  productId: "",
  direction: "add",
  quantity: "",
  reason: "Ajustement inventaire",
};

export function AdjustStockModal({
  open,
  onClose,
  onSubmit,
  products,
  siteLabel,
  loading,
  error,
}: AdjustStockModalProps) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (open) setForm(defaultForm);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustement stock"
      description={
        siteLabel
          ? `Corriger le stock sur « ${siteLabel} » (casse, erreur, inventaire physique…).`
          : "Correction manuelle du stock avec motif obligatoire."
      }
      size="md"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" form="adjust-stock-form" className="btn btn-primary" disabled={loading}>
            {loading ? "Enregistrement..." : "Valider l'ajustement"}
          </button>
        </div>
      }
    >
      <form id="adjust-stock-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <FormField label="Produit" required>
          <select
            className="input-field"
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            required
          >
            <option value="">— Sélectionner —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Sens" required>
            <select
              className="input-field"
              value={form.direction}
              onChange={(e) =>
                setForm({ ...form, direction: e.target.value as "add" | "remove" })
              }
            >
              <option value="add">Ajouter (+)</option>
              <option value="remove">Retirer (−)</option>
            </select>
          </FormField>

          <FormField label="Quantité" required>
            <input
              className="input-field"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </FormField>
        </div>

        <FormField label="Motif" required>
          <input
            className="input-field"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
            placeholder="Inventaire physique, casse, erreur..."
          />
        </FormField>
      </form>
    </Modal>
  );
}
