"use client";

import { FormEvent, useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { FormField } from "@/components/ui/form-field";
import { AvatarUploadField } from "@/components/users/avatar-upload-field";
import {
  apiFetch,
  AuthUser,
  getToken,
  getUser,
  updateStoredUser,
} from "@/lib/client-api";
import { submitToast } from "@/lib/toast";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ user: AuthUser }>("/auth/me");
        setUser(res.user);
        setName(res.user.name);
        setEmail(res.user.email);
        setAvatarUrl(res.user.avatarUrl ?? "");
      } catch (err) {
        const cached = getUser();
        if (cached) {
          setUser(cached);
          setName(cached.name);
          setEmail(cached.email);
          setAvatarUrl(cached.avatarUrl ?? "");
        } else {
          setError(err instanceof Error ? err.message : "Erreur");
        }
      } finally {
        setLoading(false);
      }
    }
    load().catch(console.error);
  }, []);

  async function handleAvatarChange(url: string, updatedUser?: AuthUser) {
    setAvatarUrl(url);
    setError("");

    if (updatedUser) {
      setUser(updatedUser);
      updateStoredUser(updatedUser);
      return;
    }

    if (!url) {
      try {
        const res = await submitToast(
          apiFetch<{ user: AuthUser }>("/auth/me", {
            method: "PUT",
            body: JSON.stringify({ avatarUrl: null }),
          }),
          {
            pending: "Suppression de la photo...",
            success: "Photo de profil retirée",
          }
        );
        setUser(res.user);
        updateStoredUser(res.user);
      } catch {
        /* toast affiché */
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const payload: Record<string, string | null> = { name, email };
      const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();

      if (password || emailChanged) {
        payload.currentPassword = currentPassword;
      }
      if (password) {
        payload.password = password;
      }

      const res = await submitToast(
        apiFetch<{ user: AuthUser }>("/auth/me", {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
        {
          pending: "Enregistrement du profil...",
          success: "Profil enregistré",
        }
      );

      setUser(res.user);
      setEmail(res.user.email);
      updateStoredUser(res.user);
      setCurrentPassword("");
      setPassword("");
    } catch {
      /* toast affiché */
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return <p className="p-6 text-[var(--muted)] text-sm">Chargement...</p>;
  }

  return (
    <>
      <DashboardHeader
        title="Mon profil"
        subtitle="Gérez votre photo et vos informations personnelles"
        user={user}
      />

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-3 mb-4 max-w-xl mx-auto w-full">
          {error}
        </div>
      )}

      <div className="max-w-xl mx-auto w-full">
        <div className="glass-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center border-b border-[var(--border-light)] pb-6 mb-2">
              <p className="text-sm font-semibold mb-4 w-full text-center">Photo de profil</p>
              <AvatarUploadField
                value={avatarUrl}
                name={name}
                onChange={handleAvatarChange}
                disabled={!getToken()}
                centered
              />
            </div>

          <FormField label="Nom complet" required>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Email" required hint="Mot de passe actuel requis si vous changez l'email">
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>

          <div className="border-t border-[var(--border-light)] pt-4 space-y-4">
            <p className="text-sm font-semibold">Changer le mot de passe</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Mot de passe actuel">
                <input
                  className="input-field"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Requis pour changer le mot de passe"
                />
              </FormField>
              <FormField label="Nouveau mot de passe" hint="Minimum 6 caractères">
                <input
                  className="input-field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                />
              </FormField>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={saving}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
        </div>
      </div>
    </>
  );
}
