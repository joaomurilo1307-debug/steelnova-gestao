"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";

type Tarefa = {
  id: string;
  titulo: string;
  status: "A_FAZER" | "FAZENDO" | "BLOQUEADO" | "FEITO";
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  dataInicio: string | null;
  duracaoDias: number;
  responsavelId: string | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  tarefaMaeId: string | null;
  horasEstimadas: string | null;
  valorHora: string | null;
};

type Membro = { userId: string; nome: string; avatarUrl: string | null };

const STATUS_LABEL: Record<string, string> = {
  A_FAZER: "A fazer",
  FAZENDO: "Fazendo",
  BLOQUEADO: "Bloqueado",
  FEITO: "Feito",
};
const STATUS_COLOR: Record<string, string> = {
  A_FAZER: "bg-neutral-200 text-neutral-700",
  FAZENDO: "bg-blue-100 text-blue-700",
  BLOQUEADO: "bg-rose-100 text-rose-700",
  FEITO: "bg-emerald-100 text-emerald-700",
};
const PRIORIDADE_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};
const PRIORIDADE_COLOR: Record<string, string> = {
  BAIXA: "bg-neutral-200 text-neutral-700",
  MEDIA: "bg-blue-100 text-blue-700",
  ALTA: "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
};
const PRIORIDADE_BORDA: Record<string, string> = {
  BAIXA: "#d1d5db",
  MEDIA: "#3b82f6",
  ALTA: "#f97316",
  URGENTE: "#ef4444",
};

function prazo(t: Tarefa) {
  if (!t.dataInicio) return null;
  const d = new Date(t.dataInicio.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + t.duracaoDias - 1);
  return d;
}

function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function TarefaListView({ obraId }: { obraId: string }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  async function load() {
    const [tRes, oRes] = await Promise.all([fetch(`/api/tarefas?obraId=${obraId}`), fetch(`/api/obras/${obraId}`)]);
    if (tRes.ok) setTarefas(await tRes.json());
    if (oRes.ok) {
      const obra = await oRes.json();
      setMembros(obra.membros.map((m: any) => ({ userId: m.user.id, nome: m.user.name, avatarUrl: m.user.avatarUrl ?? null })));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function patch(id: string, body: any) {
    await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  // monta hierarquia: raízes + filhos, por ordem
  const linhas = useMemo(() => {
    const porMae = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      const key = t.tarefaMaeId ?? "__root__";
      if (!porMae.has(key)) porMae.set(key, []);
      porMae.get(key)!.push(t);
    }
    const out: { tarefa: Tarefa; depth: number }[] = [];
    function walk(key: string, depth: number) {
      for (const t of porMae.get(key) ?? []) {
        out.push({ tarefa: t, depth });
        if (!collapsed.has(t.id)) walk(t.id, depth + 1);
      }
    }
    walk("__root__", 0);
    return out;
  }, [tarefas, collapsed]);

  const inputCls = "rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-fg outline-none focus:border-brand";

  return (
    <div className="p-6">
      <div className="max-h-[75vh] overflow-auto rounded-xl border border-ink-800 bg-ink-900">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Título</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Status</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Prioridade</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Responsável</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Início</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Prazo</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Tarefa-mãe</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Horas est.</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Valor hora</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Custo est.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ tarefa: t, depth }) => {
              const fim = prazo(t);
              const atrasada = !!fim && t.status !== "FEITO" && fim < new Date(new Date().toDateString());
              const temFilhas = tarefas.some((x) => x.tarefaMaeId === t.id);
              const custo = t.horasEstimadas && t.valorHora ? Number(t.horasEstimadas) * Number(t.valorHora) : null;

              return (
                <tr key={t.id} className="border-t border-ink-800">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 20 }}>
                      <span className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: PRIORIDADE_BORDA[t.prioridade] }} />
                      {temFilhas && (
                        <button
                          onClick={() =>
                            setCollapsed((c) => {
                              const next = new Set(c);
                              next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                              return next;
                            })
                          }
                          className="text-neutral-500"
                        >
                          {collapsed.has(t.id) ? "▸" : "▾"}
                        </button>
                      )}
                      {depth > 0 && <span className="text-neutral-500">↳</span>}
                      <span className="text-fg">{t.titulo}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.status}
                      onChange={(e) => patch(t.id, { status: e.target.value })}
                      className={`rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold outline-none hover:border-ink-700 ${STATUS_COLOR[t.status]}`}
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.prioridade}
                      onChange={(e) => patch(t.id, { prioridade: e.target.value })}
                      className={`rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold outline-none hover:border-ink-700 ${PRIORIDADE_COLOR[t.prioridade]}`}
                    >
                      {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {t.responsavel && <Avatar name={t.responsavel.name} photoUrl={t.responsavel.avatarUrl} size={20} />}
                      <select
                        value={t.responsavelId ?? ""}
                        onChange={(e) => patch(t.id, { responsavelId: e.target.value || null })}
                        className={inputCls}
                      >
                        <option value="">Sem responsável</option>
                        {membros.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      defaultValue={t.dataInicio ? t.dataInicio.slice(0, 10) : ""}
                      onBlur={(e) => patch(t.id, { dataInicio: e.target.value || undefined })}
                      className={inputCls}
                    />
                  </td>
                  <td className={`px-3 py-2 ${atrasada ? "bg-rose-50" : ""}`}>
                    {fim ? (
                      <span className={atrasada ? "font-medium text-rose-700" : "text-neutral-600"}>
                        {fmt(fim)}
                        {atrasada && <span className="ml-1 text-[10px] font-semibold text-rose-500">atrasada</span>}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={t.tarefaMaeId ?? ""}
                      onChange={(e) => patch(t.id, { tarefaMaeId: e.target.value || null })}
                      className={inputCls}
                    >
                      <option value="">— (tarefa principal)</option>
                      {tarefas
                        .filter((x) => x.id !== t.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.titulo}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      defaultValue={t.horasEstimadas ?? ""}
                      onBlur={(e) => patch(t.id, { horasEstimadas: e.target.value ? Number(e.target.value) : null })}
                      className={`${inputCls} w-20`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={t.valorHora ?? ""}
                      onBlur={(e) => patch(t.id, { valorHora: e.target.value ? Number(e.target.value) : null })}
                      className={`${inputCls} w-24`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-fg">
                    {custo !== null ? custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-neutral-500">
                  Nenhuma atividade cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
