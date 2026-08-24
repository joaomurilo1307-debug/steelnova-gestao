"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";

type Usuario = { id: string; name: string };
type Atribuicao = { id: string; papel: "R" | "A" | "C" | "I"; user: Usuario };
type Processo = { id: string; nome: string; area: string; atribuicoes: Atribuicao[] };

const PAPEL_INFO: Record<string, { label: string; classe: string }> = {
  R: { label: "R", classe: "bg-blue-100 text-blue-700" },
  A: { label: "A", classe: "bg-brand/15 text-brand-dark" },
  C: { label: "C", classe: "bg-amber-100 text-amber-800" },
  I: { label: "I", classe: "bg-neutral-200 text-neutral-700" },
};

const AREAS_SUGERIDAS = ["Orçamento", "Compras", "Suprimentos", "Logística", "Medição", "Visitas técnicas", "Reuniões"];

export default function RaciPage() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novoProcesso, setNovoProcesso] = useState({ nome: "", area: AREAS_SUGERIDAS[0] });
  const [atribuindo, setAtribuindo] = useState<{ processoId: string; papel: "R" | "A" | "C" | "I" } | null>(null);
  const [userSelecionado, setUserSelecionado] = useState("");

  async function load() {
    const [pRes, uRes] = await Promise.all([fetch("/api/processos"), fetch("/api/usuarios")]);
    if (pRes.ok) setProcessos(await pRes.json());
    if (uRes.ok) setUsuarios(await uRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddProcesso(e: React.FormEvent) {
    e.preventDefault();
    if (!novoProcesso.nome.trim()) return;
    const res = await fetch("/api/processos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novoProcesso),
    });
    if (res.ok) {
      setNovoProcesso({ nome: "", area: novoProcesso.area });
      load();
    }
  }

  async function handleDeleteProcesso(id: string) {
    if (!confirm("Remover esse processo da matriz?")) return;
    const res = await fetch(`/api/processos/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function handleAtribuir(processoId: string, papel: "R" | "A" | "C" | "I") {
    if (!userSelecionado) return;
    await fetch("/api/raci", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processoId, userId: userSelecionado, papel }),
    });
    setAtribuindo(null);
    setUserSelecionado("");
    load();
  }

  async function handleRemoverAtribuicao(id: string) {
    await fetch(`/api/raci?id=${id}`, { method: "DELETE" });
    load();
  }

  const porArea = processos.reduce<Record<string, Processo[]>>((acc, p) => {
    acc[p.area] = acc[p.area] ?? [];
    acc[p.area].push(p);
    return acc;
  }, {});

  return (
    <div>
      <TopBar title="Matriz RACI" subtitle="Responsável, Aprovador, Consultado, Informado — por atividade de rotina" />

      <div className="p-8">
        <form onSubmit={handleAddProcesso} className="mb-6 flex flex-wrap items-end gap-2 card p-4">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Área</label>
            <input
              list="areas-sugeridas"
              value={novoProcesso.area}
              onChange={(e) => setNovoProcesso({ ...novoProcesso, area: e.target.value })}
              className="w-44 pill-field px-3 py-2 text-sm"
            />
            <datalist id="areas-sugeridas">
              {AREAS_SUGERIDAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Processo / Atividade</label>
            <input
              value={novoProcesso.nome}
              onChange={(e) => setNovoProcesso({ ...novoProcesso, nome: e.target.value })}
              placeholder="Ex: Aprovar orçamento de obra"
              className="w-64 pill-field px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            + Adicionar processo
          </button>
        </form>

        {Object.entries(porArea).map(([area, lista]) => (
          <div key={area} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-fg">{area}</h2>
            <div className="overflow-x-auto card">
              <table className="w-full text-sm">
                <thead className="bg-ink-900 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Processo</th>
                    <th className="px-3 py-3 font-medium">R — Responsável</th>
                    <th className="px-3 py-3 font-medium">A — Aprovador</th>
                    <th className="px-3 py-3 font-medium">C — Consultado</th>
                    <th className="px-3 py-3 font-medium">I — Informado</th>
                    <th className="px-3 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id} className="border-t border-ink-800 align-top">
                      <td className="px-4 py-3 text-fg">{p.nome}</td>
                      {(["R", "A", "C", "I"] as const).map((papel) => (
                        <td key={papel} className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.atribuicoes
                              .filter((a) => a.papel === papel)
                              .map((a) => (
                                <span
                                  key={a.id}
                                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${PAPEL_INFO[papel].classe}`}
                                >
                                  {a.user.name}
                                  <button onClick={() => handleRemoverAtribuicao(a.id)} className="hover:text-red-600">
                                    ×
                                  </button>
                                </span>
                              ))}
                            {atribuindo?.processoId === p.id && atribuindo.papel === papel ? (
                              <span className="flex items-center gap-1">
                                <select
                                  value={userSelecionado}
                                  onChange={(e) => setUserSelecionado(e.target.value)}
                                  className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-xs text-fg outline-none"
                                  autoFocus
                                >
                                  <option value="">Pessoa...</option>
                                  {usuarios.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAtribuir(p.id, papel)}
                                  className="text-xs text-brand hover:underline"
                                >
                                  ok
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setAtribuindo({ processoId: p.id, papel })}
                                className="rounded-full border border-dashed border-ink-700 px-2 py-0.5 text-xs text-neutral-500 hover:text-fg"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <button onClick={() => handleDeleteProcesso(p.id)} className="text-xs text-red-600 hover:underline">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {processos.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">
            Nenhum processo cadastrado ainda. Comece adicionando as atividades de rotina (orçamento, compras,
            suprimentos, logística, medição, visitas técnicas, reuniões...).
          </p>
        )}
      </div>
    </div>
  );
}
