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
      const colItem = acharColuna(headers, ["item", "título", "titulo", "atividade", "tarefa"]);
      const colSubitem = acharColuna(headers, ["subitem", "sub-item", "sub item", "subitem de"]);
      const colFase = acharColuna(headers, ["bloco", "fase"]);
      const colStatus = acharColuna(headers, ["status"]);
      const colPrioridade = acharColuna(headers, ["prioridade"]);
      const colInicio = acharColuna(headers, ["início", "inicio", "data", "data início", "data inicio"]);
      const colDuracao = acharColuna(headers, ["duração", "duracao", "duração (dias)", "duracao (dias)", "dias"]);
      const colResp = acharColuna(headers, ["responsável", "responsavel"]);
      const colHorasEst = acharColuna(headers, ["horas estimadas", "horas est.", "horas est"]);
      const colValorHora = acharColuna(headers, ["valor hora", "valor/hora", "valor hora (r$)"]);

      if (!colItem) {
        setResultadoImport('Não achei uma coluna de item ("Item", "Título", "Atividade" ou "Tarefa"). Confira o cabeçalho da planilha.');
        return;
      }

      const val = (row: Record<string, any>, col: string | null) => (col ? String(row[col] ?? "").trim() : "");
      const bloco = (row: Record<string, any>) => val(row, colFase) || novoBloco || undefined;
      const camposComuns = (row: Record<string, any>, titulo: string) => {
        const respNome = val(row, colResp);
        const membro = respNome
          ? membros.find((m) => normalizar(m.nome) === normalizar(respNome) || normalizar(m.nome).includes(normalizar(respNome)))
          : null;
        return {
          obraId,
          titulo,
          fase: bloco(row),
          status: mapStatus(colStatus ? String(row[colStatus]) : undefined),
          prioridade: mapPrioridade(colPrioridade ? String(row[colPrioridade]) : undefined),
          dataInicio: colInicio ? excelDataParaISO(row[colInicio]) : undefined,
          duracaoDias: colDuracao && row[colDuracao] !== "" ? Number(row[colDuracao]) : undefined,
          responsavelId: membro?.userId,
          horasEstimadas: colHorasEst && row[colHorasEst] !== "" ? Number(row[colHorasEst]) : undefined,
          valorHora: colValorHora && row[colValorHora] !== "" ? Number(row[colValorHora]) : undefined,
        } as any;
      };
      const criar = async (body: any): Promise<string | null> => {
        const res = await fetch("/api/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return null;
        const t = await res.json().catch(() => null);
        return t?.id ?? "ok";
      };

      let ok = 0;
      let falhas = 0;
      // chave do item pai = bloco + nome do item (normalizado)
      const chave = (blocoNome: string | undefined, item: string) => `${normalizar(blocoNome || "")}|${normalizar(item)}`;
      const idsItens = new Map<string, string>();

      // Passe 1 — cria os ITENS (linhas sem subitem preenchido). Guarda o id de cada item.
      for (const row of rows) {
        const item = val(row, colItem);
        const sub = val(row, colSubitem);
        if (!item || sub) continue; // subitens ficam pro passe 2
        const id = await criar(camposComuns(row, item));
        if (id) {
          ok++;
          if (id !== "ok") idsItens.set(chave(bloco(row), item), id);
        } else falhas++;
      }

      // Passe 2 — cria os SUBITENS, ligando ao item pai (mesmo bloco + nome do item).
      for (const row of rows) {
        const item = val(row, colItem);
        const sub = val(row, colSubitem);
        if (!sub) continue;
        const paiId = idsItens.get(chave(bloco(row), item));
        const body = camposComuns(row, sub);
        if (paiId) body.tarefaMaeId = paiId;
        const id = await criar(body);
        if (id) ok++;
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
    // Bloco = seção; Item = atividade; Subitem = sub-atividade dentro do item (deixe vazio se for item).
    const exemplo = [
      { Bloco: "Contratação", Item: "Levantamento em campo", Subitem: "", Status: "A fazer", Prioridade: "Alta", Início: "2026-09-01", "Duração": 1, Responsável: "", "Horas estimadas": 4, "Valor hora": "" },
      { Bloco: "Fabricação", Item: "Tesouras", Subitem: "", Status: "A fazer", Prioridade: "Alta", Início: "2026-09-05", "Duração": 5, Responsável: "", "Horas estimadas": 40, "Valor hora": "" },
      { Bloco: "Fabricação", Item: "Tesouras", Subitem: "Corte dos perfis", Status: "A fazer", Prioridade: "Alta", Início: "2026-09-05", "Duração": 2, Responsável: "", "Horas estimadas": 16, "Valor hora": "" },
      { Bloco: "Fabricação", Item: "Tesouras", Subitem: "Solda e montagem", Status: "A fazer", Prioridade: "Alta", Início: "2026-09-07", "Duração": 3, Responsável: "", "Horas estimadas": 24, "Valor hora": "" },
      { Bloco: "Montagem", Item: "Montagem no local", Subitem: "", Status: "A fazer", Prioridade: "Alta", Início: "2026-09-15", "Duração": 4, Responsável: "", "Horas estimadas": 32, "Valor hora": "" },
    ];
    const sheet = XLSX.utils.json_to_sheet(exemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Atividades");
    XLSX.writeFile(wb, "modelo-planejamento-steelnova.xlsx");
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

  // agrupa por bloco (fase da tarefa raiz), monta a hierarquia raiz+filhos e numera
  // no estilo EAP (1, 1.1, 1.1.1...) — igual ao padrão de planejamento de obra/projeto
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

  const inputCls = "pill-field px-3 py-1.5 text-sm";

  return (
    <div className={compacto ? "" : "p-8"}>
      {compacto && <h2 className="mb-3 text-sm font-semibold text-fg">{titulo}</h2>}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
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
              placeholder="Nome do bloco (Aquisição, Fabricação, Montagem...)"
              className={`${inputCls} w-64`}
            />
            <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
              Criar
            </button>
            <button type="button" onClick={() => setCriandoBloco(false)} className="btn-ghost px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </form>
        )}
        <span className="mx-0.5 h-4 w-px bg-black/10" />
        <label className={`btn-ghost cursor-pointer px-3 py-1.5 text-xs ${importando ? "pointer-events-none opacity-50" : ""}`}>
          {importando ? "Importando..." : "📥 Importar Excel"}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
        </label>
        <button type="button" onClick={handleDownloadTemplate} className="btn-ghost px-3 py-1.5 text-xs">
          Baixar modelo
        </button>
      </div>
      {resultadoImport && <p className="mb-3 text-xs text-neutral-600">{resultadoImport}</p>}
      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Nova atividade (reunião, fazer orçamento, orçar calhas...)"
          className={`${inputCls} min-w-[260px] flex-1`}
        />
        <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className={inputCls} />
        <button type="submit" className="btn-primary px-4 py-1.5 text-xs">
          + Adicionar {novoBloco && <span className="font-normal opacity-80">em &quot;{novoBloco}&quot;</span>}
        </button>
      </form>
      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky left-0 top-0 z-30 w-8 border-b border-ink-800 bg-ink-900 px-1 py-2.5"></th>
              <th className="sticky left-8 top-0 z-30 border-b border-r border-ink-800 bg-ink-900 th-label">Título</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Status</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Prioridade</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Responsável</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Início</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Prazo</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Tarefa-mãe</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Horas est.</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Valor hora</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Custo est.</th>
            </tr>
          </thead>
          <tbody>
            {blocos.map((bloco, blocoIdx) => {
              const linhasDoBloco = gruposPorBloco.get(bloco) ?? [];
              const blocoColapsado = blocosColapsados.has(bloco);
              return (
                <Fragment key={bloco}>
                  <tr className="border-t border-ink-800 bg-brand/[0.04]">
                    <td colSpan={11} className="px-3 py-2">
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
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold normal-case text-brand-dark">
                          {blocoIdx + 1}
                        </span>
                        {bloco}
                        <span className="font-normal normal-case text-neutral-400">
                          · {linhasDoBloco.length} {linhasDoBloco.length === 1 ? "atividade" : "atividades"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!blocoColapsado &&
                    linhasDoBloco.map(({ tarefa: t, depth, numero }) => {
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
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">{numero}</span>
                      <span className={depth > 0 ? "text-fg-muted" : "font-medium text-fg"}>{t.titulo}</span>
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
                        <button type="submit" className="btn-primary px-2.5 py-1 text-xs">
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
