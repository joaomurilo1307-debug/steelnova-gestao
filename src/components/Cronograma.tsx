"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { personColor } from "@/lib/personColor";
import { computeCPM, type DependencyType } from "@/lib/cpm";
import { buildWbsHierarchy } from "@/lib/wbs";

type Dependencia = {
  id: string;
  tipo: DependencyType;
  lagDias: number;
  predecessoraId: string;
  predecessora: { id: string; titulo: string };
};

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
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  responsavelId: string | null;
  tarefaMaeId: string | null;
  dataInicioReal: string | null;
  dataFimReal: string | null;
  dependenciasComoSucessora: Dependencia[];
};

const DEP_TYPE_LABEL: Record<DependencyType, string> = { FS: "Término → Início", SS: "Início → Início", FF: "Término → Término", SF: "Início → Término" };
const FASE_COLORS = ["#E8802B", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f43f5e", "#eab308", "#65a30d"];
const ZOOM_LEVELS = { compacto: 18, medio: 28, largo: 44 } as const;
const NAME_WIDTHS = { estreita: 200, larga: 320 } as const;
const ROW_H = 36;
const MONTH_ROW_H = 20;
const WBS_W = 40;

type ColKey = "fase" | "turno" | "pessoas" | "horas" | "tempoGasto" | "dur" | "start" | "end" | "realStart" | "realEnd" | "pct" | "float" | "assignee" | "pred";
const COLUNAS: { key: ColKey; label: string; width: number; default: boolean }[] = [
  { key: "fase", label: "Fase", width: 84, default: false },
  { key: "turno", label: "Turno", width: 56, default: false },
  { key: "pessoas", label: "Pes.", width: 40, default: false },
  { key: "horas", label: "Horas", width: 48, default: false },
  { key: "tempoGasto", label: "Tempo gasto", width: 76, default: false },
  { key: "dur", label: "Dur.", width: 52, default: true },
  { key: "start", label: "Início prev.", width: 92, default: true },
  { key: "end", label: "Término prev.", width: 88, default: true },
  { key: "realStart", label: "Início real", width: 76, default: false },
  { key: "realEnd", label: "Término real", width: 76, default: false },
  { key: "pct", label: "%", width: 48, default: true },
  { key: "float", label: "Folga", width: 58, default: true },
  { key: "assignee", label: "Responsável", width: 116, default: true },
  { key: "pred", label: "Predec.", width: 92, default: true },
];
const COL_W = Object.fromEntries(COLUNAS.map((c) => [c.key, c.width])) as Record<ColKey, number>;

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
// fim = último dia (inclusivo) da tarefa — usado pra exibir/desenhar a barra
function fim(t: Tarefa) {
  if (!t.dataInicio) return null;
  return addDias(toDate(t.dataInicio), Math.max(t.duracaoDias, 1) - 1);
}
// dueDate no sentido do computeCPM (fim EXCLUSIVO = início + duração) — só pra alimentar o CPM
// com a MESMA unidade que duracaoDias já usa, sem deslocar nenhuma tarefa por engano
function cpmDueISO(t: Tarefa) {
  if (!t.dataInicio) return null;
  return addDias(toDate(t.dataInicio), t.duracaoDias).toISOString();
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
  const [zoom, setZoom] = useState<keyof typeof ZOOM_LEVELS>("compacto");
  const [nameWidth, setNameWidth] = useState<keyof typeof NAME_WIDTHS>("estreita");
  const [showForm, setShowForm] = useState(false);
  const [showColMenu, setShowColMenu] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(new Set(COLUNAS.filter((c) => !c.default).map((c) => c.key)));
  const [depPanelFor, setDepPanelFor] = useState<string | null>(null);
  const [newPredId, setNewPredId] = useState("");
  const [newTipo, setNewTipo] = useState<DependencyType>("FS");
  const [newLag, setNewLag] = useState("0");
  const [savingDep, setSavingDep] = useState(false);
  const [drag, setDrag] = useState<{ tarefaId: string; modo: "mover" | "redimensionar"; startClientX: number; deltaDias: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const draggedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
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
    await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
      }),
    });
    if (res.ok) {
      setForm({ eap: "", fase: "", titulo: "", dataInicio: "", duracaoDias: "1", pessoas: "", horas: "", turno: "Dia", responsavelId: "" });
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover essa atividade?")) return;
    const res = await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function toggleCol(key: ColKey) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleDepPanel(tarefaId: string) {
    setDepPanelFor((prev) => (prev === tarefaId ? null : tarefaId));
    setNewPredId("");
    setNewTipo("FS");
    setNewLag("0");
  }

  async function handleAddDependencia(sucessoraId: string) {
    if (!newPredId) return;
    setSavingDep(true);
    await fetch(`/api/tarefas/${sucessoraId}/dependencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessoraId: newPredId, tipo: newTipo, lagDias: Number(newLag) || 0 }),
    });
    setSavingDep(false);
    setNewPredId("");
    setNewLag("0");
    load();
  }

  async function handleRemoveDependencia(dependenciaId: string) {
    await fetch(`/api/dependencias/${dependenciaId}`, { method: "DELETE" });
    load();
  }

  // Arrastar a barra (mover) ou a borda direita (redimensionar) — mesma mecânica do consominas:
  // um único listener no window enquanto arrasta, PATCH só quando solta.
  function handleBarPointerDown(e: React.PointerEvent, t: Tarefa, modo: "mover" | "redimensionar") {
    if (!t.dataInicio) return;
    e.preventDefault();
    e.stopPropagation();
    draggedRef.current = false;
    setDrag({ tarefaId: t.id, modo, startClientX: e.clientX, deltaDias: 0 });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const deltaDias = Math.round((e.clientX - current.startClientX) / dayWidth);
      if (deltaDias !== current.deltaDias) {
        if (deltaDias !== 0) draggedRef.current = true;
        setDrag({ ...current, deltaDias });
      }
    }
    function onUp() {
      const current = dragRef.current;
      setDrag(null);
      if (!current || current.deltaDias === 0) return;
      const t = tarefas.find((x) => x.id === current.tarefaId);
      if (!t || !t.dataInicio) return;
      if (current.modo === "redimensionar") {
        patch(t.id, { duracaoDias: Math.max(0, t.duracaoDias + current.deltaDias) });
      } else {
        patch(t.id, { dataInicio: addDias(toDate(t.dataInicio), current.deltaDias).toISOString() });
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  // Arrastar o fundo do Gantt (fora de barras/inputs/área sticky) pra navegar — igual ao consominas
  function handlePanPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, select, .sticky")) return;
    const el = scrollRef.current;
    if (!el) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
  }
  function handlePanPointerMove(e: React.PointerEvent) {
    if (!panRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.startX);
    el.scrollTop = panRef.current.scrollTop - (e.clientY - panRef.current.startY);
  }
  function handlePanPointerUp() {
    panRef.current = null;
  }

  const dayWidth = ZOOM_LEVELS[zoom];
  const namePx = NAME_WIDTHS[nameWidth];
  const visibleCols = COLUNAS.filter((c) => !hiddenCols.has(c.key));
  const TABLE_W = WBS_W + namePx + visibleCols.reduce((s, c) => s + c.width, 0);

  const totalHH = tarefas.reduce((s, t) => s + (t.pessoas ?? 0) * Number(t.horas ?? 0), 0);
  const fases = useMemo(() => Array.from(new Set(tarefas.map((t) => t.fase ?? "Geral"))), [tarefas]);
  const faseColor = (fase: string | null) => FASE_COLORS[fases.indexOf(fase ?? "Geral") % FASE_COLORS.length];

  const rows = useMemo(() => buildWbsHierarchy(tarefas), [tarefas]);
  const wbsById = useMemo(() => new Map(rows.map((r) => [r.tarefa.id, r.wbs])), [rows]);
  const byId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);

  const withDates = useMemo(() => tarefas.filter((t) => t.dataInicio), [tarefas]);
  const allDependencias = useMemo(() => {
    const list: { predecessorId: string; successorId: string; type: DependencyType; lagDays: number }[] = [];
    for (const t of tarefas) {
      for (const link of t.dependenciasComoSucessora) {
        list.push({ predecessorId: link.predecessoraId, successorId: t.id, type: link.tipo, lagDays: link.lagDias });
      }
    }
    return list;
  }, [tarefas]);
  const cpm = useMemo(
    () => computeCPM(withDates.map((t) => ({ id: t.id, startDate: t.dataInicio, dueDate: cpmDueISO(t) })), allDependencias),
    [withDates, allDependencias]
  );
  const criticalCount = Array.from(cpm.results.values()).filter((r) => r.isCritical).length;

  const { rangeStart, totalDias } = useMemo(() => {
    const inicioObra = new Date(obraInicio.slice(0, 10) + "T00:00:00");
    const datas: Date[] = [inicioObra, new Date()];
    for (const t of withDates) {
      datas.push(toDate(t.dataInicio!));
      const f = fim(t);
      if (f) datas.push(f);
    }
    const min = new Date(Math.min(...datas.map((d) => d.getTime())));
    const max = new Date(Math.max(...datas.map((d) => d.getTime()), inicioObra.getTime() + obraPrazoDias * 86400000));
    const dias = Math.max(14, diffDias(min, max) + 4);
    return { rangeStart: addDias(min, -2), totalDias: dias };
  }, [withDates, obraInicio, obraPrazoDias]);

  function offsetDias(d: Date) {
    return diffDias(rangeStart, d);
  }

  const dias = Array.from({ length: totalDias }, (_, i) => addDias(rangeStart, i));
  const hojeOffset = offsetDias(new Date(new Date().toDateString()));

  const meses: { label: string; dias: number }[] = [];
  for (const d of dias) {
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    const last = meses[meses.length - 1];
    if (last && last.label === label) last.dias += 1;
    else meses.push({ label, dias: 1 });
  }

  // ao carregar (ou trocar zoom), centraliza a rolagem no dia de hoje
  useEffect(() => {
    if (!scrollRef.current || tarefas.length === 0) return;
    const el = scrollRef.current;
    const alvo = TABLE_W + Math.max(hojeOffset, 0) * dayWidth - (el.clientWidth - TABLE_W) / 2;
    el.scrollLeft = Math.max(alvo, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas.length > 0, zoom]);

  const inputCls = "w-full pill-field px-3 py-1.5 text-sm";
  const rowInputCls = "w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] outline-none hover:border-ink-700 focus:border-brand disabled:text-neutral-400";

  return (
    <div className="p-8">
      <div className="mb-5 flex flex-wrap items-center gap-2.5 text-sm">
        <div className="card px-3.5 py-2">
          <span className="text-xs text-neutral-500">Atividades</span>
          <span className="ml-1.5 font-semibold text-fg">{tarefas.length}</span>
        </div>
        <div className="card px-3.5 py-2">
          <span className="text-xs text-neutral-500">Esforço total</span>
          <span className="ml-1.5 font-semibold text-fg">{totalHH.toFixed(0)} HH</span>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="ml-auto btn-primary px-4 py-2 text-sm">
          {showForm ? "Fechar formulário" : "+ Nova atividade"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 grid grid-cols-2 gap-2 card p-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">EAP</label>
            <input value={form.eap} onChange={(e) => setForm({ ...form, eap: e.target.value })} placeholder="1.0" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Fase</label>
            <input value={form.fase} onChange={(e) => setForm({ ...form, fase: e.target.value })} placeholder="Fabricação" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Atividade</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Início</label>
            <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Duração (dias, 0 = marco)</label>
            <input type="number" min={0} value={form.duracaoDias} onChange={(e) => setForm({ ...form, duracaoDias: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Pessoas</label>
            <input type="number" min={0} value={form.pessoas} onChange={(e) => setForm({ ...form, pessoas: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Horas</label>
            <input type="number" step="0.5" min={0} value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Turno</label>
            <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className={inputCls}>
              <option>Dia</option>
              <option>Noite</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Responsável</label>
            <select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })} className={inputCls}>
              <option value="">Sem responsável</option>
              {membros.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="col-span-2 self-end btn-primary px-4 py-2 text-sm sm:col-span-1">
            Adicionar
          </button>
        </form>
      )}

      {tarefas.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma atividade cadastrada ainda.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <div className="flex items-center gap-1">
              <span>Zoom:</span>
              <div className="flex gap-0.5 rounded-full bg-black/5 p-0.5">
                {(Object.keys(ZOOM_LEVELS) as (keyof typeof ZOOM_LEVELS)[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`rounded-full px-2.5 py-1 capitalize transition-colors ${zoom === z ? "bg-white text-fg shadow-sm" : "hover:text-fg"}`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span>Nome:</span>
              <div className="flex gap-0.5 rounded-full bg-black/5 p-0.5">
                {(Object.keys(NAME_WIDTHS) as (keyof typeof NAME_WIDTHS)[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setNameWidth(w)}
                    className={`rounded-full px-2.5 py-1 capitalize transition-colors ${nameWidth === w ? "bg-white text-fg shadow-sm" : "hover:text-fg"}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            {cpm.hasCycle ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700">⚠ Ciclo de dependências — caminho crítico não pôde ser calculado</span>
            ) : (
              <>
                <span className="rounded-full bg-brand/10 px-2.5 py-1 font-medium text-brand-dark">🕐 Caminho crítico: {cpm.projectDurationDays} dia(s)</span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-600">🔴 {criticalCount} tarefa(s) crítica(s)</span>
              </>
            )}
            <div className="relative">
              <button
                onClick={() => setShowColMenu((v) => !v)}
                className={`rounded-full px-3 py-1.5 transition-colors ${showColMenu ? "bg-brand text-white" : "bg-black/5 hover:bg-black/10"}`}
              >
                ⚙ Colunas
              </button>
              {showColMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowColMenu(false)} />
                  <div className="card absolute left-0 top-9 z-40 w-48 p-2 normal-case">
                    {COLUNAS.map((c) => (
                      <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-fg hover:bg-black/5">
                        <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => toggleCol(c.key)} className="accent-brand" />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <span className="text-neutral-400">
              Arraste a barra pra mover · segure a borda direita pra mudar a duração · arraste o fundo pra navegar · duração 0 = marco
            </span>
          </div>

          <div ref={scrollRef} className="card overflow-auto" style={{ maxHeight: "72vh" }}>
            <div
              style={{ width: TABLE_W + totalDias * dayWidth, cursor: "grab" }}
              onPointerDown={handlePanPointerDown}
              onPointerMove={handlePanPointerMove}
              onPointerUp={handlePanPointerUp}
              onPointerLeave={handlePanPointerUp}
            >
              {/* cabeçalho */}
              <div className="flex" style={{ height: MONTH_ROW_H + ROW_H }}>
                <div
                  className="sticky left-0 top-0 z-30 flex shrink-0 items-end border-b border-r border-ink-800 bg-ink-900 text-[10px] font-bold uppercase tracking-wider text-neutral-400"
                  style={{ width: TABLE_W, height: MONTH_ROW_H + ROW_H }}
                >
                  <div style={{ width: WBS_W, height: ROW_H }} className="flex items-center justify-center px-1">
                    #
                  </div>
                  <div style={{ width: namePx, height: ROW_H }} className="flex items-center px-2">
                    Tarefa
                  </div>
                  {visibleCols.map((c) => (
                    <div key={c.key} style={{ width: c.width, height: ROW_H }} className="flex items-center justify-center px-1 text-center">
                      {c.label}
                    </div>
                  ))}
                </div>
                <div className="sticky top-0 z-20 flex shrink-0 flex-col border-b border-ink-800 bg-ink-900">
                  <div className="flex" style={{ height: MONTH_ROW_H }}>
                    {meses.map((m, i) => (
                      <div
                        key={i}
                        style={{ width: m.dias * dayWidth }}
                        className="shrink-0 truncate border-b border-r border-ink-800 px-1.5 text-center text-[10px] font-bold capitalize text-neutral-400"
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex" style={{ height: ROW_H }}>
                    {dias.map((d, i) => {
                      const isHoje = i === hojeOffset;
                      const isFimSemana = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div
                          key={i}
                          style={{ width: dayWidth }}
                          className={`shrink-0 border-r border-ink-800/40 py-2 text-center text-[10px] ${
                            isHoje ? "bg-brand/10 font-bold text-brand-dark" : isFimSemana ? "bg-black/[0.03] text-neutral-300" : "text-neutral-400"
                          }`}
                        >
                          {d.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* corpo */}
              <div className="relative">
                <svg className="pointer-events-none absolute left-0 top-0 z-0" width={totalDias * dayWidth} height={rows.length * ROW_H} style={{ marginLeft: TABLE_W }}>
                  <defs>
                    <marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                    </marker>
                    <marker id="dep-arrow-crit" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#e11d48" />
                    </marker>
                  </defs>
                  {hojeOffset >= 0 && hojeOffset < totalDias && (
                    <line x1={hojeOffset * dayWidth} x2={hojeOffset * dayWidth} y1={0} y2={rows.length * ROW_H} stroke="#E8802B" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} />
                  )}
                  {rows.map(({ tarefa: t }) =>
                    t.dependenciasComoSucessora.map((link) => {
                      const pred = byId.get(link.predecessoraId);
                      const predFim = pred ? fim(pred) : null;
                      if (!pred || !predFim || !t.dataInicio) return null;
                      const predRow = rows.findIndex((r) => r.tarefa.id === pred.id);
                      const succRow = rows.findIndex((r) => r.tarefa.id === t.id);
                      if (predRow < 0 || succRow < 0) return null;
                      const predResult = cpm.results.get(pred.id);
                      const succResult = cpm.results.get(t.id);
                      const critEdge = !cpm.hasCycle && predResult?.isCritical && succResult?.isCritical;
                      const x1 = offsetDias(predFim) * dayWidth + dayWidth;
                      const y1 = predRow * ROW_H + ROW_H / 2;
                      const x2 = offsetDias(toDate(t.dataInicio)) * dayWidth;
                      const y2 = succRow * ROW_H + ROW_H / 2;
                      const midX = (x1 + x2) / 2;
                      return (
                        <path
                          key={link.id}
                          d={`M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`}
                          stroke={critEdge ? "#e11d48" : "#94a3b8"}
                          strokeWidth={critEdge ? 2 : 1.5}
                          fill="none"
                          markerEnd={critEdge ? "url(#dep-arrow-crit)" : "url(#dep-arrow)"}
                          opacity={critEdge ? 0.85 : 0.55}
                        />
                      );
                    })
                  )}
                </svg>

                {rows.map(({ tarefa: t, depth, wbs }) => {
                  const result = cpm.results.get(t.id);
                  const isCritica = !!result?.isCritical && !cpm.hasCycle;
                  const hasConflito = !!result?.hasConflict && !cpm.hasCycle;
                  const marco = t.dataInicio !== null && t.duracaoDias === 0;
                  const temPredecessora = t.dependenciasComoSucessora.length > 0;
                  const predText = t.dependenciasComoSucessora.map((l) => wbsById.get(l.predecessoraId) ?? "?").join(", ");
                  const tempoGasto = t.pessoas && t.horas ? t.pessoas * Number(t.horas) : null;

                  const isDragging = drag?.tarefaId === t.id;
                  let startOff = 0;
                  let widthPx = 0;
                  if (t.dataInicio) {
                    startOff = offsetDias(toDate(t.dataInicio));
                    const endOff = offsetDias(fim(t)!);
                    widthPx = Math.max(1, endOff - startOff + 1) * dayWidth;
                    if (isDragging && drag.modo === "mover") startOff += drag.deltaDias;
                    else if (isDragging && drag.modo === "redimensionar") widthPx = Math.max(dayWidth, widthPx + drag.deltaDias * dayWidth);
                  }
                  const cor = faseColor(t.fase);

                  return (
                    <div key={t.id} className="group relative flex border-b border-ink-800/50" style={{ height: ROW_H }}>
                      <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-ink-800 bg-ink-900 text-[11px] group-hover:bg-black/[0.02]" style={{ width: TABLE_W }}>
                        <div style={{ width: WBS_W }} className="shrink-0 truncate px-1 text-center font-mono text-[10px] text-neutral-400">
                          {wbs}
                        </div>
                        <div style={{ width: namePx, paddingLeft: 6 + depth * 14 }} className="flex shrink-0 items-center gap-1 truncate pr-1">
                          {depth > 0 && <span className="shrink-0 text-neutral-400">↳</span>}
                          <span title={t.titulo} className="truncate text-fg">
                            {t.titulo}
                          </span>
                          {isCritica && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" title="No caminho crítico (folga zero)" />
                          )}
                          {hasConflito && <span className="shrink-0 text-[10px]" title="Conflito: início antes do que a rede permite">⚠</span>}
                        </div>
                        {!hiddenCols.has("fase") && (
                          <div style={{ width: COL_W.fase }} className="shrink-0 px-1">
                            <input defaultValue={t.fase ?? ""} onBlur={(e) => patch(t.id, { fase: e.target.value || null })} className={rowInputCls} />
                          </div>
                        )}
                        {!hiddenCols.has("turno") && (
                          <div style={{ width: COL_W.turno }} className="shrink-0 px-1">
                            <select defaultValue={t.turno ?? "Dia"} onChange={(e) => patch(t.id, { turno: e.target.value })} className={rowInputCls}>
                              <option>Dia</option>
                              <option>Noite</option>
                            </select>
                          </div>
                        )}
                        {!hiddenCols.has("pessoas") && (
                          <div style={{ width: COL_W.pessoas }} className="shrink-0 px-1">
                            <input
                              type="number"
                              min={0}
                              defaultValue={t.pessoas ?? ""}
                              onBlur={(e) => patch(t.id, { pessoas: e.target.value ? Number(e.target.value) : null })}
                              className={`${rowInputCls} text-center`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("horas") && (
                          <div style={{ width: COL_W.horas }} className="shrink-0 px-1">
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              defaultValue={t.horas ?? ""}
                              onBlur={(e) => patch(t.id, { horas: e.target.value ? Number(e.target.value) : null })}
                              className={`${rowInputCls} text-center`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("tempoGasto") && (
                          <div style={{ width: COL_W.tempoGasto }} className="shrink-0 truncate px-1.5 text-center text-[10px] text-neutral-500">
                            {tempoGasto !== null ? `${tempoGasto.toFixed(0)}h` : "—"}
                          </div>
                        )}
                        {!hiddenCols.has("dur") && (
                          <div style={{ width: COL_W.dur }} className="shrink-0 px-1">
                            <input
                              key={`dur-${t.id}-${t.duracaoDias}`}
                              type="number"
                              min={0}
                              defaultValue={t.duracaoDias}
                              onBlur={(e) => patch(t.id, { duracaoDias: Number(e.target.value) || 0 })}
                              title={temPredecessora ? "Duração em dias — o início é calculado pela(s) predecessora(s)" : "Duração em dias (0 = marco)"}
                              className={`${rowInputCls} text-center`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("start") && (
                          <div style={{ width: COL_W.start }} className="shrink-0 px-1">
                            <input
                              key={`start-${t.id}-${t.dataInicio ?? ""}`}
                              type="date"
                              disabled={temPredecessora}
                              defaultValue={t.dataInicio ? t.dataInicio.slice(0, 10) : ""}
                              onBlur={(e) => patch(t.id, { dataInicio: e.target.value || undefined })}
                              title={temPredecessora ? "Calculado pela predecessora — mude a duração dela ou a antecedência (lag) pra mudar" : undefined}
                              className={`${rowInputCls} text-[10px]`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("end") && (
                          <div style={{ width: COL_W.end }} className="shrink-0 truncate px-1.5 text-center text-[10px] text-neutral-500">
                            {fim(t) ? fmt(fim(t)!) : "—"}
                          </div>
                        )}
                        {!hiddenCols.has("realStart") && (
                          <div style={{ width: COL_W.realStart }} className="shrink-0 px-1">
                            <input
                              type="date"
                              defaultValue={t.dataInicioReal ? t.dataInicioReal.slice(0, 10) : ""}
                              onBlur={(e) => patch(t.id, { dataInicioReal: e.target.value || null })}
                              className={`${rowInputCls} text-[10px]`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("realEnd") && (
                          <div style={{ width: COL_W.realEnd }} className="shrink-0 px-1">
                            <input
                              type="date"
                              defaultValue={t.dataFimReal ? t.dataFimReal.slice(0, 10) : ""}
                              onBlur={(e) => patch(t.id, { dataFimReal: e.target.value || null })}
                              className={`${rowInputCls} text-[10px]`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("pct") && (
                          <div style={{ width: COL_W.pct }} className="shrink-0 px-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              defaultValue={t.percentConcluido}
                              onBlur={(e) => {
                                const percent = Number(e.target.value);
                                patch(t.id, { percentConcluido: percent, status: percent >= 100 ? "FEITO" : percent > 0 ? "FAZENDO" : "A_FAZER" });
                              }}
                              className={`${rowInputCls} text-center`}
                            />
                          </div>
                        )}
                        {!hiddenCols.has("float") && (
                          <div style={{ width: COL_W.float }} className="shrink-0 px-1 text-center text-[10px]">
                            {result && !cpm.hasCycle ? (
                              isCritica ? (
                                <span className="font-semibold text-rose-600">crítica</span>
                              ) : (
                                <span className="text-neutral-500">{result.float}d</span>
                              )
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </div>
                        )}
                        {!hiddenCols.has("assignee") && (
                          <div style={{ width: COL_W.assignee }} className="flex shrink-0 items-center gap-1 px-1">
                            {t.responsavel && <Avatar name={t.responsavel.name} photoUrl={t.responsavel.avatarUrl} color={personColor(t.responsavel.id)} size={16} />}
                            <select
                              value={t.responsavelId ?? ""}
                              onChange={(e) => patch(t.id, { responsavelId: e.target.value || null })}
                              className={`${rowInputCls} truncate`}
                            >
                              <option value="">—</option>
                              {membros.map((m) => (
                                <option key={m.userId} value={m.userId}>
                                  {m.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {!hiddenCols.has("pred") && (
                          <div style={{ width: COL_W.pred }} className="relative shrink-0 px-1">
                            <button
                              onClick={() => toggleDepPanel(t.id)}
                              title="Gerenciar dependências"
                              className={`w-full truncate rounded px-1 py-1 text-left text-[10px] hover:bg-black/5 ${depPanelFor === t.id ? "bg-brand/10 text-brand-dark" : "text-neutral-500"}`}
                            >
                              {predText || "—"} 🔗
                            </button>
                            {depPanelFor === t.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setDepPanelFor(null)} />
                                <div className="card absolute left-0 top-full z-40 w-72 p-3 text-xs normal-case" onClick={(e) => e.stopPropagation()}>
                                  <p className="mb-1.5 font-semibold text-fg">Predecessoras de "{t.titulo}"</p>
                                  <div className="mb-2 flex flex-col gap-1">
                                    {t.dependenciasComoSucessora.map((link) => (
                                      <div key={link.id} className="flex items-center gap-2 rounded-md bg-black/5 px-2 py-1.5">
                                        <span className="flex-1 truncate">
                                          {wbsById.get(link.predecessoraId)} · {link.predecessora.titulo}
                                        </span>
                                        <span className="shrink-0 text-neutral-400">{DEP_TYPE_LABEL[link.tipo]}</span>
                                        {link.lagDias !== 0 && (
                                          <span className="shrink-0 text-neutral-400">
                                            ({link.lagDias > 0 ? "+" : ""}
                                            {link.lagDias}d)
                                          </span>
                                        )}
                                        <button onClick={() => handleRemoveDependencia(link.id)} className="shrink-0 text-neutral-300 hover:text-red-500">
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                    {t.dependenciasComoSucessora.length === 0 && <p className="text-neutral-400">Nenhuma predecessora.</p>}
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <select value={newPredId} onChange={(e) => setNewPredId(e.target.value)} className="pill-field w-full px-2 py-1">
                                      <option value="">Escolher predecessora...</option>
                                      {withDates
                                        .filter((o) => o.id !== t.id)
                                        .map((o) => (
                                          <option key={o.id} value={o.id}>
                                            {wbsById.get(o.id)} · {o.titulo}
                                          </option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-1.5">
                                      <select value={newTipo} onChange={(e) => setNewTipo(e.target.value as DependencyType)} className="pill-field flex-1 px-1.5 py-1">
                                        {(Object.keys(DEP_TYPE_LABEL) as DependencyType[]).map((v) => (
                                          <option key={v} value={v}>
                                            {DEP_TYPE_LABEL[v]}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        value={newLag}
                                        onChange={(e) => setNewLag(e.target.value)}
                                        title="Antecedência/folga em dias"
                                        className="pill-field w-12 px-1.5 py-1"
                                      />
                                      <button
                                        onClick={() => handleAddDependencia(t.id)}
                                        disabled={!newPredId || savingDep}
                                        className="btn-primary shrink-0 px-2.5 py-1 disabled:opacity-50"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                  <p className="mt-1.5 text-neutral-400">Só tarefas com data de início entram no cálculo do caminho crítico.</p>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        <div className="ml-auto px-1.5">
                          <button onClick={() => handleDelete(t.id)} className="text-[10px] text-neutral-300 hover:text-red-500" title="Remover">
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="relative shrink-0 group-hover:bg-black/[0.015]" style={{ width: totalDias * dayWidth, height: ROW_H }}>
                        {t.dataInicio && !marco && (
                          <div
                            onPointerDown={(e) => handleBarPointerDown(e, t, "mover")}
                            className={`group/bar absolute top-[9px] h-[18px] cursor-grab rounded-md border shadow-sm active:cursor-grabbing ${
                              isCritica ? "border-rose-400 bg-rose-50" : "border-ink-700 bg-black/[0.04]"
                            } ${isDragging ? "shadow-lg ring-2 ring-brand/40" : ""}`}
                            style={{ left: startOff * dayWidth, width: widthPx }}
                            title={`${t.titulo} — ${fmt(toDate(t.dataInicio))} a ${fim(t) ? fmt(fim(t)!) : ""} — ${t.percentConcluido}%${
                              result && !cpm.hasCycle ? (isCritica ? " — crítica" : ` — folga ${result.float}d`) : ""
                            }`}
                          >
                            <div className={`pointer-events-none h-full rounded-[5px] ${isCritica ? "bg-rose-400" : ""}`} style={{ width: `${Math.min(t.percentConcluido, 100)}%`, backgroundColor: isCritica ? undefined : cor, opacity: isCritica ? 1 : 0.85 }} />
                            <div
                              onPointerDown={(e) => handleBarPointerDown(e, t, "redimensionar")}
                              title="Arraste pra mudar a duração"
                              className="absolute -right-1 top-0 h-full w-3 cursor-ew-resize opacity-0 group-hover/bar:opacity-100"
                            >
                              <div className="mx-auto h-full w-1 rounded-full bg-neutral-500/60" />
                            </div>
                          </div>
                        )}
                        {marco && (
                          <div
                            className="absolute top-[8px] h-4 w-4 rotate-45 cursor-pointer"
                            style={{ left: startOff * dayWidth - 8, backgroundColor: isCritica ? "#e11d48" : cor }}
                            title={`Marco: ${t.titulo}`}
                          />
                        )}
                        {t.dataInicioReal && (
                          <div
                            className="absolute top-[3px] h-1 rounded-full bg-neutral-700"
                            style={{
                              left: offsetDias(toDate(t.dataInicioReal)) * dayWidth,
                              width: Math.max(2, ((t.dataFimReal ? offsetDias(toDate(t.dataFimReal)) : offsetDias(new Date(new Date().toDateString()))) - offsetDias(toDate(t.dataInicioReal)) + 1) * dayWidth),
                            }}
                            title="Execução real"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
            {fases.map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded border border-ink-700" style={{ backgroundColor: `${faseColor(f)}22` }} />
                {f}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full bg-neutral-700" /> Real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded border border-rose-400 bg-rose-50" /> Crítica
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rotate-45 bg-brand" /> Marco
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0 border-l-2 border-dashed border-brand" /> Hoje
            </span>
          </div>
        </>
      )}
    </div>
  );
}
