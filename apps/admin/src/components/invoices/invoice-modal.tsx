"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { formatCdf } from "@/lib/client-api";

type Site = { id: string; code: string; name: string; type: string };
type Product = { id: string; sku: string; name: string; unitPrice: number };

type Line = { productId: string; quantity: string };

export type InvoiceFormResult = {
  pointOfSaleId: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  validateImmediately: boolean;
  lines: { productId: string; quantity: number; unitPrice: number }[];
};

type InvoiceModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InvoiceFormResult) => Promise<void>;
  sites: Site[];
  products: Product[];
  loading?: boolean;
  error?: string;
};

const emptyLine = (): Line => ({ productId: "", quantity: "1" });

export function InvoiceModal({
  open,
  onClose,
  onSubmit,
  sites,
  products,
  loading,
  error,
}: InvoiceModalProps) {
  const storeSites = sites.filter((s) => s.type === "STORE");
  const [pointOfSaleId, setPointOfSaleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [validateImmediately, setValidateImmediately] = useState(true);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  useEffect(() => {
    if (open) {
      const stores = sites.filter((s) => s.type === "STORE");
      setPointOfSaleId(stores[0]?.id ?? "");
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setValidateImmediately(true);
      setLines([emptyLine()]);
    }
  }, [open, sites]);

  const estimatedTotal = lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.productId);
    const qty = parseInt(line.quantity, 10) || 0;
    if (!product || qty <= 0) return sum;
    const ht = qty * product.unitPrice;
    const tax = Math.round(ht * 0.16);
    return sum + ht + tax;
  }, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const resolved = lines
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const qty = parseInt(line.quantity, 10);
        if (!product || !qty || qty <= 0) return null;
        return { productId: product.id, quantity: qty, unitPrice: product.unitPrice };
      })
      .filter(Boolean) as InvoiceFormResult["lines"];

    await onSubmit({
      pointOfSaleId,
      customerName,
      customerPhone,
      notes,
      validateImmediately,
      lines: resolved,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle facture"
      description="Créer un brouillon ou valider directement pour la caisse."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <p className="text-sm text-[var(--muted)]">
            Total estimé :{" "}
            <span className="font-semibold text-[var(--text)]">
              {formatCdf(estimatedTotal)}
            </span>
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" form="invoice-form" className="btn btn-primary" disabled={loading}>
              {loading ? "Création..." : "Créer la facture"}
            </button>
          </div>
        </div>
      }
    >
      <form id="invoice-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Point de vente" required>
            <select
              className="input-field"
              value={pointOfSaleId}
              onChange={(e) => setPointOfSaleId(e.target.value)}
              required
            >
              {storeSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Options">
            <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={validateImmediately}
                onChange={(e) => setValidateImmediately(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Valider immédiatement (en attente caisse)
            </label>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Client (nom)">
            <input
              className="input-field"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optionnel"
            />
          </FormField>
          <FormField label="Téléphone">
            <input
              className="input-field"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+243..."
            />
          </FormField>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Lignes</p>
            <button type="button" className="btn btn-ghost text-xs" onClick={() => setLines((l) => [...l, emptyLine()])}>
              <Plus size={14} />
              Ajouter
            </button>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="form-field flex-1">
                {i === 0 && <label className="form-label">Produit</label>}
                <select
                  className="input-field"
                  value={line.productId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, idx) => (idx === i ? { ...l, productId: e.target.value } : l))
                    )
                  }
                  required
                >
                  <option value="">— Produit —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({formatCdf(p.unitPrice)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field w-20">
                {i === 0 && <label className="form-label">Qté</label>}
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, idx) => (idx === i ? { ...l, quantity: e.target.value } : l))
                    )
                  }
                  required
                />
              </div>
              <button
                type="button"
                className="icon-btn btn-circle-danger mb-0.5"
                onClick={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)))}
                disabled={lines.length <= 1}
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
            placeholder="Optionnel"
          />
        </FormField>
      </form>
    </Modal>
  );
}
