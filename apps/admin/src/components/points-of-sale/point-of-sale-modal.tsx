"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";

export type PointOfSaleFormData = {
  code: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  invoicePrefix: string;
  yocoPrintEnabled: boolean;
  yocoDeviceId: string;
  active: boolean;
};

export const emptyPointOfSaleForm: PointOfSaleFormData = {
  code: "",
  name: "",
  type: "STORE",
  address: "",
  phone: "",
  invoicePrefix: "FAC",
  yocoPrintEnabled: false,
  yocoDeviceId: "",
  active: true,
};

type PointOfSaleModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PointOfSaleFormData) => Promise<void>;
  initial?: PointOfSaleFormData;
  mode: "create" | "edit";
  loading?: boolean;
  error?: string;
};

export function PointOfSaleModal({
  open,
  onClose,
  onSubmit,
  initial,
  mode,
  loading,
  error,
}: PointOfSaleModalProps) {
  const [form, setForm] = useState<PointOfSaleFormData>(emptyPointOfSaleForm);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(initial ?? emptyPointOfSaleForm);
    }
    wasOpen.current = open;
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  function set<K extends keyof PointOfSaleFormData>(key: K, value: PointOfSaleFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nouveau point de vente" : "Modifier le point de vente"}
      description={
        mode === "create"
          ? "Créez un magasin (vente/caisse) ou un dépôt (stock)."
          : "Mettez à jour les informations du site."
      }
      size="lg"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="submit"
            form="pos-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Enregistrement..." : mode === "create" ? "Créer le site" : "Enregistrer"}
          </button>
        </div>
      }
    >
      <form id="pos-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Code" required hint="Ex: KIN-01, LUB-DEPOT">
            <input
              className="input-field font-mono"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              required
              placeholder="KIN-01"
            />
          </FormField>

          <FormField label="Nom" required>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              placeholder="Boutique Kinshasa Centre"
            />
          </FormField>

          <FormField label="Type" required>
            <select
              className="input-field"
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
            >
              <option value="STORE">Point de vente (STORE)</option>
              <option value="DEPOT">Dépôt (DEPOT)</option>
            </select>
          </FormField>

          <FormField label="Préfixe factures">
            <input
              className="input-field font-mono"
              value={form.invoicePrefix}
              onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())}
              placeholder="FAC"
            />
          </FormField>

          <FormField label="Adresse">
            <input
              className="input-field"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Adresse optionnelle"
            />
          </FormField>

          <FormField label="Téléphone">
            <input
              className="input-field"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+243..."
            />
          </FormField>

          {mode === "edit" && (
            <FormField label="Statut">
              <select
                className="input-field"
                value={form.active ? "true" : "false"}
                onChange={(e) => set("active", e.target.value === "true")}
              >
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </FormField>
          )}

          <FormField label="Impression Yoco">
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={form.yocoPrintEnabled}
                onChange={(e) => set("yocoPrintEnabled", e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm">Imprimante ticket Yoco activée</span>
            </label>
          </FormField>

          {form.yocoPrintEnabled && (
            <FormField label="ID terminal Yoco" hint="Identifiant imprimante / terminal">
              <input
                className="input-field"
                value={form.yocoDeviceId}
                onChange={(e) => set("yocoDeviceId", e.target.value)}
                placeholder="Optionnel"
              />
            </FormField>
          )}
        </div>
      </form>
    </Modal>
  );
}

export const POS_TYPE_LABELS: Record<string, string> = {
  STORE: "Point de vente",
  DEPOT: "Dépôt",
};
