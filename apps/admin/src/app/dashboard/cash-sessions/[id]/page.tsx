"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiFetch, getUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { DashboardHeader } from "@/components/dashboard/header";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import {
  CashSessionDetailView,
  type CashSessionDetail,
} from "@/components/cash-sessions/cash-session-detail-view";

export default function CashSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = getUser()!;
  const sessionId = params.id as string;

  const [detail, setDetail] = useState<CashSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const [closeOpen, setCloseOpen] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);

  const canManage =
    user.role === "ADMIN" || user.role === "MANAGER" || user.role === "CAISSIER";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<CashSessionDetail>(`/cash-sessions/${sessionId}`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, [sessionId]);

  async function handleClose() {
    setCloseLoading(true);
    setError("");
    try {
      await submitToast(
        apiFetch(`/cash-sessions/${sessionId}/close`, {
          method: "POST",
          body: JSON.stringify({
            closingCash: parseInt(closingCash, 10) || 0,
          }),
        }),
        {
          pending: "Clôture de la session...",
          success: "Session clôturée",
        }
      );
      setCloseOpen(false);
      setClosingCash("");
      await load();
    } catch {
      /* toast affiché */
    } finally {
      setCloseLoading(false);
    }
  }

  const canCloseThisSession =
    canManage &&
    detail?.status === "OPEN" &&
    (user.role !== "CAISSIER" || detail.user.id === user.id);

  return (
    <>
      <DashboardHeader
        title={detail ? `Session ${detail.pointOfSale.code}` : "Détail session"}
        subtitle={
          detail
            ? `${detail.pointOfSale.name} · ${detail.user.name}`
            : loading
              ? "Chargement..."
              : undefined
        }
        user={user}
        actions={
          canCloseThisSession ? (
            <button type="button" className="btn btn-primary" onClick={() => setCloseOpen(true)}>
              Clôturer la session
            </button>
          ) : undefined
        }
      />

      <Link
        href="/dashboard/cash-sessions"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Retour aux sessions
      </Link>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)] py-12 text-center">Chargement...</p>
      ) : !detail ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm text-[var(--muted)] mb-4">Session introuvable</p>
          <button type="button" className="btn btn-ghost" onClick={() => router.push("/dashboard/cash-sessions")}>
            Retour à la liste
          </button>
        </div>
      ) : (
        <CashSessionDetailView
          detail={detail}
          paymentSearch={paymentSearch}
          onPaymentSearchChange={setPaymentSearch}
        />
      )}

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Clôturer la session"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button type="button" className="btn btn-ghost" onClick={() => setCloseOpen(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleClose}
              disabled={closeLoading}
            >
              {closeLoading ? "Clôture..." : "Clôturer"}
            </button>
          </div>
        }
      >
        {detail && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Session de {detail.user.name} — {detail.pointOfSale.code}
            </p>
            <FormField label="Espèces comptées (CDF)">
              <input
                type="number"
                min={0}
                className="input-field"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                autoFocus
              />
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
