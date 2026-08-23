"use client";

import { useMemo, useState, useEffect } from "react";
import Avatar from "@/components/Avatar";
import { personColor } from "@/lib/personColor";

type Tarefa = {
  id: string;
  eap: string | null;
  fase: string | null;
  titulo: string;
  status: string;
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  pessoas: number | null;
  horas: string | null;
  turno: string | null;
  responsavelNome: string | null;
  observacoes: string | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  responsavelId: string | null;
  predecessoraId: string | null;
  dataInicioReal: string | null;
  dataFimReal: string | null;
};

const FASE_COLORS = ["#E8802B", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f43f5e", "#eab308", "#65a30d"];

const ZOOM_PRESETS = { compacto: 14, medio: 24, largo: 38 } as const;
const NOME_PRESETS = { estreita: 170, larga: 300 } as const;

function toDate(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00");
}
function addDias(d: Date, dias: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + dias);
  return n;
}
function diffDias(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}
function fim(t: Tarefa) {
  if (!t.dataInicio) return null;
  return addDias(toDate(t.dataInicio), t.duracaoDias - 1);
}

export default function Cronograma({
  obraId,
  obraInicio,
  obraPrazoDias,
}: {
  obraId: string;
  obraInicio: string;
  obraPrazoDias: number;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<{ userId: string; nome: string; avatarUrl: string | null }[]>([]);
  const [zoom, setZoom] = useState<keyof typeof ZOOM_PRESETS>("medio");
  const [nomeWidth, setNomeWidth] = useState<keyof typeof NOME_PRESETS>("estreita");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    eap: "",
    fase: "",
    titulo: "",
    dataInicio: "",
    duracaoDias: "1",
    pessoas: "",
    horas: "",
    turno: "Dia",
    responsavelId: "",
    observacoes: "",
  });

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const res = await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        eap: form.eap || undefined,
        fase: form.fase || undefined,
        titulo: form.titulo,
        dataInicio: form.dataInicio || undefined,
        duracaoDias: Number(form.duracaoDias),
        pessoas: form.pessoas ? Number(form.pessoas) : undefined,
        horas: form.horas ? Number(form.horas) : undefined,
        turno: form.turno || undefined,
        responsavelId: form.responsavelId || undefined,
        observacoes: form.observacoes || undefined,
      }),
    });
    if (res.ok) {
      setForm({ eap: "", fase: "", titulo: "", dataInicio: "", duracaoDias: "1", pessoas: "", horas: "", turno: "Dia", responsavelId: "", observacoes: "" });
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover essa atividade?")) return;
    const res = await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const totalHH = tarefas.reduce((s, t) => s + (t.pessoas ?? 0) * Number(t.horas ?? 0), 0);

  const inicioObraCalc = new Date(obraInicio.slice(0, 10) + "T00:00:00");
  let totalPessoasPico = 0;
  for (let dia = 0; dia < obraPrazoDias + 5; dia++) {
    const pessoasNoDia = tarefas.reduce((s, t) => {
      if (!t.pessoas || !t.dataInicio) return s;
      const offset = Math.max(0, diffDias(inicioObraCalc, toDate(t.dataInicio)));
      const ativo = dia >= offset && dia < offset + t.duracaoDias;
      return ativo ? s + t.pessoas : s;
    }, 0);
    totalPessoasPico = Math.max(totalPessoasPico, pessoasNoDia);
  }

  const fases = useMemo(() => Array.from(new Set(tarefas.map((t) => t.fase ?? "Geral"))), [tarefas]);
  const faseColor = (fase: string | null) => FASE_COLORS[fases.indexOf(fase ?? "Geral") % FASE_COLORS.length];

  // folga = min(início da sucessora - fim desta tarefa) entre as tarefas que a têm como predecessora
  // "folga até a próxima tarefa dependente" — não é CPM de projeto inteiro, é folga local da cadeia declarada
  const folgaMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const t of tarefas) {
      const tFim = fim(t);
      if (!tFim) {
        map.set(t.id, null);
        continue;
      }
      const sucessoras = tarefas.filter((x) => x.predecessoraId === t.id && x.dataInicio);
      if (sucessoras.length === 0) {
        map.set(t.id, null);
        continue;
      }
      const folga = Math.min(...sucessoras.map((s) => diffDias(tFim, toDate(s.dataInicio!))));
      map.set(t.id, folga);
    }
    return map;
  }, [tarefas]);

  const tarefasCriticas = tarefas.filter((t) => (folgaMap.get(t.id) ?? 1) <= 0).length;

  // grade de dias
  const dayWidth = ZOOM_PRESETS[zoom];
  const nomeW = NOME_PRESETS[nomeWidth];
  const maxOffsetFim = tarefas.reduce((max, t) => {
    if (!t.dataInicio) return max;
    const offset = Math.max(0, diffDias(inicioObraCalc, toDate(t.dataInicio)));
    return Math.max(max, offset + t.duracaoDias);
  }, obraPrazoDias);
  const totalDias = Math.max(maxOffsetFim, obraPrazoDias, 1) + 3;
  const dias = Array.from({ length: totalDias }, (_, i) => addDias(inicioObraCalc, i));
  const hojeOffset = diffDias(inicioObraCalc, new Date(new Date().toDateString()));

  const meses: { label: string; dias: number }[] = [];
  for (const d of dias) {
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    const last = meses[meses.length - 1];
    if (last && last.label === label) last.dias += 1;
    else meses.push({ label, dias: 1 });
  }

  // colunas fixas (sticky) — larguras e offsets acumulados
  const COLS = [
    { key: "eap", label: "EAP", w: 44 },
    { key: "titulo", label: "Atividade", w: nomeW },
    { key: "dur", label: "Dur.", w: 44 },
    { key: "inicioPrev", label: "Início prev.", w: 84 },
    { key: "fimPrev", label: "Término prev.", w: 84 },
    { key: "inicioReal", label: "Início real", w: 118 },
    { key: "fimReal", label: "Término real", w: 118 },
    { key: "pct", label: "%", w: 56 },
    { key: "folga", label: "Folga", w: 54 },
    { key: "resp", label: "Responsável", w: 150 },
    { key: "pred", label: "Predec.", w: 150 },
    { key: "remover", label: "", w: 60 },
  ];
  let acc = 0;
  const offsets = COLS.map((c) => {
    const o = acc;
    acc += c.w;
    return o;
  });
  const totalStickyW = acc;

  const stickyTh = "sticky z-30 border-b border-r border-ink-800 bg-ink-900 px-2 py-2 text-xs font-medium text-neutral-600";
  const stickyTd = "sticky z-10 border-r border-ink-800 bg-ink-900 px-2 py-1.5 text-xs";

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
          <span className="text-neutral-500">Atividades: </span>
          <span className="font-medium text-fg">{tarefas.length}</span>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
          <span className="text-neutral-500">Esforço total: </span>
          <span className="font-medium text-fg">{totalHH.toFixed(0)} HH</span>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
          <span className="text-neutral-500">Pico de equipe: </span>
          <span className="font-medium text-fg">{totalPessoasPico} pessoas</span>
        </div>
        {tarefasCriticas > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            ⚠ {tarefasCriticas} tarefa{tarefasCriticas > 1 ? "s" : ""} crítica{tarefasCriticas > 1 ? "s" : ""}
          </div>
        )}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {showForm ? "Fechar formulário" : "+ Nova atividade"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-ink-800 bg-ink-900 p-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">EAP</label>
            <input value={form.eap} onChange={(e) => setForm({ ...form, eap: e.target.value })} placeholder="1.0" className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Fase</label>
            <input value={form.fase} onChange={(e) => setForm({ ...form, fase: e.target.value })} placeholder="Fabricação" className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Atividade</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Início</label>
            <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Duração (dias)</label>
            <input type="number" min={1} value={form.duracaoDias} onChange={(e) => setForm({ ...form, duracaoDias: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Pessoas</label>
            <input type="number" min={0} value={form.pessoas} onChange={(e) => setForm({ ...form, pessoas: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Horas</label>
            <input type="number" step="0.5" min={0} value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Turno</label>
            <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand">
              <option>Dia</option>
              <option>Noite</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Responsável (equipe da obra)</label>
            <select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand">
              <option value="">Sem responsável</option>
              {membros.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Observações</label>
            <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <button type="submit" className="col-span-2 self-end rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark sm:col-span-1">
            Adicionar
          </button>
        </form>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-neutral-500">Zoom:</span>
        <div className="flex overflow-hidden rounded-lg border border-ink-700">
          {(Object.keys(ZOOM_PRESETS) as (keyof typeof ZOOM_PRESETS)[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 capitalize ${zoom === z ? "bg-brand text-white" : "bg-ink-900 text-neutral-500 hover:bg-ink-800"}`}
            >
              {z}
            </button>
          ))}
        </div>
        <span className="ml-2 text-neutral-500">Nome:</span>
        <div className="flex overflow-hidden rounded-lg border border-ink-700">
          {(Object.keys(NOME_PRESETS) as (keyof typeof NOME_PRESETS)[]).map((n) => (
            <button
              key={n}
              onClick={() => setNomeWidth(n)}
              className={`px-2.5 py-1 capitalize ${nomeWidth === n ? "bg-brand text-white" : "bg-ink-900 text-neutral-500 hover:bg-ink-800"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 max-h-[75vh] overflow-auto rounded-xl border border-ink-800 bg-ink-900">
        <table
          className="text-sm"
          style={{
            width: totalStickyW + totalDias * dayWidth,
            tableLayout: "fixed",
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr style={{ height: 28 }}>
              <th
                className="sticky left-0 top-0 z-40 border-b border-r border-ink-800 bg-ink-900"
                style={{ width: totalStickyW, minWidth: totalStickyW, height: 28 }}
                colSpan={COLS.length}
              />
              {meses.map((m, i) => (
                <th
                  key={i}
                  colSpan={m.dias}
                  className="sticky top-0 z-20 whitespace-nowrap border-b border-r border-ink-800 bg-ink-900 px-2 text-xs font-medium capitalize text-neutral-500"
                  style={{ height: 28 }}
                >
                  {m.label}
                </th>
              ))}
            </tr>
            <tr style={{ height: 30 }}>
              {COLS.map((c, i) => (
                <th key={c.key} className={stickyTh} style={{ top: 28, left: offsets[i], width: c.w, minWidth: c.w, height: 30 }}>
                  {c.label}
                </th>
              ))}
              {dias.map((d, i) => (
                <th
                  key={i}
                  className={`sticky z-20 border-b border-ink-800 bg-ink-900 text-center text-[10px] font-normal text-neutral-500 ${
                    diffDias(inicioObraCalc, d) === hojeOffset ? "bg-brand/10 font-bold text-brand" : ""
                  }`}
                  style={{ top: 28, width: dayWidth, minWidth: dayWidth, height: 30 }}
                >
                  {d.getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => {
              const inicio = t.dataInicio ? toDate(t.dataInicio) : null;
              const offset = inicio ? Math.max(0, diffDias(inicioObraCalc, inicio)) : 0;
              const folga = folgaMap.get(t.id);
              const critica = folga !== null && folga !== undefined && folga <= 0;
              const cor = faseColor(t.fase);

              const realInicio = t.dataInicioReal ? toDate(t.dataInicioReal) : null;
              const realOffset = realInicio ? Math.max(0, diffDias(inicioObraCalc, realInicio)) : null;
              const realFimD = t.dataFimReal ? toDate(t.dataFimReal) : null;
              const realDur = realOffset !== null ? (realFimD ? diffDias(realInicio!, realFimD) + 1 : 1) : null;

              return (
                <tr key={t.id} className={critica ? "bg-rose-50/40" : ""}>
                  <td className={stickyTd} style={{ left: offsets[0], width: COLS[0].w }}>
                    {t.eap ?? "—"}
                  </td>
                  <td className={stickyTd} style={{ left: offsets[1], width: COLS[1].w }}>
                    <div className="flex items-center gap-1.5">
                      {critica && <span className="h-full w-1 shrink-0 self-stretch rounded-full bg-rose-500" />}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg" title={t.titulo}>
                          {t.titulo}
                        </p>
                        <p className="truncate text-[10px] text-neutral-500">
                          {[t.fase, t.turno, t.pessoas && `${t.pessoas}p`, t.horas && `${t.horas}h`].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={stickyTd} style={{ left: offsets[2], width: COLS[2].w }}>
                    {t.duracaoDias}
                  </td>
                  <td className={`${stickyTd} whitespace-nowrap`} style={{ left: offsets[3], width: COLS[3].w }}>
                    {inicio ? fmt(inicio) : "—"}
                  </td>
                  <td className={`${stickyTd} whitespace-nowrap`} style={{ left: offsets[4], width: COLS[4].w }}>
                    {fim(t) ? fmt(fim(t)!) : "—"}
                  </td>
                  <td className={stickyTd} style={{ left: offsets[5], width: COLS[5].w }}>
                    <input
                      type="date"
                      defaultValue={t.dataInicioReal ? t.dataInicioReal.slice(0, 10) : ""}
                      onBlur={(e) => patch(t.id, { dataInicioReal: e.target.value || null })}
                      className="w-full rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-[11px] text-fg outline-none focus:border-brand"
                    />
                  </td>
                  <td className={stickyTd} style={{ left: offsets[6], width: COLS[6].w }}>
                    <input
                      type="date"
                      defaultValue={t.dataFimReal ? t.dataFimReal.slice(0, 10) : ""}
                      onBlur={(e) => patch(t.id, { dataFimReal: e.target.value || null })}
                      className="w-full rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-[11px] text-fg outline-none focus:border-brand"
                    />
                  </td>
                  <td className={stickyTd} style={{ left: offsets[7], width: COLS[7].w }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={t.percentConcluido}
                      onBlur={(e) => {
                        const percent = Number(e.target.value);
                        patch(t.id, { percentConcluido: percent, status: percent >= 100 ? "FEITO" : percent > 0 ? "FAZENDO" : "A_FAZER" });
                      }}
                      className="w-full rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-[11px] text-fg outline-none focus:border-brand"
                    />
                  </td>
                  <td className={`${stickyTd} ${critica ? "font-semibold text-rose-600" : "text-neutral-500"}`} style={{ left: offsets[8], width: COLS[8].w }}>
                    {folga !== null && folga !== undefined ? `${folga}d` : "—"}
                  </td>
                  <td className={stickyTd} style={{ left: offsets[9], width: COLS[9].w }}>
                    <div className="flex items-center gap-1">
                      {t.responsavel && (
                        <Avatar name={t.responsavel.name} photoUrl={t.responsavel.avatarUrl} color={personColor(t.responsavel.id)} size={18} />
                      )}
                      <select
                        value={t.responsavelId ?? ""}
                        onChange={(e) => patch(t.id, { responsavelId: e.target.value || null })}
                        className="w-full rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-[11px] text-fg outline-none focus:border-brand"
                      >
                        <option value="">—</option>
                        {membros.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className={stickyTd} style={{ left: offsets[10], width: COLS[10].w }}>
                    <select
                      value={t.predecessoraId ?? ""}
                      onChange={(e) => patch(t.id, { predecessoraId: e.target.value || null })}
                      className="w-full rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-[11px] text-fg outline-none focus:border-brand"
                    >
                      <option value="">—</option>
                      {tarefas
                        .filter((x) => x.id !== t.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.eap ? `${x.eap} · ` : ""}
                            {x.titulo}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className={stickyTd} style={{ left: offsets[11], width: COLS[11].w }}>
                    <button onClick={() => handleDelete(t.id)} className="text-[11px] text-red-600 hover:underline">
                      Remover
                    </button>
                  </td>

                  {dias.map((d, i) => {
                    const dOffset = diffDias(inicioObraCalc, d);
                    const emBarra = inicio && dOffset >= offset && dOffset < offset + t.duracaoDias;
                    const inicioBarra = emBarra && dOffset === offset;
                    return (
                      <td
                        key={i}
                        className={`relative border-b border-ink-800/40 ${dOffset === hojeOffset ? "bg-brand/5" : ""}`}
                        style={{ width: dayWidth, minWidth: dayWidth, height: 34 }}
                      >
                        {inicioBarra && (
                          <div
                            className="absolute top-1 h-3 rounded-sm"
                            style={{
                              left: 1,
                              width: t.duracaoDias * dayWidth - 2,
                              backgroundColor: critica ? "#e11d48" : cor,
                              opacity: t.status === "FEITO" ? 1 : 0.75,
                            }}
                            title={`${t.titulo} — ${t.percentConcluido}%`}
                          >
                            {t.percentConcluido > 0 && (
                              <div className="h-full rounded-sm bg-black/25" style={{ width: `${Math.min(t.percentConcluido, 100)}%` }} />
                            )}
                          </div>
                        )}
                        {realOffset !== null && dOffset === realOffset && (
                          <div
                            className="absolute bottom-1 h-1 rounded-sm bg-neutral-800"
                            style={{ left: 1, width: (realDur ?? 1) * dayWidth - 2 }}
                            title={`Real: ${t.dataInicioReal?.slice(0, 10)} → ${t.dataFimReal?.slice(0, 10) ?? "em andamento"}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {tarefas.length === 0 && (
              <tr>
                <td colSpan={COLS.length + totalDias} className="px-4 py-10 text-center text-neutral-500">
                  Nenhuma atividade cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        {fases.map((f) => (
          <span key={f} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: faseColor(f) }} />
            {f}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-neutral-800" /> Real
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> Crítica (folga ≤ 0)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-brand" /> Hoje
        </span>
      </div>
    </div>
  );
}
