"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";

type Product = { id: string; sku: string; name: string };
type Site = { id: string; code: string; name: string; type: string };

type TransferLine = { productId: string; quantity: string };

type TransferStockModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fromId: string;
    toId: string;
    lines: TransferLine[];
    notes: string;
  }) => Promise<void>;
  products: Product[];
  sites: Site[];
  loading?: boolean;
  error?: string;
};

const emptyLine = (): TransferLine => ({ productId: "", quantity: "" });

export function TransferStockModal({
  open,
  onClose,
  onSubmit,
  products,
  sites,
  loading,
  error,
}: TransferStockModalProps) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([emptyLine()]);
  const [notes, setNotes] = useState("Réapprovisionnement magasin");

  useEffect(() => {
    if (open) {
      const depot = sites.find((s) => s.type === "DEPOT");
      const store = sites.find((s) => s.type === "STORE");
      setFromId(depot?.id ?? sites[0]?.id ?? "");
      setToId(store?.id ?? sites[1]?.id ?? "");
      setLines([emptyLine()]);
      setNotes("Réapprovisionnement magasin");
    }
  }, [open, sites]);

  function updateLine(index: number, patch: Partial<TransferLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({ fromId, toId, lines, notes });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfert de stock"
      description="Déplacer des produits d'un site source vers une destination (dépôt → magasin)."
      size="lg"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" form="transfer-stock-form" className="btn btn-primary" disabled={loading}>
            {loading ? "Transfert..." : "Valider le transfert"}
          </button>
        </div>
      }
    >
      <form id="transfer-stock-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Source" required>
            <select
              className="input-field"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              required
            >
              <option value="">— Site source —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.type})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Destination" required>
            <select
              className="input-field"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              required
            >
              <option value="">— Destination —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.type})
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Lignes de transfert</p>
            <button type="button" className="btn btn-ghost text-xs" onClick={addLine}>
              <Plus size={14} />
              Ajouter une ligne
            </button>
          </div>

          {lines.map((line, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="form-field flex-1">
                {index === 0 && <label className="form-label">Produit</label>}
                <select
                  className="input-field"
                  value={line.productId}
                  onChange={(e) => updateLine(index, { productId: e.target.value })}
                  required
                >
                  <option value="">— Produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field w-24">
                {index === 0 && <label className="form-label">Qté</label>}
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  required
                />
              </div>
              <button
                type="button"
                className="icon-btn btn-circle-danger mb-0.5"
                onClick={() => removeLine(index)}
                disabled={lines.length <= 1}
                title="Supprimer la ligne"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <FormField label="Notes">
          <input
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motif du transfert"
          />
        </FormField>
      </form>
    </Modal>
  );
}
