"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { ProductImage } from "@/components/products/product-image";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { getToken } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";

export type ProductFormData = {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  unitPrice: string;
  taxRate: string;
  minStockLevel: string;
  active: boolean;
};

export const emptyProductForm: ProductFormData = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  unitPrice: "",
  taxRate: "16",
  minStockLevel: "0",
  active: true,
};

type Category = { id: string; name: string };

type ProductModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  categories: Category[];
  initial?: ProductFormData;
  mode: "create" | "edit";
  loading?: boolean;
  error?: string;
};

export function ProductModal({
  open,
  onClose,
  onSubmit,
  categories,
  initial,
  mode,
  loading,
  error,
}: ProductModalProps) {
  const [form, setForm] = useState<ProductFormData>(emptyProductForm);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(initial ?? emptyProductForm);
      setUploadError("");
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
    wasOpen.current = open;
  }, [open, initial]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
  }

  function set(key: keyof ProductFormData, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setCropSrc(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function uploadProductImage(file: File) {
    const preview = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    setUploading(true);
    setUploadError("");

    try {
      const data = await submitToast(
        (async () => {
          const body = new FormData();
          body.append("file", file);

          const token = getToken();
          const res = await fetch("/api/v1/upload/product-image", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body,
          });

          const json = await res.json();
          if (!res.ok) {
            throw new Error(json.error?.message ?? "Échec du téléversement");
          }
          return json as { url: string };
        })(),
        {
          pending: "Envoi de l'image...",
          success: "Image téléversée",
        }
      );

      set("imageUrl", data.url);
      setLocalPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      closeCrop();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Nouveau produit" : "Modifier le produit"}
      description={
        mode === "create"
          ? "Ajoutez un produit au catalogue. Les prix sont en CDF."
          : "Mettez à jour les informations du produit."
      }
      size="lg"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="submit"
            form="product-form"
            className="btn btn-primary"
            disabled={loading || uploading}
          >
            {loading ? "Enregistrement..." : mode === "create" ? "Créer le produit" : "Enregistrer"}
          </button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {/* Image produit */}
        <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border-light)]">
          <div className="relative w-fit">
            <ProductImage
              src={localPreview || form.imageUrl || null}
              name={form.name || "Produit"}
              size="lg"
            />
            {uploading && (
              <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-sm font-semibold">Image du produit</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ImagePlus size={15} />
                )}
                {uploading ? "Envoi..." : "Téléverser une image"}
              </button>
              {form.imageUrl && (
                <button
                  type="button"
                  className="btn btn-ghost text-sm text-[var(--danger)]"
                  onClick={() => set("imageUrl", "")}
                >
                  Supprimer
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            <FormField label="Image produit" hint="Stockée sur Amazon S3">
              <p className="text-xs text-[var(--muted)]">JPEG, PNG, WebP ou GIF · max 2 Mo · recadrage avant envoi</p>
            </FormField>
            {uploadError && <p className="text-xs text-[var(--danger)]">{uploadError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nom du produit" required>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              placeholder="Ex: Téléphone Samsung A15"
            />
          </FormField>

          <FormField label="SKU" required hint="Référence unique interne">
            <input
              className="input-field"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              required
              placeholder="PRD-001"
              disabled={mode === "edit"}
            />
          </FormField>

          <FormField label="Code-barres">
            <input
              className="input-field"
              value={form.barcode}
              onChange={(e) => set("barcode", e.target.value)}
              placeholder="8901234567890"
            />
          </FormField>

          <FormField label="Catégorie">
            <select
              className="input-field"
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Prix unitaire (CDF)" required>
            <input
              className="input-field"
              type="number"
              min={1}
              value={form.unitPrice}
              onChange={(e) => set("unitPrice", e.target.value)}
              required
              placeholder="25000"
            />
          </FormField>

          <FormField label="TVA (%)">
            <input
              className="input-field"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.taxRate}
              onChange={(e) => set("taxRate", e.target.value)}
            />
          </FormField>

          <FormField label="Seuil stock minimum">
            <input
              className="input-field"
              type="number"
              min={0}
              value={form.minStockLevel}
              onChange={(e) => set("minStockLevel", e.target.value)}
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
        </div>

        <FormField label="Description">
          <textarea
            className="input-field min-h-[80px] resize-y"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Description optionnelle..."
            rows={3}
          />
        </FormField>
      </form>
    </Modal>

    <ImageCropModal
      open={!!cropSrc}
      imageSrc={cropSrc}
      aspect={1}
      cropShape="rect"
      title="Recadrer l'image produit"
      maxSize={800}
      loading={uploading}
      onClose={closeCrop}
      onConfirm={uploadProductImage}
    />
    </>
  );
}
