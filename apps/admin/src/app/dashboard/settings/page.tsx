"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  FileText,
  Globe,
  Printer,
  Save,
  Shield,
} from "lucide-react";
import { apiFetch, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { FormField } from "@/components/ui/form-field";

type ShopSettings = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  defaultTaxRate: number;
  invoiceExpiryH: number;
  country: string;
  flexpaieMerchantId: string | null;
  flexpaieApiKeyMasked: string | null;
  flexpaieWebhookSecretMasked: string | null;
  hasFlexpaieApiKey: boolean;
  hasFlexpaieWebhookSecret: boolean;
  hasYocoIntegrationSecret: boolean;
  updatedAt?: string;
};

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  defaultTaxRate: "16",
  invoiceExpiryH: "24",
  flexpaieMerchantId: "",
  flexpaieApiKey: "",
  flexpaieWebhookSecret: "",
  yocoIntegrationSecret: "",
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-4 mb-4 border-b border-[var(--border-light)]">
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
        <Icon size={18} className="text-[var(--accent)]" />
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-[var(--text)]">{title}</h2>
        {description && (
          <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--border-light)] last:border-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const user = getUser()!;
  const [form, setForm] = useState(emptyForm);
  const [meta, setMeta] = useState({ country: "CD", currency: "CDF", updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [masked, setMasked] = useState({ apiKey: "", webhook: "" });
  const [flexpaieConfigured, setFlexpaieConfigured] = useState({
    apiKey: false,
    webhook: false,
  });
  const [yocoConfigured, setYocoConfigured] = useState(false);

  useEffect(() => {
    apiFetch<ShopSettings>("/settings")
      .then((s) => {
        setForm({
          name: s.name,
          address: s.address ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          defaultTaxRate: String(s.defaultTaxRate),
          invoiceExpiryH: String(s.invoiceExpiryH),
          flexpaieMerchantId: s.flexpaieMerchantId ?? "",
          flexpaieApiKey: "",
          flexpaieWebhookSecret: "",
          yocoIntegrationSecret: "",
        });
        setMeta({
          country: s.country,
          currency: s.currency,
          updatedAt: s.updatedAt ?? "",
        });
        setMasked({
          apiKey: s.flexpaieApiKeyMasked ?? "",
          webhook: s.flexpaieWebhookSecretMasked ?? "",
        });
        setFlexpaieConfigured({
          apiKey: s.hasFlexpaieApiKey,
          webhook: s.hasFlexpaieWebhookSecret,
        });
        setYocoConfigured(s.hasYocoIntegrationSecret);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Erreur");
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        defaultTaxRate: parseFloat(form.defaultTaxRate),
        invoiceExpiryH: parseInt(form.invoiceExpiryH, 10),
        flexpaieMerchantId: form.flexpaieMerchantId.trim() || null,
      };
      if (form.flexpaieApiKey) payload.flexpaieApiKey = form.flexpaieApiKey;
      if (form.flexpaieWebhookSecret) payload.flexpaieWebhookSecret = form.flexpaieWebhookSecret;
      if (form.yocoIntegrationSecret) payload.yocoIntegrationSecret = form.yocoIntegrationSecret;

      const updated = await submitToast(
        apiFetch<ShopSettings>("/settings", {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
        {
          pending: "Enregistrement des paramètres...",
          success: "Paramètres enregistrés avec succès",
        }
      );
      setMasked({
        apiKey: updated.flexpaieApiKeyMasked ?? "",
        webhook: updated.flexpaieWebhookSecretMasked ?? "",
      });
      setFlexpaieConfigured({
        apiKey: updated.hasFlexpaieApiKey,
        webhook: updated.hasFlexpaieWebhookSecret,
      });
      setYocoConfigured(updated.hasYocoIntegrationSecret);
      setMeta((m) => ({ ...m, updatedAt: updated.updatedAt ?? m.updatedAt }));
      setForm((f) => ({
        ...f,
        flexpaieApiKey: "",
        flexpaieWebhookSecret: "",
        yocoIntegrationSecret: "",
      }));
    } catch {
      /* toast affiché */
    } finally {
      setSaving(false);
    }
  }

  if (user.role !== "ADMIN") {
    return (
      <>
        <DashboardHeader title="Paramètres" user={user} />
        <div className="max-w-md mx-auto glass-card p-8 text-center">
          <Shield size={32} className="mx-auto text-[var(--muted)] opacity-50 mb-3" />
          <p className="font-semibold">Accès restreint</p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Cette page est réservée aux administrateurs.
          </p>
        </div>
      </>
    );
  }

  const lastUpdated = meta.updatedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(meta.updatedAt))
    : null;

  return (
    <>
      <DashboardHeader
        title="Paramètres"
        subtitle="Organisation, facturation et intégrations"
        user={user}
      />

      <div className="max-w-6xl mx-auto w-full">
        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="glass-card p-16 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)]">Chargement des paramètres...</p>
          </div>
        ) : (
          <form id="settings-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
              {/* Colonne principale */}
              <div className="xl:col-span-2 space-y-5">
                <section className="glass-card p-6 sm:p-7">
                  <SectionHeader
                    icon={Building2}
                    title="Organisation"
                    description="Identité de la boutique affichée sur les documents"
                  />

                  <div className="space-y-4">
                    <FormField label="Nom de la boutique" required>
                      <input
                        className="input-field"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        placeholder="La Colombe"
                      />
                    </FormField>

                    <FormField label="Adresse">
                      <input
                        className="input-field"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Kinshasa, RDC"
                      />
                    </FormField>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Téléphone">
                        <input
                          className="input-field"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+243..."
                        />
                      </FormField>
                      <FormField label="Email">
                        <input
                          className="input-field"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="contact@boutique.cd"
                        />
                      </FormField>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <section className="glass-card p-6 sm:p-7 h-full">
                    <SectionHeader
                      icon={FileText}
                      title="Facturation"
                      description="TVA et délais par défaut"
                    />

                    <div className="space-y-4">
                      <FormField label="TVA par défaut (%)" required>
                        <input
                          className="input-field"
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={form.defaultTaxRate}
                          onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })}
                          required
                        />
                      </FormField>
                      <FormField
                        label="Expiration facture (heures)"
                        hint="Libération automatique du stock réservé"
                      >
                        <input
                          className="input-field"
                          type="number"
                          min={1}
                          max={168}
                          value={form.invoiceExpiryH}
                          onChange={(e) => setForm({ ...form, invoiceExpiryH: e.target.value })}
                        />
                      </FormField>
                    </div>
                  </section>

                  <section className="glass-card p-6 sm:p-7 h-full">
                    <SectionHeader
                      icon={CreditCard}
                      title="Flexpaie"
                      description="Paiements Mobile Money (côté serveur)"
                    />

                    <div className="space-y-4">
                      <FormField label="Merchant ID">
                        <input
                          className="input-field font-mono text-sm"
                          value={form.flexpaieMerchantId}
                          onChange={(e) =>
                            setForm({ ...form, flexpaieMerchantId: e.target.value })
                          }
                          placeholder="ID marchand Flexpaie"
                        />
                      </FormField>
                      <FormField
                        label="Clé API"
                        hint={
                          masked.apiKey
                            ? `Configurée : ${masked.apiKey}`
                            : "Non configurée — laisser vide pour conserver"
                        }
                      >
                        <input
                          className="input-field font-mono text-sm"
                          type="password"
                          value={form.flexpaieApiKey}
                          onChange={(e) => setForm({ ...form, flexpaieApiKey: e.target.value })}
                          placeholder="Nouvelle clé (optionnel)"
                        />
                      </FormField>
                      <FormField
                        label="Secret webhook"
                        hint={
                          masked.webhook
                            ? `Configuré : ${masked.webhook}`
                            : "Non configuré — laisser vide pour conserver"
                        }
                      >
                        <input
                          className="input-field font-mono text-sm"
                          type="password"
                          value={form.flexpaieWebhookSecret}
                          onChange={(e) =>
                            setForm({ ...form, flexpaieWebhookSecret: e.target.value })
                          }
                          placeholder="Nouveau secret (optionnel)"
                        />
                      </FormField>
                    </div>
                  </section>

                  <section className="glass-card p-6 sm:p-7 h-full">
                    <SectionHeader
                      icon={Printer}
                      title="Yoco POS"
                      description="Impression bon de sortie (app caisse Android)"
                    />
                    <FormField
                      label="Secret d'intégration SDK"
                      hint={
                        yocoConfigured
                          ? "Configuré — laisser vide pour conserver"
                          : "Obtenu depuis le portail développeur Yoco"
                      }
                    >
                      <input
                        className="input-field font-mono text-sm"
                        type="password"
                        value={form.yocoIntegrationSecret}
                        onChange={(e) =>
                          setForm({ ...form, yocoIntegrationSecret: e.target.value })
                        }
                        placeholder="Integration secret Yoco"
                      />
                    </FormField>
                  </section>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="btn btn-primary w-full sm:w-auto min-w-[200px]"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? "Enregistrement..." : "Enregistrer les modifications"}
                  </button>
                </div>
              </div>

              {/* Colonne récap */}
              <aside className="space-y-5 xl:sticky xl:top-6">
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe size={16} className="text-[var(--accent)]" />
                    <h3 className="font-semibold text-sm">Récapitulatif</h3>
                  </div>

                  <SummaryRow
                    label="Devise"
                    value={<span className="badge badge-store">{meta.currency}</span>}
                  />
                  <SummaryRow
                    label="Pays"
                    value={meta.country === "CD" ? "RDC" : meta.country}
                  />
                  <SummaryRow label="TVA active" value={`${form.defaultTaxRate} %`} />
                  <SummaryRow
                    label="Expiration"
                    value={`${form.invoiceExpiryH} h`}
                  />
                  <SummaryRow
                    label="Clé API Flexpaie"
                    value={
                      flexpaieConfigured.apiKey ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-warn">Non configurée</span>
                      )
                    }
                  />
                  <SummaryRow
                    label="Webhook Flexpaie"
                    value={
                      flexpaieConfigured.webhook ? (
                        <span className="badge badge-success">Actif</span>
                      ) : (
                        <span className="badge badge-warn">Non configuré</span>
                      )
                    }
                  />
                </div>

                <div className="glass-card p-5 bg-[var(--bg)]">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                    Informations
                  </p>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    La devise CDF et le pays RDC sont fixes pour cette installation.
                    Les clés Flexpaie ne sont jamais exposées côté client.
                  </p>
                  {lastUpdated && (
                    <p className="text-[10px] text-[var(--muted)] mt-3 pt-3 border-t border-[var(--border-light)]">
                      Dernière mise à jour : {lastUpdated}
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
