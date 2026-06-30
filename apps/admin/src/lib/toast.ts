"use client";

import { toast, type UpdateOptions } from "react-toastify";

export type SubmitToastMessages = {
  pending?: string;
  success: string;
  error?: string;
  /** Par défaut "success" ; utiliser "warning" pour un succès avec mise en garde */
  successType?: "success" | "warning";
};

function resolveErrorMessage(data: unknown, fallback: string): string {
  if (data instanceof Error && data.message) return data.message;
  if (typeof data === "string" && data.trim()) return data;
  return fallback;
}

/** Affiche une notification toast.promise (info → success/warning → error). */
export function submitToast<T>(
  promise: Promise<T> | (() => Promise<T>),
  messages: SubmitToastMessages
): Promise<T> {
  const pending: UpdateOptions = {
    render: messages.pending ?? "Traitement en cours...",
    type: "info",
  };

  const success: UpdateOptions<T> = {
    render: messages.success,
    type: messages.successType ?? "success",
  };

  const error: UpdateOptions<unknown> = {
    render({ data }) {
      return resolveErrorMessage(data, messages.error ?? "Une erreur est survenue");
    },
    type: "error",
  };

  return toast.promise(promise, { pending, success, error });
}
