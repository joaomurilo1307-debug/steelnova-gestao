"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 p-8">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image src="/logo-steelnova.png" alt="SteelNova" width={56} height={56} className="rounded" />
          <h1 className="text-lg font-semibold text-white">SteelNova Gestão</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-neutral-400">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-white outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-white outline-none focus:border-brand"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-brand px-4 py-2 font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
