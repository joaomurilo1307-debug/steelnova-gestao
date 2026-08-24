"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Avatar from "@/components/Avatar";
import { personColor } from "@/lib/personColor";

type Tarefa = {
  id: string;
  titulo: string;
  fase: string | null;
  status: "A_FAZER" | "FAZENDO" | "BLOQUEADO" | "FEITO";
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  dataInicio: string | null;
  duracaoDias: number;
  responsavelId: string | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  tarefaMaeId: string | null;
  horasEstimadas: string | null;
  valorHora: string | null;
  ordem: number;
};

const SEM_BLOCO = "Sem bloco";

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

const DIACRITICOS = new RegExp(String.fromCharCode(91, 92, 117, 48, 51, 48, 48, 45, 92, 117, 48, 51, 54, 102, 93), "g");

function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .trim();
}

function acharColuna(headers: string[], candidatos: string[]) {
  const normHeaders = headers.map(normalizar);
  for (const cand of candidatos) {
    const i = normHeaders.indexOf(normalizar(cand));
    if (i >= 0) return headers[i];
  }
  return null;
}

function mapStatus(v: string | undefined): string {
  const n = normalizar(v ?? "");
  if (n.includes("feito") || n.includes("conclu")) return "FEITO";
  if (n.includes("fazendo") || n.includes("andamento") || n.includes("progresso")) return "FAZENDO";
  if (n.includes("bloque")) return "BLOQUEADO";
  return "A_FAZER";
}

function mapPrioridade(v: string | undefined): string {
  const n = normalizar(v ?? "");
  if (n.includes("urgente")) return "URGENTE";
  if (n.includes("alta")) return "ALTA";
  if (n.includes("baixa")) return "BAIXA";
  return "MEDIA";
}

function excelDataParaISO(v: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const s = v.trim();
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const [, d, m, y] = br;
      const ano = y.length === 2 ? `20${y}` : y;
      return `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
  }
  return undefined;
}

export default function TarefaListView({ obraId, titulo = "Lista de atividades", compacto = false }: { obraId: string; titulo?: string; compacto?: boolean }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [blocosColapsados, setBlocosColapsados] = useState<Set<string>>(new Set());
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaData, setNovaData] = useState("");
  const [novoBloco, setNovoBloco] = useState("");
  const [criandoBloco, setCriandoBloco] = useState(false);
  const [nomeNovoBloco, setNomeNovoBloco] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [subtarefaAbertaId, setSubtarefaAbertaId] = useState<string | null>(null);
  const [novaSubtarefaTitulo, setNovaSubtarefaTitulo] = useState("");

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, titulo: novoTitulo, fase: novoBloco || undefined, dataInicio: novaData || undefined }),
    });
    setNovoTitulo("");
    setNovaData("");
    load();
  }

  function handleCriarBloco(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeNovoBloco.trim()) return;
    setNovoBloco(nomeNovoBloco.trim());
    setNomeNovoBloco("");
    setCriandoBloco(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportando(true);
    setResultadoImport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) {
        setResultadoImport("Planilha vazia ou sem cabeçalho reconhecível.");
        return;
      }
      const headers = Object.keys(rows[0]);
      const colTitulo = acharColuna(headers, ["título", "titulo", "atividade", "tarefa"]);
      const colFase = acharColuna(headers, ["fase", "bloco"]);
      const colStatus = acharColuna(headers, ["status"]);
      const colPrioridade = acharColuna(headers, ["prioridade"]);
      const colInicio = acharColuna(headers, ["início", "inicio", "data", "data início", "data inicio"]);
      const colResp = acharColuna(headers, ["responsável", "responsavel"]);
      const colHorasEst = acharColuna(headers, ["horas estimadas", "horas est.", "horas est"]);
      const colValorHora = acharColuna(headers, ["valor hora", "valor/hora", "valor hora (r$)"]);

      if (!colTitulo) {
        setResultadoImport('Não achei uma coluna de título ("Título", "Atividade" ou "Tarefa"). Confira o cabeçalho da planilha.');
        return;
      }

      let ok = 0;
      let falhas = 0;
      for (const row of rows) {
        const titulo = String(row[colTitulo] ?? "").trim();
        if (!titulo) continue;
        const respNome = colResp ? String(row[colResp] ?? "").trim() : "";
        const membro = respNome ? membros.find((m) => normalizar(m.nome) === normalizar(respNome) || normalizar(m.nome).includes(normalizar(respNome))) : null;

        const body: any = {
          obraId,
          titulo,
          fase: colFase ? String(row[colFase] ?? "").trim() || novoBloco || undefined : novoBloco || undefined,
          status: mapStatus(colStatus ? String(row[colStatus]) : undefined),
          prioridade: mapPrioridade(colPrioridade ? String(row[colPrioridade]) : undefined),
          dataInicio: colInicio ? excelDataParaISO(row[colInicio]) : undefined,
          responsavelId: membro?.userId,
          horasEstimadas: colHorasEst && row[colHorasEst] !== "" ? Number(row[colHorasEst]) : undefined,
          valorHora: colValorHora && row[colValorHora] !== "" ? Number(row[colValorHora]) : undefined,
        };
        const res = await fetch("/api/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) ok++;
        else falhas++;
      }
      setResultadoImport(`Importado: ${ok} ${ok === 1 ? "atividade" : "atividades"}${falhas > 0 ? `, ${falhas} falharam` : ""}.`);
      load();
    } catch (err: any) {
      setResultadoImport("Erro ao ler a planilha: " + (err?.message ?? String(err)));
    } finally {
      setImportando(false);
    }
  }

  function handleDownloadTemplate() {
    const exemplo = [
      { Título: "Reunião de alinhamento", Fase: "Aquisição", Status: "A fazer", Prioridade: "Média", Início: "2026-09-01", Responsável: "", "Horas estimadas": 1, "Valor hora": "" },
      { Título: "Orçar calhas", Fase: "Aquisição", Status: "A fazer", Prioridade: "Alta", Início: "2026-09-02", Responsável: "", "Horas estimadas": 2, "Valor hora": "" },
    ];
    const sheet = XLSX.utils.json_to_sheet(exemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Atividades");
    XLSX.writeFile(wb, "modelo-importacao-atividades.xlsx");
  }

  async function patch(id: string, body: any) {
    await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  // só permite arrastar dentro do mesmo grupo de irmãs: mesma tarefa-mãe
  // (ou, se ambas forem raiz, mesmo bloco) — evita reparentar/trocar de bloco sem querer
  function mesmoGrupo(a: Tarefa, b: Tarefa) {
    if (a.tarefaMaeId !== b.tarefaMaeId) return false;
    if (a.tarefaMaeId) return true;
    return (a.fase?.trim() || SEM_BLOCO) === (b.fase?.trim() || SEM_BLOCO);
  }

  async function handleDrop(targetId: string) {
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
    const alteradas = lista.filter((t, i) => t.ordem !== i);
    await Promise.all(
      alteradas.map((t) =>
        fetch(`/api/tarefas/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordem: lista.indexOf(t) }),
        })
      )
    );
    load();
  }

  async function handleAddSubtarefa(pai: Tarefa) {
    if (!novaSubtarefaTitulo.trim()) return;
    await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, titulo: novaSubtarefaTitulo.trim(), fase: pai.fase ?? undefined, tarefaMaeId: pai.id }),
    });
    setNovaSubtarefaTitulo("");
    setSubtarefaAbertaId(null);
    load();
  }

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

  // agrupa por bloco (fase da tarefa raiz), e dentro de cada bloco monta a hierarquia raiz+filhos
  const gruposPorBloco = useMemo(() => {
    const porMae = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      const key = t.tarefaMaeId ?? "__root__";
      if (!porMae.has(key)) porMae.set(key, []);
      porMae.get(key)!.push(t);
    }
    const out = new Map<string, { tarefa: Tarefa; depth: number }[]>();
    const raizes = porMae.get("__root__") ?? [];
    for (const raiz of raizes) {
      const bloco = raiz.fase?.trim() || SEM_BLOCO;
      if (!out.has(bloco)) out.set(bloco, []);
      out.get(bloco)!.push({ tarefa: raiz, depth: 0 });
      if (!collapsed.has(raiz.id)) {
        function walkFilhos(key: string, depth: number) {
          for (const t of porMae.get(key) ?? []) {
            out.get(bloco)!.push({ tarefa: t, depth });
            if (!collapsed.has(t.id)) walkFilhos(t.id, depth + 1);
          }
        }
        walkFilhos(raiz.id, 1);
      }
    }
    return out;
  }, [tarefas, collapsed]);

  const inputCls = "rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-fg outline-none focus:border-brand";

  return (
    <div className={compacto ? "" : "p-6"}>
      {compacto && <h2 className="mb-2 text-sm font-semibold text-fg">{titulo}</h2>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!criandoBloco ? (
          <>
            <select value={novoBloco} onChange={(e) => setNovoBloco(e.target.value)} className={inputCls}>
              <option value="">Sem bloco</option>
              {blocosParaSelecionar.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setCriandoBloco(true)} className="text-xs text-brand hover:underline">
              + Novo bloco
            </button>
          </>
        ) : (
          <form onSubmit={handleCriarBloco} className="flex items-center gap-2">
            <input
              autoFocus
              value={nomeNovoBloco}
              onChange={(e) => setNomeNovoBloco(e.target.value)}
              placeholder="Nome do bloco (Aquisição, Fabricação, Montagem...)"
              className={`${inputCls} w-64`}
            />
            <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
              Criar
            </button>
            <button type="button" onClick={() => setCriandoBloco(false)} className="text-xs text-neutral-500 hover:underline">
              Cancelar
            </button>
          </form>
        )}
        <span className="mx-1 h-4 w-px bg-ink-700" />
        <label className={`cursor-pointer text-xs text-brand hover:underline ${importando ? "pointer-events-none opacity-50" : ""}`}>
          {importando ? "Importando..." : "📥 Importar Excel"}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
        </label>
        <button type="button" onClick={handleDownloadTemplate} className="text-xs text-neutral-500 hover:underline">
          Baixar modelo
        </button>
      </div>
      {resultadoImport && <p className="mb-3 text-xs text-neutral-600">{resultadoImport}</p>}
      <form onSubmit={handleAdd} className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Nova atividade (reunião, fazer orçamento, orçar calhas...)"
          className={`${inputCls} min-w-[260px] flex-1`}
        />
        <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className={inputCls} />
        <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
          + Adicionar {novoBloco && <span className="font-normal opacity-80">em &quot;{novoBloco}&quot;</span>}
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky left-0 top-0 z-30 w-8 border-b border-ink-800 bg-ink-900 px-1 py-2.5"></th>
              <th className="sticky left-8 top-0 z-30 border-b border-r border-ink-800 bg-ink-900 px-3 py-2.5 font-medium">Título</th>
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
            {blocos.map((bloco) => {
              const linhasDoBloco = gruposPorBloco.get(bloco) ?? [];
              const blocoColapsado = blocosColapsados.has(bloco);
              return (
                <Fragment key={bloco}>
                  <tr className="border-t border-ink-800 bg-ink-800/60">
                    <td colSpan={11} className="px-3 py-1.5">
                      <button
                        onClick={() =>
                          setBlocosColapsados((c) => {
                            const next = new Set(c);
                            next.has(bloco) ? next.delete(bloco) : next.add(bloco);
                            return next;
                          })
                        }
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                      >
                        {blocoColapsado ? "▸" : "▾"} {bloco}
                        <span className="font-normal normal-case text-neutral-400">
                          · {linhasDoBloco.length} {linhasDoBloco.length === 1 ? "atividade" : "atividades"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!blocoColapsado &&
                    linhasDoBloco.map(({ tarefa: t, depth }) => {
                      const fim = prazo(t);
                      const atrasada = !!fim && t.status !== "FEITO" && fim < new Date(new Date().toDateString());
                      const temFilhas = tarefas.some((x) => x.tarefaMaeId === t.id);
                      const custo = t.horasEstimadas && t.valorHora ? Number(t.horasEstimadas) * Number(t.valorHora) : null;

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
                    handleDrop(t.id);
                  }}
                  className={`group border-t border-ink-800 ${draggingId === t.id ? "opacity-40" : ""} ${
                    dragOverId === t.id && podeReceberDrop ? "border-t-2 border-t-brand" : ""
                  }`}
                >
                  <td
                    className="sticky left-0 z-10 cursor-grab bg-ink-900 px-1 py-2.5 text-center text-neutral-400 active:cursor-grabbing"
                    title="Arrastar para reordenar"
                  >
                    ⠿
                  </td>
                  <td className="sticky left-8 z-10 border-r border-ink-800 bg-ink-900 px-3 py-2.5">
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
                      <button
                        onClick={() => {
                          setSubtarefaAbertaId(subtarefaAbertaId === t.id ? null : t.id);
                          setNovaSubtarefaTitulo("");
                        }}
                        className="ml-1 shrink-0 text-xs text-brand opacity-0 hover:underline group-hover:opacity-100"
                        title="Adicionar subtarefa"
                      >
                        + subtarefa
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {t.responsavel && (
                        <Avatar name={t.responsavel.name} photoUrl={t.responsavel.avatarUrl} color={personColor(t.responsavel.id)} size={20} />
                      )}
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
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      defaultValue={t.horasEstimadas ?? ""}
                      onBlur={(e) => patch(t.id, { horasEstimadas: e.target.value ? Number(e.target.value) : null })}
                      className={`${inputCls} w-20`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
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
                {subtarefaAbertaId === t.id && (
                  <tr className="border-t border-dashed border-ink-800 bg-ink-800/30">
                    <td></td>
                    <td colSpan={10} className="px-3 py-1.5" style={{ paddingLeft: (depth + 1) * 20 + 12 }}>
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
                        <button type="submit" className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">
                          Adicionar
                        </button>
                        <button type="button" onClick={() => setSubtarefaAbertaId(null)} className="text-xs text-neutral-500 hover:underline">
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
            {tarefas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-neutral-500">
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
