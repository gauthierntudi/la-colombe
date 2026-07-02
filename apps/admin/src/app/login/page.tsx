"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { LoginAnimatedBackground } from "@/components/login/login-animated-bg";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { setSession } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await submitToast(
        (async () => {
          const res = await fetch("/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error?.message ?? "Connexion échouée");
          }

          setSession(data.accessToken, data.refreshToken, data.user);
          router.push("/dashboard");
        })(),
        {
          pending: "Connexion en cours...",
          success: "Connexion réussie",
        }
      );
    } catch {
      /* toast affiché */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="relative h-56 shrink-0 lg:h-auto lg:flex-1 lg:min-h-screen">
        <LoginAnimatedBackground />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--surface)] lg:max-w-md xl:max-w-lg relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center mb-8">
            <Image
              src="/images/logo-app.png"
              alt="La Colombe"
              width={220}
              height={56}
              className="h-14 w-auto object-contain"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </div>

          <div className="p-6 lg:p-0">
            <h1 className="text-xl font-bold mb-1">Connexion</h1>
            <p className="text-sm text-[var(--muted)] mb-6">Espace administrateur</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    className="input-field pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          </div>

          <p className="text-xs text-[var(--muted)] text-center mt-4 leading-relaxed">
            La qualité qui nourrit votre confiance.
          </p>
        </div>
      </div>
    </div>
  );
}
