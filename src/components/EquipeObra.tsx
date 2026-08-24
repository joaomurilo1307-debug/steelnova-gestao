"use client";

import { useEffect, useState } from "react";

type Membro = { id: string; funcao: string; user: { id: string; name: string } };
type Usuario = { id: string; name: string; email: string };
type Funcionario = { id: string; nome: string; cargo: string | null; regime: string };

export default function EquipeObra({ obraId }: { obraId: string }) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [form, setForm] = useState({ userId: "", funcao: "" });

  async function load() {
    const [mRes, uRes, fRes] = await Promise.all([
      fetch(`/api/obras/${obraId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/usuarios").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/funcionarios").then((r) => (r.ok ? r.json() : [])),
    ]);
    if (mRes?.membros) setMembros(mRes.membros);
    setUsuarios(uRes);
    setFuncionarios(fRes);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId || !form.funcao.trim()) return;
    const res = await fetch(`/api/obras/${obraId}/membros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ userId: "", funcao: "" });
      load();
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remover esse membro da obra?")) return;
    const res = await fetch(`/api/obras/${obraId}/membros?userId=${userId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="p-8">
      <h2 className="mb-2 text-sm font-semibold text-fg">Sócios / responsáveis</h2>
      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Pessoa</label>
          <select
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            className="w-56 pill-field px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Função na obra</label>
          <input
            placeholder="Engenheiro, Mestre de obra..."
            value={form.funcao}
            onChange={(e) => setForm({ ...form, funcao: e.target.value })}
            className="w-56 pill-field px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Adicionar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {membros.map((m) => (
          <div key={m.id} className="flex items-center justify-between card p-4">
            <div>
              <p className="text-sm font-medium text-fg">{m.user.name}</p>
              <p className="text-xs text-neutral-500">{m.funcao}</p>
            </div>
            <button onClick={() => handleRemove(m.user.id)} className="text-xs text-red-600 hover:underline">
              Remover
            </button>
          </div>
        ))}
        {membros.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">
            Nenhum membro vinculado ainda.
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Equipe de campo</h2>
        <a href="../diarias" className="text-xs text-brand hover:underline">
          Cadastrar / editar em Diárias →
        </a>
      </div>
      <p className="mb-2 text-xs text-neutral-500">Soldadores, instaladores, ajudantes e demais — compartilhados entre obras.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {funcionarios.map((f) => (
          <div key={f.id} className="card p-4">
            <p className="text-sm font-medium text-fg">{f.nome}</p>
            <p className="text-xs text-neutral-500">{f.cargo ?? "Sem cargo definido"} · {f.regime}</p>
          </div>
        ))}
        {funcionarios.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">
            Nenhum funcionário de campo cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
