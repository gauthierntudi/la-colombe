"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Banknote, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { apiFetch, formatCdf } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";

type PayMode = "CASH" | "MOBILE_MONEY" | "MIXED";

type InvoicePayTarget = {
  id: string;
  number: string;
  totalTtc: number;
  customerPhone: string | null;
};

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  invoice: InvoicePayTarget | null;
  canSimulate?: boolean;
  onSuccess: () => void;
};

const PROVIDERS = [
  { value: "ORANGE", label: "Orange Money" },
  { value: "AIRTEL", label: "Airtel Money" },
  { value: "VODACOM", label: "M-Pesa (Vodacom)" },
] as const;

export function InvoicePaymentModal({
  open,
  onClose,
  invoice,
  canSimulate,
  onSuccess,
}: PaymentModalProps) {
  const [mode, setMode] = useState<PayMode>("CASH");
  const [cashAmount, setCashAmount] = useState("");
  const [mmAmount, setMmAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]["value"]>("ORANGE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState("");
  const [isMock, setIsMock] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !invoice) return;
    setMode("CASH");
    setCashAmount(String(invoice.totalTtc));
    setMmAmount(String(invoice.totalTtc));
    setPhone(invoice.customerPhone ?? "");
    setProvider("ORANGE");
    setError("");
    setPendingPaymentId(null);
    setPendingMessage("");
    setIsMock(false);
  }, [open, invoice]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function waitForPayment(paymentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await apiFetch<{ status: string }>(`/payments/${paymentId}`);
          if (status.status === "COMPLETED") {
            clearInterval(interval);
            resolve();
          } else if (status.status === "FAILED") {
            clearInterval(interval);
            reject(new Error("Paiement Mobile Money refusé ou expiré"));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 2500);
      pollRef.current = interval;
    });
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleSimulate() {
    if (!pendingPaymentId || !invoice) return;
    setLoading(true);
    setError("");
    try {
      await submitToast(
        (async () => {
          await apiFetch(`/payments/${pendingPaymentId}/simulate`, { method: "POST" });

          if (mode === "MIXED") {
            const cash = parseInt(cashAmount, 10) || 0;
            const mm = parseInt(mmAmount, 10) || 0;
            await apiFetch("/payments", {
              method: "POST",
              body: JSON.stringify({
                invoiceId: invoice.id,
                payments: [
                  { method: "CASH", amount: cash },
                  { method: "MOBILE_MONEY", amount: mm, paymentId: pendingPaymentId },
                ],
              }),
            });
          }
        })(),
        {
          pending: "Simulation du paiement...",
          success: "Paiement enregistré",
        }
      );

      stopPolling();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    setLoading(true);
    setError("");
    stopPolling();

    try {
      if (mode === "CASH") {
        const amount = parseInt(cashAmount, 10) || 0;
        await submitToast(
          apiFetch("/payments", {
            method: "POST",
            body: JSON.stringify({
              invoiceId: invoice.id,
              payments: [{ method: "CASH", amount }],
            }),
          }),
          {
            pending: "Encaissement en cours...",
            success: "Paiement enregistré",
          }
        );
        onSuccess();
        onClose();
        return;
      }

      if (mode === "MOBILE_MONEY") {
        const amount = parseInt(mmAmount, 10) || 0;
        const res = await apiFetch<{
          paymentId: string;
          message: string;
          mock?: boolean;
        }>("/payments/mobile-money/initiate", {
          method: "POST",
          body: JSON.stringify({
            invoiceId: invoice.id,
            amount,
            phone,
            provider,
          }),
        });
        setPendingPaymentId(res.paymentId);
        setPendingMessage(res.message);
        setIsMock(!!res.mock);

        if (res.mock && canSimulate) {
          return;
        }

        await submitToast(waitForPayment(res.paymentId), {
          pending: "En attente Mobile Money...",
          success: "Paiement enregistré",
        });
        stopPolling();
        onSuccess();
        onClose();
        return;
      }

      const cash = parseInt(cashAmount, 10) || 0;
      const mm = parseInt(mmAmount, 10) || 0;
      if (cash + mm < invoice.totalTtc) {
        throw new Error(
          `Total insuffisant (${formatCdf(cash + mm)} sur ${formatCdf(invoice.totalTtc)})`
        );
      }

      const mmRes = await apiFetch<{ paymentId: string; message: string; mock?: boolean }>(
        "/payments/mobile-money/initiate",
        {
          method: "POST",
          body: JSON.stringify({
            invoiceId: invoice.id,
            amount: mm,
            phone,
            provider,
          }),
        }
      );

      setPendingPaymentId(mmRes.paymentId);
      setPendingMessage("Mobile Money en attente. Confirmez côté client, puis l'encaissement espèces sera finalisé.");
      setIsMock(!!mmRes.mock);

      if (mmRes.mock && canSimulate) {
        setLoading(false);
        return;
      }

      await submitToast(
        (async () => {
          await waitForPayment(mmRes.paymentId);

          await apiFetch("/payments", {
            method: "POST",
            body: JSON.stringify({
              invoiceId: invoice.id,
              payments: [
                { method: "CASH", amount: cash },
                { method: "MOBILE_MONEY", amount: mm, paymentId: mmRes.paymentId },
              ],
            }),
          });
        })(),
        {
          pending: "En attente Mobile Money...",
          success: "Paiement mixte enregistré",
        }
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  }

  const waitingMm = !!pendingPaymentId && (mode === "MOBILE_MONEY" || mode === "MIXED");

  return (
    <Modal
      open={open}
      onClose={() => {
        stopPolling();
        onClose();
      }}
      title="Encaisser la facture"
      description={invoice ? `Facture ${invoice.number}` : undefined}
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full flex-wrap">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              stopPolling();
              onClose();
            }}
            disabled={loading && !waitingMm}
          >
            {waitingMm ? "Fermer" : "Annuler"}
          </button>
          {waitingMm && isMock && canSimulate ? (
            <button type="button" className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
              Simuler confirmation
            </button>
          ) : !waitingMm ? (
            <button type="submit" form="invoice-pay-form" className="btn btn-primary" disabled={loading}>
              {loading ? "Traitement..." : "Confirmer"}
            </button>
          ) : null}
        </div>
      }
    >
      {invoice && (
        <form id="invoice-pay-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}

          <p className="text-sm">
            Total à encaisser :{" "}
            <span className="font-bold">{formatCdf(invoice.totalTtc)}</span>
          </p>

          {!waitingMm && (
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { id: "CASH", label: "Espèces", icon: Banknote },
                  { id: "MOBILE_MONEY", label: "Mobile Money", icon: Smartphone },
                  { id: "MIXED", label: "Mixte", icon: Banknote },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`btn text-xs ${mode === m.id ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMode(m.id)}
                >
                  <m.icon size={14} />
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {waitingMm ? (
            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg)] p-4 text-sm space-y-2">
              <p className="font-medium text-[var(--text)]">En attente Mobile Money</p>
              <p className="text-[var(--muted)]">{pendingMessage}</p>
              <p className="text-xs text-[var(--muted)] animate-pulse">
                Vérification automatique du statut...
              </p>
            </div>
          ) : (
            <>
              {(mode === "CASH" || mode === "MIXED") && (
                <FormField label={mode === "MIXED" ? "Montant espèces (CDF)" : "Montant espèces"}>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    required
                  />
                </FormField>
              )}

              {(mode === "MOBILE_MONEY" || mode === "MIXED") && (
                <>
                  <FormField label={mode === "MIXED" ? "Montant Mobile Money (CDF)" : "Montant"}>
                    <input
                      type="number"
                      min={1}
                      className="input-field"
                      value={mmAmount}
                      onChange={(e) => setMmAmount(e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Téléphone Mobile Money" required>
                    <input
                      className="input-field"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+243812345678"
                      required
                    />
                  </FormField>
                  <FormField label="Opérateur" required>
                    <select
                      className="input-field"
                      value={provider}
                      onChange={(e) =>
                        setProvider(e.target.value as (typeof PROVIDERS)[number]["value"])
                      }
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </>
              )}
            </>
          )}
        </form>
      )}
    </Modal>
  );
}
