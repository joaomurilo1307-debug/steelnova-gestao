"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import TopBar from "@/components/TopBar";

type Usuario = { id: string; name: string; email: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  ENGENHEIRO: "Engenheiro",
  MESTRE_OBRA: "Mestre de obra",
  VISUALIZADOR: "Visualizador",
};

export default function EquipePage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ENGENHEIRO" });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function handleReset(id: string) {
    if (resetValue.length < 8) {
      setResetMsg("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetValue }),
    });
    setResetMsg(res.ok ? "Senha atualizada." : "Não foi possível atualizar a senha.");
    if (res.ok) {
      setResetId(null);
      setResetValue("");
    }
  }

  async function load() {
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsuarios(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setError("Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.");
      return;
    }
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error === "string" ? body.error : "Não foi possível criar o usuário.");
      return;
    }
    setCreated({ email: form.email, password: form.password });
    setForm({ name: "", email: "", password: "", role: "ENGENHEIRO" });
    load();
  }

  return (
    <div>
      <TopBar title="Equipe" subtitle="Pessoas da SteelNova" />

      <div className="p-6">
        {isAdmin && (
          <details className="mb-4 rounded-xl border border-ink-800 bg-ink-900 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-fg">+ Criar acesso</summary>
            <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-48 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-56 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Senha inicial</label>
                <input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-40 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Perfil</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="ENGENHEIRO">Engenheiro</option>
                  <option value="MESTRE_OBRA">Mestre de obra</option>
                  <option value="VISUALIZADOR">Visualizador</option>
                </select>
              </div>
              <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Criar
              </button>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {created && (
              <p className="mt-2 text-sm text-emerald-600">
                Criado: {created.email} / senha {created.password} — anote e repasse com segurança.
              </p>
            )}
          </details>
        )}

        {resetMsg && <p className="mb-3 text-sm text-neutral-600">{resetMsg}</p>}

        <div className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Perfil</th>
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-ink-800">
                  <td className="px-4 py-3 text-fg">{u.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                  <td className="px-4 py-3 text-neutral-600">{ROLE_LABEL[u.role] ?? u.role}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {resetId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={resetValue}
                            onChange={(e) => setResetValue(e.target.value)}
                            placeholder="Nova senha (mín. 8)"
                            className="w-40 rounded-lg border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-fg outline-none focus:border-brand"
                          />
                          <button
                            onClick={() => handleReset(u.id)}
                            className="rounded-lg bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => {
                              setResetId(null);
                              setResetValue("");
                            }}
                            className="text-xs text-neutral-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResetId(u.id);
                            setResetValue("");
                            setResetMsg(null);
                          }}
                          className="text-xs text-brand hover:underline"
                        >
                          Redefinir senha
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
