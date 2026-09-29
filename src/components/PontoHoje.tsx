"use client";

import { useEffect, useRef, useState } from "react";

type Funcionario = { id: string; nome: string; cargo: string | null };
type Trab = { id: string; nome: string; funcao: string; entrada: string | null; saida: string | null; funcionarioId: string | null };
type Tarefa = { id: string; titulo: string; fase: string | null };
type Ativ = { id: string; descricao: string; situacao: "FINALIZADA" | "PARCIAL"; tarefa: { id: string; titulo: string } | null };
type Pend = { id: string; descricao: string; observacao: string | null };
type Foto = { id: string };
type Item = { id: string; descricao: string; quantidade: number | null; fotoData: string | null };
type Rdo = {
  id: string; data: string; clima: string;
  horarioInicio: string | null; horarioTermino: string | null; observacoes: string | null;
  almocoInicio: string | null; almocoFim: string | null; encerrado: boolean;
  trabalhadores: Trab[]; atividades: Ativ[]; pendencias: Pend[]; fotos: Foto[]; itensFabricados: Item[];
};

const CLIMA = [
  { v: "SOL", label: "☀️ Sol" }, { v: "NUBLADO", label: "☁️ Nublado" },
  { v: "CHUVA", label: "🌧️ Chuva" }, { v: "TEMPO_RUIM", label: "⛈️ Ruim" },
];

function agora() { return new Date().toTimeString().slice(0, 5); }
function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function horas(e: string | null, s: string | null, ai?: string | null, af?: string | null) {
  if (!e || !s) return null;
  let m = toMin(s) - toMin(e); if (m < 0) m += 1440;
  if (ai && af) { const lm = toMin(af) - toMin(ai); if (lm > 0) m -= Math.min(lm, m); } // desconta almoço
  return (m / 60).toFixed(1);
}
function resizeImg(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const rd = new FileReader();
    rd.onload = () => { img.src = rd.result as string; }; rd.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) { if (width >= height) { height = Math.round((height * max) / width); width = max; } else { width = Math.round((width * max) / height); height = max; } }
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject; rd.readAsDataURL(file);
  });
}

export default function PontoHoje({ obraId }: { obraId: string }) {
  const hoje = new Date();
  const dataISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const [rdo, setRdo] = useState<Rdo | null>(null);
  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState("");
  const [avulso, setAvulso] = useState("");
  const [busy, setBusy] = useState(false);
  const [novaAtiv, setNovaAtiv] = useState("");
  const [ativFin, setAtivFin] = useState(false);
  const [ativTarefa, setAtivTarefa] = useState("");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [novaPend, setNovaPend] = useState("");
  const [flash, setFlash] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);
  const [horaEntrada, setHoraEntrada] = useState(agora());
  const [novoItem, setNovoItem] = useState("");
  const [itemFoto, setItemFoto] = useState<string | null>(null);
  const itemFotoRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    const [r, f, tk] = await Promise.all([
      fetch(`/api/rdo/hoje?obraId=${obraId}&data=${dataISO}`),
      fetch("/api/funcionarios"),
      fetch(`/api/tarefas?obraId=${obraId}`),
    ]);
    if (r.ok) setRdo(await r.json());
    if (f.ok) setFuncs(await f.json());
    if (tk.ok) { const ts = await tk.json(); setTarefas(ts.map((t: any) => ({ id: t.id, titulo: t.titulo, fase: t.fase }))); }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [obraId]);

  async function abrirDia(clima = "SOL") {
    setBusy(true);
    const r = await fetch("/api/rdo/hoje", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ obraId, data: dataISO, clima }) });
    if (r.ok) setRdo(await r.json());
    setBusy(false);
  }
  async function setClima(clima: string) {
    setRdo((p) => (p ? { ...p, clima } : p));
    await fetch("/api/rdo/hoje", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ obraId, data: dataISO, clima }) });
  }
  async function registrarEntrada() {
    if (!rdo) return;
    const f = funcs.find((x) => x.id === sel);
    const nome = f?.nome || avulso.trim();
    if (!nome) return;
    setBusy(true);
    const r = await fetch(`/api/rdo/${rdo.id}/trabalhador`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: f?.id, nome, funcao: f?.cargo || "—", entrada: horaEntrada || agora() }) });
    setBusy(false);
    if (r.ok) { setSel(""); setAvulso(""); setAberto(false); setHoraEntrada(agora()); carregar(); }
  }
  async function patchTrab(tid: string, body: any) {
    await fetch(`/api/rdo/trabalhador/${tid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    carregar();
  }
  async function removerTrab(tid: string) {
    if (!confirm("Remover esta pessoa do ponto de hoje?")) return;
    await fetch(`/api/rdo/trabalhador/${tid}`, { method: "DELETE" }); carregar();
  }
  async function addAtividade() {
    if (!rdo || !novaAtiv.trim()) return;
    await fetch(`/api/rdo/${rdo.id}/atividade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: novaAtiv.trim(), situacao: ativFin ? "FINALIZADA" : "PARCIAL", tarefaId: ativTarefa || undefined }) });
    setNovaAtiv(""); setAtivFin(false); setAtivTarefa(""); carregar();
  }
  async function delAtividade(aid: string) { await fetch(`/api/rdo/atividade/${aid}`, { method: "DELETE" }); carregar(); }
  async function addPendencia() {
    if (!rdo || !novaPend.trim()) return;
    await fetch(`/api/rdo/${rdo.id}/pendencia`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: novaPend.trim() }) });
    setNovaPend(""); carregar();
  }
  async function delPendencia(pid: string) { await fetch(`/api/rdo/pendencia/${pid}`, { method: "DELETE" }); carregar(); }
  async function salvarObs(texto: string) {
    if (!rdo) return;
    await fetch(`/api/rdo/${rdo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observacoes: texto }) });
  }
  async function enviarFoto(file: File) {
    if (!rdo) return;
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("legenda", "Foto do dia");
    await fetch(`/api/rdo/${rdo.id}/fotos`, { method: "POST", body: fd });
    setBusy(false); carregar();
  }
  async function addItem() {
    if (!rdo || !novoItem.trim()) return;
    setBusy(true);
    await fetch(`/api/rdo/${rdo.id}/item`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: novoItem.trim(), fotoData: itemFoto }) });
    setBusy(false); setNovoItem(""); setItemFoto(null); carregar();
  }
  async function delItem(iid: string) { await fetch(`/api/rdo/item/${iid}`, { method: "DELETE" }); carregar(); }
  async function fotoItem(iid: string, dataUrl: string) { await fetch(`/api/rdo/item/${iid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fotoData: dataUrl }) }); carregar(); }
  async function gerarRDO() {
    if (!rdo) return;
    const entradas = rdo.trabalhadores.map((t) => t.entrada).filter(Boolean) as string[];
    const inicio = rdo.horarioInicio || (entradas.length ? entradas.sort()[0] : agora());
    await fetch(`/api/rdo/${rdo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horarioInicio: inicio, horarioTermino: agora() }) });
    setFlash("✅ RDO do dia salvo no histórico!");
    setTimeout(() => setFlash(""), 4000);
    carregar();
  }
  async function patchRdo(body: any) {
    if (!rdo) return;
    await fetch(`/api/rdo/${rdo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    carregar();
  }
  async function encerrarDia() {
    if (!rdo) return;
    if (!confirm("Encerrar o dia? Quem ainda estiver trabalhando será finalizado agora.")) return;
    setBusy(true);
    const ag = agora();
    for (const t of rdo.trabalhadores.filter((x) => !x.saida)) {
      await fetch(`/api/rdo/trabalhador/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saida: ag }) });
    }
    const ent = rdo.trabalhadores.map((t) => t.entrada).filter(Boolean) as string[];
    const inicio = rdo.horarioInicio || (ent.length ? ent.sort()[0] : ag);
    await fetch(`/api/rdo/${rdo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encerrado: true, horarioInicio: inicio, horarioTermino: ag }) });
    setBusy(false);
    carregar();
  }

  const dataLabel = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const trab = rdo?.trabalhadores ?? [];
  const ativos = trab.filter((t) => !t.saida);
  const prontos = trab.filter((t) => t.saida);
  const jaTem = new Set(trab.map((t) => t.funcionarioId).filter(Boolean));
  const disp = funcs.filter((f) => !jaTem.has(f.id));
  const inp = "w-full pill-field px-3 py-2.5 text-base sm:py-2 sm:text-sm";

  return (
    <div className="mb-6 rounded-2xl border border-brand/30 bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-fg">Ponto de hoje</h2>
          <p className="text-xs capitalize text-neutral-500">{dataLabel}{rdo?.horarioTermino ? " · fechado" : ""}</p>
        </div>
        {rdo && (
          <div className="flex flex-wrap gap-1">
            {CLIMA.map((c) => (
              <button key={c.v} type="button" onClick={() => setClima(c.v)} className={`rounded-lg border px-2 py-1 text-xs ${rdo.clima === c.v ? "border-brand bg-brand/10 font-medium text-brand" : "border-ink-700 bg-white/60 text-fg-muted"}`}>{c.label}</button>
            ))}
          </div>
        )}
      </div>

      {!rdo ? (
        <button type="button" disabled={busy} onClick={() => abrirDia()} className="btn-primary w-full py-3 text-base disabled:opacity-50">{busy ? "Abrindo…" : "▶ Abrir o dia"}</button>
      ) : (
        <>
          {ativos.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {ativos.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white p-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-fg">{t.nome}</p><p className="text-xs text-neutral-500">{t.funcao}</p></div>
                  <input type="time" value={t.entrada ?? ""} onChange={(e) => patchTrab(t.id, { entrada: e.target.value })} className="w-[92px] rounded-lg border border-ink-300 px-2 py-1.5 text-sm" title="Entrada" />
                  <button type="button" onClick={() => patchTrab(t.id, { saida: agora() })} className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white">Finalizar</button>
                  <button type="button" onClick={() => removerTrab(t.id)} className="shrink-0 px-1 text-xs text-red-500">✕</button>
                </div>
              ))}
            </div>
          )}

          {!aberto ? (
            <button type="button" onClick={() => setAberto(true)} className="w-full rounded-xl border border-dashed border-brand/50 py-2.5 text-sm font-medium text-brand">+ Registrar entrada</button>
          ) : (
            <div className="rounded-xl border border-ink-200 bg-white p-3">
              <select value={sel} onChange={(e) => { setSel(e.target.value); setAvulso(""); }} className={`mb-2 ${inp}`}>
                <option value="">Selecionar da equipe…</option>
                {disp.map((f) => (<option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` — ${f.cargo}` : ""}</option>))}
              </select>
              {!sel && <input value={avulso} onChange={(e) => setAvulso(e.target.value)} placeholder="ou nome avulso" className={`mb-2 ${inp}`} />}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-neutral-500">Hora de entrada:</span>
                <input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} className="rounded-lg border border-ink-300 px-2 py-1.5 text-sm" />
                <button type="button" onClick={() => setHoraEntrada(agora())} className="rounded-lg border border-ink-300 px-2 py-1 text-xs text-fg-muted">agora</button>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy || (!sel && !avulso.trim())} onClick={registrarEntrada} className="btn-primary flex-1 py-2.5 text-base disabled:opacity-50 sm:text-sm">Registrar entrada ({horaEntrada})</button>
                <button type="button" onClick={() => { setAberto(false); setSel(""); setAvulso(""); }} className="rounded-lg border border-ink-300 px-3 text-sm text-fg-muted">Cancelar</button>
              </div>
            </div>
          )}

          {prontos.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-neutral-500">Finalizados ({prontos.length})</p>
              <div className="flex flex-col gap-1">
                {prontos.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-fg">{t.nome}</span>
                    <input type="time" value={t.entrada ?? ""} onChange={(e) => patchTrab(t.id, { entrada: e.target.value })} className="w-[74px] rounded border border-ink-300 px-1 py-1 text-xs" title="Entrada" />
                    <input type="time" value={t.saida ?? ""} onChange={(e) => patchTrab(t.id, { saida: e.target.value })} className="w-[74px] rounded border border-ink-300 px-1 py-1 text-xs" title="Saída" />
                    <span className="text-xs text-neutral-500">{horas(t.entrada, t.saida, rdo.almocoInicio, rdo.almocoFim)}h</span>
                    <button type="button" onClick={() => removerTrab(t.id)} className="text-xs text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- almoço ---- */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!rdo.almocoInicio ? (
              <button type="button" onClick={() => patchRdo({ almocoInicio: agora() })} className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-fg-muted">🍴 Pausa almoço</button>
            ) : !rdo.almocoFim ? (
              <button type="button" onClick={() => patchRdo({ almocoFim: agora() })} className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">▶ Voltar do almoço (pausa desde {rdo.almocoInicio})</button>
            ) : (
              <span className="rounded-lg bg-white/70 px-3 py-1.5 text-xs text-neutral-500">🍴 Almoço {rdo.almocoInicio}–{rdo.almocoFim} (descontado das horas)</span>
            )}
          </div>

          {/* ---- encerrar o dia libera o relatório ---- */}
          {!rdo.encerrado ? (
            <button type="button" disabled={busy} onClick={encerrarDia} className="mt-3 w-full rounded-xl bg-ink-900 py-3 text-base font-semibold text-white disabled:opacity-50">
              ⏹ Encerrar o dia
            </button>
          ) : (
          <div className="mt-4 border-t border-brand/20 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Relatório do dia</p>
              <button type="button" onClick={() => patchRdo({ encerrado: false })} className="text-xs text-brand">↩ reabrir dia</button>
            </div>

            {/* Atividades */}
            <p className="mb-1 text-xs font-medium text-neutral-500">Atividades realizadas</p>
            <div className="mb-2 flex flex-col gap-1">
              {(rdo.atividades ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                  <span>{a.situacao === "FINALIZADA" ? "✅" : "🔶"}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">
                    {a.descricao}
                    {a.tarefa && <span className="ml-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">📋 {a.tarefa.titulo}</span>}
                  </span>
                  <button type="button" onClick={() => delAtividade(a.id)} className="shrink-0 text-xs text-red-500">✕</button>
                </div>
              ))}
            </div>
            <div className="mb-3 flex flex-col gap-2">
              <select value={ativTarefa} onChange={(e) => { const id = e.target.value; setAtivTarefa(id); const t = tarefas.find((x) => x.id === id); if (t && !novaAtiv.trim()) setNovaAtiv(t.titulo); }} className={inp} title="Vincular a uma tarefa do Planejamento/Lista (opcional)">
                <option value="">📋 Vincular a uma tarefa (opcional)…</option>
                {tarefas.map((t) => (<option key={t.id} value={t.id}>{t.fase ? `${t.fase} — ` : ""}{t.titulo}</option>))}
              </select>
              <div className="flex gap-2">
                <input value={novaAtiv} onChange={(e) => setNovaAtiv(e.target.value)} placeholder="O que foi feito…" className={inp} />
                <button type="button" onClick={() => setAtivFin((v) => !v)} className={`shrink-0 rounded-lg border px-2 text-xs ${ativFin ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-ink-300 text-neutral-500"}`} title="Finalizada?">{ativFin ? "✅ Fim" : "🔶 Parc"}</button>
                <button type="button" onClick={addAtividade} className="shrink-0 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white">+</button>
              </div>
            </div>

            {/* Pendências */}
            <p className="mb-1 text-xs font-medium text-neutral-500">Pendências</p>
            <div className="mb-2 flex flex-col gap-1">
              {(rdo.pendencias ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-amber-700">• {p.descricao}</span>
                  <button type="button" onClick={() => delPendencia(p.id)} className="text-xs text-red-500">✕</button>
                </div>
              ))}
            </div>
            <div className="mb-3 flex gap-2">
              <input value={novaPend} onChange={(e) => setNovaPend(e.target.value)} placeholder="Alguma pendência…" className={inp} />
              <button type="button" onClick={addPendencia} className="shrink-0 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white">+</button>
            </div>

            {/* Observações */}
            <p className="mb-1 text-xs font-medium text-neutral-500">Observações do dia</p>
            <textarea defaultValue={rdo.observacoes ?? ""} onBlur={(e) => salvarObs(e.target.value)} rows={2} placeholder="Ocorrências, visitas, etc." className={`mb-3 ${inp}`} />

            {/* Fotos */}
            <p className="mb-1 text-xs font-medium text-neutral-500">Fotos</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {(rdo.fotos ?? []).map((f) => (
                <a key={f.id} href={`/api/rdo/fotos/${f.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/rdo/fotos/${f.id}`} alt="Foto" className="h-16 w-16 rounded-lg border border-ink-300 object-cover" />
                </a>
              ))}
              <button type="button" disabled={busy} onClick={() => fotoRef.current?.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-brand/50 text-2xl text-brand disabled:opacity-50">＋</button>
              <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(f); e.target.value = ""; }} />
            </div>

            {/* Itens fabricados */}
            <p className="mb-1 text-xs font-medium text-neutral-500">Itens fabricados</p>
            <div className="mb-2 flex flex-col gap-1.5">
              {(rdo.itensFabricados ?? []).map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-sm">
                  {it.fotoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={it.fotoData} target="_blank" rel="noreferrer"><img src={it.fotoData} alt="" className="h-12 w-12 rounded-md border border-ink-300 object-cover" /></a>
                  ) : (
                    <button type="button" onClick={() => { const el = document.createElement("input"); el.type = "file"; el.accept = "image/*"; (el as any).capture = "environment"; el.onchange = async () => { const f = (el.files || [])[0]; if (f) { setBusy(true); const d = await resizeImg(f); await fotoItem(it.id, d); setBusy(false); } }; el.click(); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-brand/50 text-lg text-brand" title="Adicionar foto">📷</button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-fg">{it.descricao}</span>
                  <button type="button" onClick={() => delItem(it.id)} className="shrink-0 text-xs text-red-500">✕</button>
                </div>
              ))}
            </div>
            <div className="mb-3 flex items-center gap-2">
              <button type="button" onClick={() => itemFotoRef.current?.click()} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-xl ${itemFoto ? "border-emerald-400 bg-emerald-50" : "border-dashed border-brand/50 text-brand"}`} title="Foto do item">{itemFoto ? "✅" : "📷"}</button>
              <input ref={itemFotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setBusy(true); setItemFoto(await resizeImg(f)); setBusy(false); } e.target.value = ""; }} />
              <input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="Item fabricado (ex.: Tesoura TES-01)…" className={inp} />
              <button type="button" disabled={busy || !novoItem.trim()} onClick={addItem} className="shrink-0 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white disabled:opacity-50">+</button>
            </div>

            {/* Gerar / fechar RDO */}
            {flash && <p className="mb-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">{flash}</p>}
            <button type="button" onClick={gerarRDO} className="btn-primary w-full py-3 text-base">
              {rdo.horarioTermino ? "Atualizar RDO do dia" : "Gerar RDO do dia"}
            </button>
            <p className="mt-2 text-[11px] text-neutral-500">Cada "Finalizar" já lançou a diária da pessoa. Preencha o relatório, anexe as fotos e toque em Gerar RDO do dia — ele fica salvo no histórico.</p>
          </div>
          )}
        </>
      )}
    </div>
  );
}
