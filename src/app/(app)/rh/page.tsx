"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import TopBar from "@/components/TopBar";

type Funcionario = {
  id: string;
  nome: string;
  cargo: string | null;
  regime: string;
  diariaPadrao: string | null;
  valorFixo: string | null;
  active: boolean;
};

const CARGOS = ["Mestre de obra", "Encarregado", "Soldador", "Caldeireiro", "Instalador/Montador", "Pintor", "Ajudante", "Motorista", "Outro"];

export default function RhPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [form, setForm] = useState({ nome: "", cargo: CARGOS[0], regime: "Diaria", diariaPadrao: "", valorFixo: "" });

  async function load() {
    const res = await fetch(`/api/funcionarios${mostrarInativos ? "?todos=1" : ""}`);
    if (res.ok) setFuncs(await res.json());
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarInativos]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const res = await fetch("/api/funcionarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        cargo: form.cargo || undefined,
        regime: form.regime,
        diariaPadrao: form.diariaPadrao ? Number(form.diariaPadrao) : undefined,
        valorFixo: form.valorFixo ? Number(form.valorFixo) : undefined,
      }),
    });
    if (res.ok) {
      setForm({ nome: "", cargo: CARGOS[0], regime: "Diaria", diariaPadrao: "", valorFixo: "" });
      load();
    }
  }

  async function patch(id: string, body: any) {
    setFuncs((prev) => prev.map((f) => (f.id === id ? { ...f, ...body } : f)));
    await fetch(`/api/funcionarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function toggleAtivo(f: Funcionario) {
    await patch(f.id, { active: !f.active });
    if (!mostrarInativos) load();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este funcionário permanentemente? (se ele já tem ponto lançado, prefira Desativar)")) return;
    const res = await fetch(`/api/funcionarios/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert("Não foi possível excluir (pode ter lançamentos vinculados). Use Desativar.");
  }

  const ativos = funcs.filter((f) => f.active);
  const porCargo = CARGOS.map((c) => ({ cargo: c, n: ativos.filter((f) => f.cargo === c).length })).filter((x) => x.n > 0);
  const nDiaria = ativos.filter((f) => f.regime === "Diaria").length;
  const nFixo = ativos.filter((f) => f.regime === "Fixo").length;
  const cellInput = "w-full rounded-lg border border-ink-700 bg-ink-950 px-2 py-1 text-sm";

  return (
    <div>
      <TopBar title="RH — Funcionários" subtitle="Cadastro e controle da equipe de campo" />

      <div className="p-8">
        {/* Resumo */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/60">Funcionários ativos</p>
            <p className="mt-0.5 text-3xl font-bold text-sky-700">{ativos.length}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-100 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-900/60">Por diária</p>
            <p className="mt-0.5 text-3xl font-bold text-violet-700">{nDiaria}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/60">Fixos</p>
            <p className="mt-0.5 text-3xl font-bold text-amber-700">{nFixo}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Cargos</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {porCargo.length === 0 ? (
                <span className="text-sm text-neutral-400">—</span>
              ) : (
                porCargo.map((c) => (
                  <span key={c.cargo} className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-fg-muted">
                    {c.cargo}: {c.n}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Cadastro */}
        <h2 className="mb-2 text-sm font-semibold text-fg">Cadastrar funcionário</h2>
        <form onSubmit={handleAdd} className="mb-6 flex flex-wrap items-end gap-2">
          <input
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-44 pill-field px-3 py-2 text-sm"
          />
          <select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="pill-field px-3 py-2 text-sm">
            {CARGOS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })} className="pill-field px-3 py-2 text-sm">
            <option value="Diaria">Diária</option>
            <option value="Fixo">Fixo</option>
          </select>
          {form.regime === "Fixo" ? (
            <input
              type="number"
              placeholder="Valor fixo (mês)"
              value={form.valorFixo}
              onChange={(e) => setForm({ ...form, valorFixo: e.target.value })}
              className="w-36 pill-field px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="number"
              placeholder="Diária (R$)"
              value={form.diariaPadrao}
              onChange={(e) => setForm({ ...form, diariaPadrao: e.target.value })}
              className="w-32 pill-field px-3 py-2 text-sm"
            />
          )}
          <button type="submit" className="btn-primary px-4 py-2 text-sm">Cadastrar</button>
          <label className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
            Mostrar inativos
          </label>
        </form>

        {/* Tabela */}
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-600">
              <tr>
                <th className="th-label">Nome</th>
                <th className="th-label">Cargo</th>
                <th className="th-label">Regime</th>
                <th className="th-label">Diária / Fixo</th>
                <th className="th-label">Status</th>
                <th className="th-label"></th>
              </tr>
            </thead>
            <tbody>
              {funcs.map((f) => (
                <tr key={f.id} className={`border-t border-ink-800 ${!f.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2">
                    <input
                      defaultValue={f.nome}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== f.nome && patch(f.id, { nome: e.target.value.trim() })}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select value={f.cargo ?? ""} onChange={(e) => patch(f.id, { cargo: e.target.value })} className={cellInput}>
                      <option value="">—</option>
                      {CARGOS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select value={f.regime} onChange={(e) => patch(f.id, { regime: e.target.value })} className={cellInput}>
                      <option value="Diaria">Diária</option>
                      <option value="Fixo">Fixo</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {f.regime === "Fixo" ? (
                      <input
                        type="number"
                        defaultValue={f.valorFixo ?? ""}
                        onBlur={(e) => patch(f.id, { valorFixo: e.target.value ? Number(e.target.value) : null })}
                        className={cellInput}
                        placeholder="fixo/mês"
                      />
                    ) : (
                      <input
                        type="number"
                        defaultValue={f.diariaPadrao ?? ""}
                        onBlur={(e) => patch(f.id, { diariaPadrao: e.target.value ? Number(e.target.value) : null })}
                        className={cellInput}
                        placeholder="diária"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${f.active ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-neutral-300 bg-neutral-100 text-neutral-600"}`}>
                      {f.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => toggleAtivo(f)} className="text-xs text-brand hover:underline">
                      {f.active ? "Desativar" : "Reativar"}
                    </button>
                    {isAdmin && (
                      <button onClick={() => excluir(f.id)} className="ml-3 text-xs text-neutral-400 hover:text-red-500">
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {funcs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                    Nenhum funcionário cadastrado. Adicione a equipe de campo acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          A equipe cadastrada aqui aparece nas Diárias e no RDO de todas as obras. Prefira <b>Desativar</b> a Excluir quando já houver ponto lançado.
        </p>
      </div>
    </div>
  );
}
