"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { personColor } from "@/lib/personColor";
import { computeCPM, type DependencyType } from "@/lib/cpm";
import PlanejamentoImport from "@/components/PlanejamentoImport";

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
  valorHora: string | null;
  equipeIds: string[];
  servicoOrcamentoId: string | null;
  dependenciasComoSucessora: Dependencia[];
};

type Funcionario = { id: string; nome: string; cargo: string | null };
type Ponto = { funcionarioId: string; dia: string; entrada: string; saida: string };
type ServicoOrc = { id: string; nome: string };

function horasEntre(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  let mins = sh * 60 + sm - (eh * 60 + em);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

const COLUNAS_OPCIONAIS = [
  { key: "pessoas", label: "Pessoas" },
  { key: "horas", label: "Horas" },
  { key: "turno", label: "Turno" },
  { key: "equipe", label: "Equipe" },
  { key: "servico", label: "Serviço (Orçamento)" },
  { key: "folga", label: "Folga" },
  { key: "predec", label: "Predecessora" },
] as const;
type ColunaKey = (typeof COLUNAS_OPCIONAIS)[number]["key"];
const COLUNAS_PADRAO: ColunaKey[] = ["pessoas", "horas", "equipe", "servico", "folga", "predec"];

const SEM_BLOCO = "Sem bloco";
const DEP_TYPE_LABEL: Record<DependencyType, string> = { FS: "Término → Início", SS: "Início → Início", FF: "Término → Término", SF: "Início → Término" };
const FASE_COLORS = ["#E8802B", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f43f5e", "#eab308", "#65a30d"];
const ZOOM_LEVELS = { compacto: 16, medio: 24, largo: 38 } as const;
const LABEL_W = 220;
const ROW_H = 32;
const MONTH_ROW_H = 18;

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
  return addDias(toDate(t.dataInicio), Math.max(t.duracaoDias, 1) - 1);
}
function cpmDueISO(t: Tarefa) {
  if (!t.dataInicio) return null;
  return addDias(toDate(t.dataInicio), t.duracaoDias).toISOString();
}
// soma as horas batidas no Ponto pelas pessoas da equipe da tarefa, dentro da janela
// dataInicio..fim dela — puxa realizado sem precisar digitar nada de novo
function horasRealizadasDe(t: Tarefa, pontos: Ponto[]): number {
  if (!t.dataInicio || t.equipeIds.length === 0) return 0;
  const inicio = toDate(t.dataInicio);
  const f = fim(t);
  if (!f) return 0;
  return pontos
    .filter((p) => t.equipeIds.includes(p.funcionarioId))
    .filter((p) => {
      const dia = toDate(p.dia);
      return dia >= inicio && dia <= f;
    })
    .reduce((s, p) => s + horasEntre(p.entrada, p.saida), 0);
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
  const [diariaPadrao, setDiariaPadrao] = useState(150);
  const [horasPorDiaria, setHorasPorDiaria] = useState(8);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [servicos, setServicos] = useState<ServicoOrc[]>([]);
  const [equipePanelFor, setEquipePanelFor] = useState<string | null>(null);
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<ColunaKey>>(new Set(COLUNAS_PADRAO));
  const [colunasPanelAberto, setColunasPanelAberto] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("steelnova-cronograma-colunas");
      if (salvo) setColunasVisiveis(new Set(JSON.parse(salvo) as ColunaKey[]));
    } catch {}
  }, []);
  function toggleColuna(key: ColunaKey) {
    setColunasVisiveis((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try {
        localStorage.setItem("steelnova-cronograma-colunas", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }
  const [zoom, setZoom] = useState<keyof typeof ZOOM_LEVELS>("compacto");
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [blocosColapsados, setBlocosColapsados] = useState<Set<string>>(new Set());
  const [novoBloco, setNovoBloco] = useState("");
  const [criandoBloco, setCriandoBloco] = useState(false);
  const [nomeNovoBloco, setNomeNovoBloco] = useState("");
  const [subtarefaAbertaId, setSubtarefaAbertaId] = useState<string | null>(null);
  const [novaSubtarefaTitulo, setNovaSubtarefaTitulo] = useState("");
  const [depPanelFor, setDepPanelFor] = useState<string | null>(null);
  const [newPredId, setNewPredId] = useState("");
  const [newTipo, setNewTipo] = useState<DependencyType>("FS");
  const [newLag, setNewLag] = useState("0");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ tarefaId: string; modo: "mover" | "redimensionar"; startClientX: number; deltaDias: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const draggedBarRef = useRef(false);
  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number } | null>(null);
  const [form, setForm] = useState({
    eap: "",
    titulo: "",
    dataInicio: "",
    duracaoDias: "1",
    pessoas: "",
    horas: "",
    turno: "Dia",
    responsavelId: "",
  });

  async function load() {
    const [tRes, oRes, pRes, fRes, ptRes, svRes] = await Promise.all([
      fetch(`/api/tarefas?obraId=${obraId}`),
      fetch(`/api/obras/${obraId}`),
      fetch(`/api/obras/${obraId}/parametros-orcamento`),
      fetch(`/api/funcionarios`),
      fetch(`/api/ponto?obraId=${obraId}`),
      fetch(`/api/servicos-orcamento?obraId=${obraId}`),
    ]);
    if (tRes.ok) setTarefas(await tRes.json());
    if (svRes.ok) setServicos((await svRes.json()).map((s: any) => ({ id: s.id, nome: s.nome })));
    if (oRes.ok) {
      const obra = await oRes.json();
      setMembros(obra.membros.map((m: any) => ({ userId: m.user.id, nome: m.user.name, avatarUrl: m.user.avatarUrl ?? null })));
    }
    if (pRes.ok) {
      const p = await pRes.json();
      setDiariaPadrao(Number(p.diariaPadrao));
      setHorasPorDiaria(Number(p.horasPorDiaria));
    }
    if (fRes.ok) setFuncionarios(await fRes.json());
    if (ptRes.ok) {
      const pts = await ptRes.json();
      setPontos(pts.map((l: any) => ({ funcionarioId: l.funcionario.id, dia: l.dia, entrada: l.entrada, saida: l.saida })));
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

  // atualiza local (setState funcional, sempre pega o estado mais recente) ANTES de
  // disparar o PATCH — clicar rápido em várias pessoas do mesmo popover não perde
  // marcação por causa da corrida entre o load() de um clique e o próximo clique
  function toggleEquipe(tarefaId: string, funcionarioId: string) {
    setTarefas((prev) =>
      prev.map((x) => {
        if (x.id !== tarefaId) return x;
        const equipeIds = x.equipeIds.includes(funcionarioId)
          ? x.equipeIds.filter((id) => id !== funcionarioId)
          : [...x.equipeIds, funcionarioId];
        fetch(`/api/tarefas/${tarefaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipeIds }),
        });
        return { ...x, equipeIds };
      })
    );
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
        fase: novoBloco || undefined,
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
      setForm({ eap: "", titulo: "", dataInicio: "", duracaoDias: "1", pessoas: "", horas: "", turno: "Dia", responsavelId: "" });
      load();
    }
  }

  function handleCriarBloco(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeNovoBloco.trim()) return;
    setNovoBloco(nomeNovoBloco.trim());
    setNomeNovoBloco("");
    setCriandoBloco(false);
  }

  async function handleAddSubtarefa(pai: Tarefa) {
    if (!novaSubtarefaTitulo.trim()) return;
    await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, titulo: novaSubtarefaTitulo.trim(), fase: pai.fase ?? undefined, tarefaMaeId: pai.id, dataInicio: pai.dataInicio ?? undefined }),
    });
    setNovaSubtarefaTitulo("");
    setSubtarefaAbertaId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover essa atividade?")) return;
    const res = await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function toggleDepPanel(tarefaId: string) {
    setDepPanelFor((prev) => (prev === tarefaId ? null : tarefaId));
    setNewPredId("");
    setNewTipo("FS");
    setNewLag("0");
  }

  async function handleAddDependencia(sucessoraId: string) {
    if (!newPredId) return;
    await fetch(`/api/tarefas/${sucessoraId}/dependencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessoraId: newPredId, tipo: newTipo, lagDias: Number(newLag) || 0 }),
    });
    setNewPredId("");
    setNewLag("0");
    load();
  }

  async function handleRemoveDependencia(dependenciaId: string) {
    await fetch(`/api/dependencias/${dependenciaId}`, { method: "DELETE" });
    load();
  }

  // mesma lógica de mesmoGrupo/handleDrop da Lista — arrastar só reordena dentro do mesmo bloco/pai
  function mesmoGrupo(a: Tarefa, b: Tarefa) {
    if (a.tarefaMaeId !== b.tarefaMaeId) return false;
    if (a.tarefaMaeId) return true;
    return (a.fase?.trim() || SEM_BLOCO) === (b.fase?.trim() || SEM_BLOCO);
  }

  async function handleDropReorder(targetId: string) {
    const fromId = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!fromId || fromId === targetId) return;
    const dragged = tarefas.find((t) => t.id === fromId);
    const target = tarefas.find((t) => t.id === targetId);
    if (!dragged || !target || !mesmoGrupo(dragged, target)) return;
    const lista = [...tarefas];
    const fromIdx = lista.findIndex((t) => t.id === fromId);
    const toIdx = lista.findIndex((t) => t.id === targetId);
    const [movido] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, movido);
    setTarefas(lista);
    await Promise.all(
      lista.map((t, i) =>
        fetch(`/api/tarefas/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordem: i }) })
      )
    );
    load();
  }

  // Arrastar a barra do Gantt (mover) ou a borda direita (redimensionar)
  function handleBarPointerDown(e: React.PointerEvent, t: Tarefa, modo: "mover" | "redimensionar") {
    if (!t.dataInicio) return;
    e.preventDefault();
    e.stopPropagation();
    draggedBarRef.current = false;
    setDrag({ tarefaId: t.id, modo, startClientX: e.clientX, deltaDias: 0 });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const deltaDias = Math.round((e.clientX - current.startClientX) / dayWidth);
      if (deltaDias !== current.deltaDias) {
        if (deltaDias !== 0) draggedBarRef.current = true;
        setDrag({ ...current, deltaDias });
      }
    }
    function onUp() {
      const current = dragRef.current;
      setDrag(null);
      if (!current || current.deltaDias === 0) return;
      const t = tarefas.find((x) => x.id === current.tarefaId);
      if (!t || !t.dataInicio) return;
      if (current.modo === "redimensionar") patch(t.id, { duracaoDias: Math.max(0, t.duracaoDias + current.deltaDias) });
      else patch(t.id, { dataInicio: addDias(toDate(t.dataInicio), current.deltaDias).toISOString() });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  function handlePanPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, button, select, .sticky")) return;
    const el = ganttScrollRef.current;
    if (!el) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft };
  }
  function handlePanPointerMove(e: React.PointerEvent) {
    if (!panRef.current || !ganttScrollRef.current) return;
    ganttScrollRef.current.scrollLeft = panRef.current.scrollLeft - (e.clientX - panRef.current.startX);
  }
  function handlePanPointerUp() {
    panRef.current = null;
  }

  const dayWidth = ZOOM_LEVELS[zoom];
  const totalHH = tarefas.reduce((s, t) => s + (t.pessoas ?? 0) * Number(t.horas ?? 0), 0);
  const taxaHoraPadrao = horasPorDiaria > 0 ? diariaPadrao / horasPorDiaria : 0;
  const custoPrevisto = tarefas.reduce((s, t) => {
    const hh = (t.pessoas ?? 0) * Number(t.horas ?? 0);
    const taxa = t.valorHora ? Number(t.valorHora) : taxaHoraPadrao;
    return s + hh * taxa;
  }, 0);
  const fases = useMemo(() => Array.from(new Set(tarefas.map((t) => t.fase ?? "Geral"))), [tarefas]);
  const faseColor = (fase: string | null) => FASE_COLORS[fases.indexOf(fase ?? "Geral") % FASE_COLORS.length];

  // blocos existentes (fase das tarefas raiz), na ordem de primeira aparição
  const blocos = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarefas) if (!t.tarefaMaeId) set.add(t.fase?.trim() || SEM_BLOCO);
    return Array.from(set);
  }, [tarefas]);
  const blocosParaSelecionar = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarefas) if (t.fase?.trim()) set.add(t.fase.trim());
    return Array.from(set);
  }, [tarefas]);

  // agrupa por bloco e numera em estilo WBS (1, 1.1, 1.1.1...) — mesmo algoritmo da Lista
  const gruposPorBloco = useMemo(() => {
    const porMae = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      const key = t.tarefaMaeId ?? "__root__";
      if (!porMae.has(key)) porMae.set(key, []);
      porMae.get(key)!.push(t);
    }
    const out = new Map<string, { tarefa: Tarefa; depth: number; numero: string }[]>();
    const raizes = porMae.get("__root__") ?? [];
    const porBloco = new Map<string, Tarefa[]>();
    for (const raiz of raizes) {
      const bloco = raiz.fase?.trim() || SEM_BLOCO;
      if (!porBloco.has(bloco)) porBloco.set(bloco, []);
      porBloco.get(bloco)!.push(raiz);
    }
    let blocoIdx = 0;
    for (const [bloco, raizesDoBloco] of porBloco) {
      blocoIdx++;
      out.set(bloco, []);
      raizesDoBloco.forEach((raiz, i) => {
        const numeroRaiz = `${blocoIdx}.${i + 1}`;
        out.get(bloco)!.push({ tarefa: raiz, depth: 0, numero: numeroRaiz });
        if (!collapsed.has(raiz.id)) {
          function walkFilhos(key: string, depth: number, prefixo: string) {
            const filhos = porMae.get(key) ?? [];
            filhos.forEach((t, k) => {
              const numero = `${prefixo}.${k + 1}`;
              out.get(bloco)!.push({ tarefa: t, depth, numero });
              if (!collapsed.has(t.id)) walkFilhos(t.id, depth + 1, numero);
            });
          }
          walkFilhos(raiz.id, 1, numeroRaiz);
        }
      });
    }
    return out;
  }, [tarefas, collapsed]);

  const wbsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const bloco of blocos) for (const l of gruposPorBloco.get(bloco) ?? []) m.set(l.tarefa.id, l.numero);
    return m;
  }, [blocos, gruposPorBloco]);

  const withDates = useMemo(() => tarefas.filter((t) => t.dataInicio), [tarefas]);
  const allDependencias = useMemo(() => {
    const list: { predecessorId: string; successorId: string; type: DependencyType; lagDays: number }[] = [];
    for (const t of tarefas) for (const link of t.dependenciasComoSucessora) list.push({ predecessorId: link.predecessoraId, successorId: t.id, type: link.tipo, lagDays: link.lagDias });
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
    return { rangeStart: addDias(min, -2), totalDias: Math.max(14, diffDias(min, max) + 4) };
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

  useEffect(() => {
    if (!ganttScrollRef.current || tarefas.length === 0) return;
    const el = ganttScrollRef.current;
    const alvo = LABEL_W + Math.max(hojeOffset, 0) * dayWidth - (el.clientWidth - LABEL_W) / 2;
    el.scrollLeft = Math.max(alvo, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas.length > 0, zoom]);

  const inputCls = "w-full pill-field px-3 py-1.5 text-sm";
  const cellInputCls = "rounded border-0 bg-transparent px-1 py-1 text-[11px] text-fg outline-none focus:bg-ink-800 focus:ring-1 focus:ring-brand";

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
        <div className="card px-3.5 py-2" title="Pessoas × Horas de cada atividade × valor-hora (da atividade, ou padrão da obra)">
          <span className="text-xs text-neutral-500">Custo previsto (mão de obra)</span>
          <span className="ml-1.5 font-semibold text-fg">
            {custoPrevisto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
        {cpm.hasCycle ? (
          <div className="rounded-full bg-rose-100 px-3.5 py-2 text-xs font-medium text-rose-700">⚠ Ciclo de dependências</div>
        ) : (
          <>
            <div className="rounded-full bg-brand/10 px-3.5 py-2 text-xs font-medium text-brand-dark">🕐 Caminho crítico: {cpm.projectDurationDays} dia(s)</div>
            <div className="rounded-full bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-600">🔴 {criticalCount} crítica(s)</div>
          </>
        )}
        <div className="relative ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setColunasPanelAberto((v) => !v)} className="btn-ghost px-3 py-2 text-sm">
            ⚙ Colunas
          </button>
          {colunasPanelAberto && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setColunasPanelAberto(false)} />
              <div className="card absolute right-0 top-full z-40 mt-1 w-48 p-2 text-xs" onClick={(e) => e.stopPropagation()}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase text-neutral-400">Mostrar colunas</p>
                {COLUNAS_OPCIONAIS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 hover:bg-black/5">
                    <input type="checkbox" checked={colunasVisiveis.has(c.key)} onChange={() => toggleColuna(c.key)} />
                    <span className="text-fg">{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <PlanejamentoImport obraId={obraId} />
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary px-4 py-2 text-sm">
            {showForm ? "Fechar formulário" : "+ Nova atividade"}
          </button>
        </div>
      </div>

      {/* seletor de bloco — vem ANTES do formulário: escolhe/cria o bloco primeiro,
          pra deixar claro em qual bloco a atividade vai entrar antes de preencher o resto */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-medium text-neutral-500">Bloco da próxima atividade:</span>
        {!criandoBloco ? (
          <>
            <select value={novoBloco} onChange={(e) => setNovoBloco(e.target.value)} className={inputCls} style={{ width: 200 }}>
              <option value="">Sem bloco</option>
              {blocosParaSelecionar.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setCriandoBloco(true)} className="btn-ghost px-3 py-1.5 text-xs">
              + Novo bloco
            </button>
          </>
        ) : (
          <form onSubmit={handleCriarBloco} className="flex items-center gap-2">
            <input
              autoFocus
              value={nomeNovoBloco}
              onChange={(e) => setNomeNovoBloco(e.target.value)}
              placeholder="Nome do bloco (Preparação, Fabricação, Montagem...)"
              className={inputCls}
              style={{ width: 280 }}
            />
            <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
              Criar
            </button>
            <button type="button" onClick={() => setCriandoBloco(false)} className="btn-ghost px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </form>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 grid grid-cols-2 gap-2 card p-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">EAP</label>
            <input value={form.eap} onChange={(e) => setForm({ ...form, eap: e.target.value })} placeholder="1.0" className={inputCls} />
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
            Adicionar {novoBloco && <span className="font-normal opacity-80">em "{novoBloco}"</span>}
          </button>
        </form>
      )}

      {tarefas.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma atividade cadastrada ainda.</p>
      ) : (
        <>
          {/* TABELA — agrupada por bloco, cria bloco → tarefa → subtarefa, arrasta pra reordenar */}
          <div className="mb-6 overflow-x-auto card">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-600">
                <tr>
                  <th className="th-label w-8 border-b border-ink-800"></th>
                  <th className="th-label border-b border-ink-800">Atividade</th>
                  <th className="th-label border-b border-ink-800">Dur.</th>
                  <th className="th-label border-b border-ink-800">Início prev.</th>
                  <th className="th-label border-b border-ink-800">Término prev.</th>
                  <th className="th-label border-b border-ink-800">%</th>
                  {colunasVisiveis.has("pessoas") && <th className="th-label border-b border-ink-800">Pessoas</th>}
                  {colunasVisiveis.has("horas") && <th className="th-label border-b border-ink-800">Horas</th>}
                  {colunasVisiveis.has("turno") && <th className="th-label border-b border-ink-800">Turno</th>}
                  {colunasVisiveis.has("folga") && <th className="th-label border-b border-ink-800">Folga</th>}
                  <th className="th-label border-b border-ink-800">Responsável</th>
                  {colunasVisiveis.has("equipe") && (
                    <th className="th-label border-b border-ink-800" title="Equipe de campo (Funcionario) — puxa horas reais do Ponto/RDO">
                      Equipe
                    </th>
                  )}
                  {colunasVisiveis.has("servico") && (
                    <th className="th-label border-b border-ink-800" title="Vincula esta tarefa a um serviço do Orçamento — a Medição usa isso pra sugerir o % concluído">
                      Serviço (Orç.)
                    </th>
                  )}
                  {colunasVisiveis.has("predec") && <th className="th-label border-b border-ink-800">Predec.</th>}
                  <th className="th-label border-b border-ink-800"></th>
                </tr>
              </thead>
              <tbody>
                {blocos.map((bloco) => {
                  const linhasDoBloco = gruposPorBloco.get(bloco) ?? [];
                  const blocoColapsado = blocosColapsados.has(bloco);
                  return (
                    <Fragment key={bloco}>
                      <tr className="border-t border-ink-800 bg-brand/[0.04]">
                        <td colSpan={10} className="px-3 py-2">
                          <button
                            onClick={() =>
                              setBlocosColapsados((c) => {
                                const next = new Set(c);
                                next.has(bloco) ? next.delete(bloco) : next.add(bloco);
                                return next;
                              })
                            }
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-600"
                          >
                            <span className="text-neutral-400">{blocoColapsado ? "▸" : "▾"}</span>
                            {bloco}
                            <span className="font-normal normal-case text-neutral-400">
                              · {linhasDoBloco.length} {linhasDoBloco.length === 1 ? "atividade" : "atividades"}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {!blocoColapsado &&
                        linhasDoBloco.map(({ tarefa: t, depth, numero }) => {
                          const result = cpm.results.get(t.id);
                          const isCritica = !!result?.isCritical && !cpm.hasCycle;
                          const temFilhas = tarefas.some((x) => x.tarefaMaeId === t.id);
                          const temPredecessora = t.dependenciasComoSucessora.length > 0;
                          const predText = t.dependenciasComoSucessora.map((l) => wbsById.get(l.predecessoraId) ?? "?").join(", ");
                          const podeReceberDrop = draggingId && draggingId !== t.id && mesmoGrupo(tarefas.find((x) => x.id === draggingId)!, t);

                          return (
                            <Fragment key={t.id}>
                              <tr
                                draggable
                                onDragStart={(e) => {
                                  setDraggingId(t.id);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => {
                                  setDraggingId(null);
                                  setDragOverId(null);
                                }}
                                onDragOver={(e) => {
                                  if (!podeReceberDrop) return;
                                  e.preventDefault();
                                  if (dragOverId !== t.id) setDragOverId(t.id);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  handleDropReorder(t.id);
                                }}
                                className={`group border-t border-ink-800/60 ${draggingId === t.id ? "opacity-40" : ""} ${
                                  dragOverId === t.id && podeReceberDrop ? "border-t-2 border-t-brand" : ""
                                } ${isCritica ? "bg-rose-50/40" : ""}`}
                              >
                                <td className="cursor-grab px-1 py-2 text-center text-neutral-400 active:cursor-grabbing" title="Arrastar pra reordenar">
                                  ⠿
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
                                    {isCritica && <span className="h-3.5 w-1 shrink-0 rounded-full bg-rose-500" />}
                                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-neutral-400" title="Numeração automática (posição no bloco)">{numero}</span>
                                    <input
                                      defaultValue={t.eap ?? ""}
                                      onBlur={(e) => patch(t.id, { eap: e.target.value || null })}
                                      placeholder="eap"
                                      title="EAP / numeração própria (editável, livre)"
                                      className={`${cellInputCls} w-10 shrink-0 text-center text-[10px] text-neutral-500`}
                                    />
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
                                    <input
                                      defaultValue={t.titulo}
                                      onBlur={(e) => e.target.value.trim() && patch(t.id, { titulo: e.target.value })}
                                      className={`${cellInputCls} min-w-0 flex-1 font-medium`}
                                    />
                                    <button
                                      onClick={() => {
                                        setSubtarefaAbertaId(subtarefaAbertaId === t.id ? null : t.id);
                                        setNovaSubtarefaTitulo("");
                                      }}
                                      className="shrink-0 text-[10px] text-brand opacity-0 hover:underline group-hover:opacity-100"
                                    >
                                      + subtarefa
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    defaultValue={t.duracaoDias}
                                    onBlur={(e) => patch(t.id, { duracaoDias: Number(e.target.value) || 0 })}
                                    title={temPredecessora ? "O início é calculado pela predecessora" : "0 = marco"}
                                    className={`${cellInputCls} w-12 text-center`}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="date"
                                    disabled={temPredecessora}
                                    defaultValue={t.dataInicio ? t.dataInicio.slice(0, 10) : ""}
                                    onBlur={(e) => patch(t.id, { dataInicio: e.target.value || undefined })}
                                    className={`${cellInputCls} w-32`}
                                  />
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-neutral-500">{fim(t) ? fmt(fim(t)!) : "—"}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    defaultValue={t.percentConcluido}
                                    onBlur={(e) => {
                                      const percent = Number(e.target.value);
                                      patch(t.id, { percentConcluido: percent, status: percent >= 100 ? "FEITO" : percent > 0 ? "FAZENDO" : "A_FAZER" });
                                    }}
                                    className={`${cellInputCls} w-12 text-center`}
                                  />
                                </td>
                                {colunasVisiveis.has("pessoas") && (
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      defaultValue={t.pessoas ?? ""}
                                      onBlur={(e) => patch(t.id, { pessoas: e.target.value ? Number(e.target.value) : null })}
                                      className={`${cellInputCls} w-12 text-center`}
                                    />
                                  </td>
                                )}
                                {colunasVisiveis.has("horas") && (
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.5"
                                      defaultValue={t.horas ?? ""}
                                      onBlur={(e) => patch(t.id, { horas: e.target.value ? Number(e.target.value) : null })}
                                      className={`${cellInputCls} w-14 text-center`}
                                    />
                                  </td>
                                )}
                                {colunasVisiveis.has("turno") && (
                                  <td className="px-3 py-2">
                                    <select
                                      value={t.turno ?? "Dia"}
                                      onChange={(e) => patch(t.id, { turno: e.target.value })}
                                      className={`${cellInputCls} w-16`}
                                    >
                                      <option>Dia</option>
                                      <option>Noite</option>
                                    </select>
                                  </td>
                                )}
                                {colunasVisiveis.has("folga") && (
                                  <td className={`px-3 py-2 ${isCritica ? "font-semibold text-rose-600" : "text-neutral-500"}`}>
                                    {result && !cpm.hasCycle ? (isCritica ? "crítica" : `${result.float}d`) : "—"}
                                  </td>
                                )}
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    {t.responsavel && <Avatar name={t.responsavel.name} photoUrl={t.responsavel.avatarUrl} color={personColor(t.responsavel.id)} size={18} />}
                                    <select value={t.responsavelId ?? ""} onChange={(e) => patch(t.id, { responsavelId: e.target.value || null })} className={`${cellInputCls} w-28`}>
                                      <option value="">—</option>
                                      {membros.map((m) => (
                                        <option key={m.userId} value={m.userId}>
                                          {m.nome}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                                {colunasVisiveis.has("equipe") && (
                                <td className="relative px-3 py-2">
                                  {(() => {
                                    const nomesEquipe = t.equipeIds.map((id) => funcionarios.find((f) => f.id === id)?.nome).filter(Boolean) as string[];
                                    const hRealizado = horasRealizadasDe(t, pontos);
                                    return (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setEquipePanelFor(equipePanelFor === t.id ? null : t.id)}
                                          className={`truncate rounded px-1 py-1 text-left text-[11px] hover:bg-black/5 ${equipePanelFor === t.id ? "bg-brand/10 text-brand-dark" : "text-neutral-500"}`}
                                          title="Equipe de campo alocada nesta atividade"
                                        >
                                          {nomesEquipe.length > 0 ? `👷 ${nomesEquipe.length}` : "+ equipe"}
                                          {hRealizado > 0 && <span className="ml-1 text-emerald-600">· {hRealizado.toFixed(0)}h real.</span>}
                                        </button>
                                        {equipePanelFor === t.id && (
                                          <>
                                            <div className="fixed inset-0 z-30" onClick={() => setEquipePanelFor(null)} />
                                            <div className="card absolute left-0 top-full z-40 w-56 p-2 text-xs normal-case" onClick={(e) => e.stopPropagation()}>
                                              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase text-neutral-400">Equipe de campo</p>
                                              <div className="max-h-52 overflow-y-auto">
                                                {funcionarios.length === 0 && <p className="px-1 py-2 text-neutral-400">Cadastre em RH.</p>}
                                                {funcionarios.map((f) => {
                                                  const marcado = t.equipeIds.includes(f.id);
                                                  return (
                                                    <label key={f.id} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1 hover:bg-black/5">
                                                      <input
                                                        type="checkbox"
                                                        checked={marcado}
                                                        onChange={() => toggleEquipe(t.id, f.id)}
                                                      />
                                                      <span className="truncate text-fg">{f.nome}</span>
                                                      {f.cargo && <span className="shrink-0 text-[10px] text-neutral-400">{f.cargo}</span>}
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                              {hRealizado > 0 && (
                                                <p className="mt-1.5 border-t border-ink-800 px-1 pt-1.5 text-[10px] text-emerald-600">
                                                  {hRealizado.toFixed(1)}h batidas no Ponto dentro do período desta atividade
                                                </p>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()}
                                </td>
                                )}
                                {colunasVisiveis.has("servico") && (
                                <td className="px-3 py-2">
                                  <select
                                    value={t.servicoOrcamentoId ?? ""}
                                    onChange={(e) => patch(t.id, { servicoOrcamentoId: e.target.value || null })}
                                    className={`${cellInputCls} w-32`}
                                    title="Serviço do Orçamento executado por esta tarefa"
                                  >
                                    <option value="">—</option>
                                    {servicos.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.nome}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                )}
                                {colunasVisiveis.has("predec") && (
                                <td className="relative px-3 py-2">
                                  <button
                                    onClick={() => toggleDepPanel(t.id)}
                                    className={`truncate rounded px-1 py-1 text-left text-[11px] hover:bg-black/5 ${depPanelFor === t.id ? "bg-brand/10 text-brand-dark" : "text-neutral-500"}`}
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
                                            <input type="number" value={newLag} onChange={(e) => setNewLag(e.target.value)} title="Lag em dias" className="pill-field w-12 px-1.5 py-1" />
                                            <button onClick={() => handleAddDependencia(t.id)} disabled={!newPredId} className="btn-primary shrink-0 px-2.5 py-1 disabled:opacity-50">
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </td>
                                )}
                                <td className="px-3 py-2">
                                  <button onClick={() => handleDelete(t.id)} className="text-[10px] text-neutral-300 hover:text-red-500">
                                    ✕
                                  </button>
                                </td>
                              </tr>
                              {subtarefaAbertaId === t.id && (
                                <tr className="border-t border-dashed border-ink-800 bg-ink-800/30">
                                  <td></td>
                                  <td colSpan={9} className="px-3 py-1.5" style={{ paddingLeft: (depth + 1) * 18 + 12 }}>
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleAddSubtarefa(t);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <span className="text-neutral-500">↳</span>
                                      <input
                                        autoFocus
                                        value={novaSubtarefaTitulo}
                                        onChange={(e) => setNovaSubtarefaTitulo(e.target.value)}
                                        onKeyDown={(e) => e.key === "Escape" && setSubtarefaAbertaId(null)}
                                        placeholder={`Nova subtarefa de "${t.titulo}"`}
                                        className={`${inputCls} min-w-[240px] flex-1`}
                                      />
                                      <button type="submit" className="btn-primary px-2.5 py-1 text-xs">
                                        Adicionar
                                      </button>
                                      <button type="button" onClick={() => setSubtarefaAbertaId(null)} className="btn-ghost px-2.5 py-1 text-xs">
                                        Cancelar
                                      </button>
                                    </form>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* GANTT — separado embaixo, mesma ordem/agrupamento da tabela acima, sem setas (ficava emboladas) */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-fg">Gantt</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Zoom:</span>
              <div className="flex gap-0.5 rounded-full bg-black/5 p-0.5">
                {(Object.keys(ZOOM_LEVELS) as (keyof typeof ZOOM_LEVELS)[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`rounded-full px-2.5 py-1 capitalize transition-colors ${zoom === z ? "bg-white text-fg shadow-sm" : "text-neutral-500 hover:text-fg"}`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            ref={ganttScrollRef}
            className="card overflow-auto [scrollbar-width:auto] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:hover:bg-neutral-400 [&::-webkit-scrollbar-track]:bg-black/[0.02]"
            style={{ maxHeight: "60vh" }}
          >
            <div style={{ width: LABEL_W + totalDias * dayWidth, position: "relative" }} onPointerDown={handlePanPointerDown} onPointerMove={handlePanPointerMove} onPointerUp={handlePanPointerUp} onPointerLeave={handlePanPointerUp}>
              {hojeOffset >= 0 && hojeOffset < totalDias && (
                <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-brand" style={{ left: LABEL_W + hojeOffset * dayWidth }} />
              )}

              <div className="sticky top-0 z-20 bg-ink-900">
                <div className="flex border-b border-ink-800">
                  <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="sticky left-0 z-30 shrink-0 border-r border-ink-800 bg-ink-900" />
                  {meses.map((m, i) => (
                    <div key={i} style={{ width: m.dias * dayWidth, minWidth: m.dias * dayWidth }} className="shrink-0 truncate border-r border-ink-800 px-1.5 py-1 text-[9px] font-bold capitalize text-neutral-400">
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="flex border-b border-ink-800">
                  <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="sticky left-0 z-30 shrink-0 border-r border-ink-800 bg-ink-900 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                    Atividade
                  </div>
                  {dias.map((d, i) => (
                    <div
                      key={i}
                      style={{ width: dayWidth, minWidth: dayWidth }}
                      className={`shrink-0 border-r text-center text-[9px] ${d.getDate() === 1 ? "border-l-2 border-l-ink-700" : "border-ink-800/40"} ${
                        i === hojeOffset ? "font-bold text-brand" : "text-neutral-400"
                      }`}
                    >
                      {d.getDate()}
                    </div>
                  ))}
                </div>
              </div>

              {blocos.map((bloco) => {
                if (blocosColapsados.has(bloco)) return null;
                return (
                  <Fragment key={bloco}>
                    <div className="flex items-center border-b border-ink-800 bg-brand/[0.04]" style={{ height: ROW_H }}>
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="sticky left-0 z-10 shrink-0 truncate border-r border-ink-800 bg-ink-900 px-3 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {bloco}
                      </div>
                      <div style={{ width: totalDias * dayWidth }} className="shrink-0 bg-brand/[0.04]" />
                    </div>
                    {(gruposPorBloco.get(bloco) ?? []).map(({ tarefa: t, depth, numero }) => {
                      const inicio = t.dataInicio ? toDate(t.dataInicio) : null;
                      const offset = inicio ? Math.max(0, offsetDias(inicio)) : 0;
                      const result = cpm.results.get(t.id);
                      const isCritica = !!result?.isCritical && !cpm.hasCycle;
                      const cor = faseColor(t.fase);
                      const marco = t.dataInicio !== null && t.duracaoDias === 0;
                      const tFim = fim(t);
                      const isAtrasada = !marco && !!tFim && tFim < new Date(new Date().toDateString()) && t.percentConcluido < 100;
                      const isDragging = drag?.tarefaId === t.id;
                      let widthPx = 0;
                      let startOff = offset;
                      if (inicio) {
                        const endOff = offsetDias(fim(t)!);
                        widthPx = Math.max(1, endOff - offset + 1) * dayWidth;
                        if (isDragging && drag.modo === "mover") startOff += drag.deltaDias;
                        else if (isDragging && drag.modo === "redimensionar") widthPx = Math.max(dayWidth, widthPx + drag.deltaDias * dayWidth);
                      }
                      return (
                        <div key={t.id} className="flex border-b border-ink-800/50" style={{ height: ROW_H }}>
                          <div style={{ width: LABEL_W, minWidth: LABEL_W, paddingLeft: 10 + depth * 14 }} className="sticky left-0 z-10 flex shrink-0 items-center gap-1 truncate border-r border-ink-800 bg-ink-900 px-1 text-[10px]" title={t.titulo}>
                            {isAtrasada ? (
                              <span className="shrink-0 rounded bg-amber-500 px-1 text-[8px] font-bold text-white">ATRASADA</span>
                            ) : isCritica ? (
                              <span className="h-2.5 w-1 shrink-0 rounded-full bg-rose-500" />
                            ) : null}
                            <span className="shrink-0 font-mono text-neutral-400">{numero}</span>
                            <span className={`truncate ${isAtrasada ? "font-semibold text-amber-700" : "text-fg"}`}>{t.titulo}</span>
                          </div>
                          <div className="relative shrink-0" style={{ width: totalDias * dayWidth, height: ROW_H }}>
                            {dias.map((d, i) => (
                              <div key={i} className={`absolute top-0 bottom-0 border-r ${d.getDate() === 1 ? "border-l-2 border-l-ink-700" : "border-ink-800/30"}`} style={{ left: i * dayWidth, width: dayWidth }} />
                            ))}
                            {inicio && !marco && (
                              <div
                                onPointerDown={(e) => handleBarPointerDown(e, t, "mover")}
                                className={`group/bar absolute top-[6px] h-[20px] cursor-grab overflow-hidden rounded-md border-2 shadow active:cursor-grabbing ${
                                  isAtrasada ? "border-amber-500 bg-amber-100" : isCritica ? "border-rose-500 bg-rose-50" : ""
                                } ${isDragging ? "shadow-lg ring-2 ring-brand/40" : ""}`}
                                style={{ left: startOff * dayWidth, width: widthPx, ...(isAtrasada || isCritica ? {} : { backgroundColor: `${cor}33`, borderColor: cor }) }}
                                title={`${t.titulo} — ${t.percentConcluido}%${isAtrasada ? " — ATRASADA" : result && !cpm.hasCycle ? (isCritica ? " — crítica" : ` — folga ${result.float}d`) : ""}`}
                              >
                                <div
                                  className="pointer-events-none h-full"
                                  style={{ width: `${Math.min(t.percentConcluido, 100)}%`, backgroundColor: isAtrasada ? "#f59e0b" : isCritica ? "#fb7185" : cor }}
                                />
                                <div onPointerDown={(e) => handleBarPointerDown(e, t, "redimensionar")} className="absolute -right-1 top-0 h-full w-3 cursor-ew-resize opacity-0 group-hover/bar:opacity-100">
                                  <div className="mx-auto h-full w-1 rounded-full bg-neutral-500/60" />
                                </div>
                              </div>
                            )}
                            {marco && (
                              <div className="absolute top-[8px] h-4 w-4 rotate-45 cursor-pointer" style={{ left: startOff * dayWidth - 8, backgroundColor: isCritica ? "#e11d48" : cor }} title={`Marco: ${t.titulo}`} />
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
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-neutral-500">
            {fases.map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded border-2" style={{ backgroundColor: `${faseColor(f)}33`, borderColor: faseColor(f) }} />
                {f}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full bg-neutral-700" /> Real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded border-2 border-rose-500 bg-rose-50" /> Crítica
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded border-2 border-amber-500 bg-amber-100" /> Atrasada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rotate-45 bg-brand" /> Marco
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-brand" /> Hoje
            </span>
          </div>
        </>
      )}
    </div>
  );
}
