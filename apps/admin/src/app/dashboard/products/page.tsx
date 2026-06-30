"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Package, Filter, Trash2, PackageCheck, Tags } from "lucide-react";
import { apiFetch, formatCdf, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ConfirmModal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { IconButton } from "@/components/ui/icon-button";
import { TablePagination } from "@/components/ui/table-pagination";
import { DEFAULT_PAGE_SIZE, EMPTY_PAGINATION, type PaginationMeta } from "@/lib/pagination";
import { ProductImage } from "@/components/products/product-image";
import {
  ProductModal,
  ProductFormData,
  emptyProductForm,
} from "@/components/products/product-modal";

type Category = { id: string; name: string };
type PointOfSale = { id: string; code: string; name: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
  taxRate: number;
  minStockLevel: number;
  active: boolean;
  category: Category | null;
};

function productToForm(p: Product): ProductFormData {
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? "",
    description: p.description ?? "",
    imageUrl: p.imageUrl ?? "",
    categoryId: p.category?.id ?? "",
    unitPrice: String(p.unitPrice),
    taxRate: String(p.taxRate),
    minStockLevel: String(p.minStockLevel),
    active: p.active,
  };
}

export default function ProductsPage() {
  const user = getUser()!;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sites, setSites] = useState<PointOfSale[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pointOfSaleId, setPointOfSaleId] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_PAGINATION);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<Product | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    });
    if (search) params.set("search", search);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (pointOfSaleId) params.set("pointOfSaleId", pointOfSaleId);
    if (showInactive) params.set("active", "all");

    const [prodRes, catRes, sitesRes] = await Promise.all([
      apiFetch<{ data: Product[]; meta: PaginationMeta }>(`/products?${params}`),
      apiFetch<{ data: Category[] }>("/categories"),
      apiFetch<{ data: PointOfSale[] }>("/points-of-sale"),
    ]);
    setProducts(prodRes.data);
    setMeta(prodRes.meta);
    setCategories(catRes.data);
    setSites(sitesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, pointOfSaleId, showInactive]);

  useEffect(() => {
    load().catch(console.error);
  }, [search, categoryFilter, pointOfSaleId, showInactive, page]);

  function openCreate() {
    setModalMode("create");
    setEditingProduct(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setModalMode("edit");
    setEditingProduct(product);
    setModalError("");
    setModalOpen(true);
  }

  async function handleSubmit(data: ProductFormData) {
    setSubmitLoading(true);
    setModalError("");
    try {
      await submitToast(
        (async () => {
          const payload = {
            name: data.name,
            sku: data.sku,
            barcode: data.barcode || null,
            description: data.description || null,
            imageUrl: data.imageUrl?.trim() || null,
            categoryId: data.categoryId || null,
            unitPrice: parseInt(data.unitPrice, 10),
            taxRate: parseFloat(data.taxRate),
            minStockLevel: parseInt(data.minStockLevel, 10),
            ...(modalMode === "edit" ? { active: data.active } : {}),
          };

          if (modalMode === "create") {
            await apiFetch("/products", { method: "POST", body: JSON.stringify(payload) });
          } else if (editingProduct) {
            await apiFetch(`/products/${editingProduct.id}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            });
          }
        })(),
        {
          pending: "Enregistrement du produit...",
          success:
            modalMode === "create" ? "Produit créé avec succès" : "Produit mis à jour",
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

  async function confirmDeactivate() {
    if (!deactivating) return;
    setConfirmLoading(true);
    try {
      await submitToast(
        apiFetch(`/products/${deactivating.id}`, { method: "DELETE" }),
        {
          pending: "Désactivation du produit...",
          success: "Produit désactivé",
        }
      );
      setConfirmOpen(false);
      setDeactivating(null);
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setConfirmLoading(false);
    }
  }

  const activeCount = products.filter((p) => p.active).length;
  const avgPrice =
    products.length > 0
      ? formatCdf(
          Math.round(products.reduce((s, p) => s + p.unitPrice, 0) / products.length)
        )
      : "—";

  return (
    <>
      <DashboardHeader
        title="Produits"
        subtitle={`${meta.total.toLocaleString("fr-FR")} référence(s)`}
        user={user}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Nouveau produit
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total affiché"
          value={products.length}
          hint="Selon filtres actifs"
          badge="Total"
          icon={Package}
          tone="primary"
          loading={loading}
        />
        <KpiCard
          label="Produits actifs"
          value={activeCount}
          hint="Dans la liste filtrée"
          badge="Actifs"
          icon={PackageCheck}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Catégories"
          value={categories.length}
          hint="Catalogue structuré"
          badge="Cat."
          icon={Tags}
          tone="violet"
          loading={loading}
        />
        <KpiCard
          label="Prix moyen"
          value={avgPrice}
          hint="Prix unitaire moyen CDF"
          badge="CDF"
          icon={Filter}
          tone="info"
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="glass-card-flat p-3 flex items-center gap-3 flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="text-[var(--muted)] shrink-0" />
          <input
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[var(--muted)]"
            placeholder="Nom, SKU, code-barres..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-field min-w-[160px]"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="select-field min-w-[180px]"
          value={pointOfSaleId}
          onChange={(e) => setPointOfSaleId(e.target.value)}
        >
          <option value="">Tous les sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <ToggleSwitch
          label="Inclure inactifs"
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
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix CDF</th>
                <th>TVA</th>
                <th>Seuil</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={!p.active ? "opacity-60" : ""}>
                  <td>
                    <div className="flex items-center gap-3">
                      <ProductImage src={p.imageUrl} name={p.name} size="sm" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs font-mono text-[var(--accent)] mt-0.5">{p.sku}</p>
                        {p.barcode && (
                          <p className="text-[10px] text-[var(--muted)]">{p.barcode}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-[var(--muted)]">{p.category?.name ?? "—"}</td>
                  <td className="font-semibold">{formatCdf(p.unitPrice)}</td>
                  <td>{p.taxRate}%</td>
                  <td>{p.minStockLevel}</td>
                  <td>
                    {p.active ? (
                      <span className="badge badge-success">Actif</span>
                    ) : (
                      <span className="badge badge-warn">Inactif</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <IconButton
                        icon={Pencil}
                        title="Modifier"
                        variant="primary"
                        onClick={() => openEdit(p)}
                      />
                      {p.active && (
                        <IconButton
                          icon={Trash2}
                          title="Désactiver"
                          variant="danger"
                          onClick={() => {
                            setDeactivating(p);
                            setConfirmOpen(true);
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Package size={32} className="mx-auto text-[var(--muted)] mb-2 opacity-40" />
                    <p className="text-[var(--muted)] text-sm">Aucun produit trouvé</p>
                    <button className="btn btn-primary mt-4" onClick={openCreate}>
                      <Plus size={14} /> Ajouter un produit
                    </button>
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

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        categories={categories}
        initial={editingProduct ? productToForm(editingProduct) : undefined}
        mode={modalMode}
        loading={submitLoading}
        error={modalError}
      />

      <ConfirmModal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeactivating(null);
        }}
        onConfirm={confirmDeactivate}
        title="Désactiver le produit"
        message={`Voulez-vous désactiver « ${deactivating?.name} » ? Il ne sera plus visible dans le catalogue actif.`}
        confirmLabel="Désactiver"
        loading={confirmLoading}
      />
    </>
  );
}
