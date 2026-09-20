"use client";

import { useEffect, useRef, useState } from "react";

type Funcionario = { id: string; nome: string; cargo: string | null };
type Trab = { id: string; nome: string; funcao: string; entrada: string | null; saida: string | null; funcionarioId: string | null };
type Ativ = { id: string; descricao: string; situacao: "FINALIZADA" | "PARCIAL" };
type Pend = { id: string; descricao: string; observacao: string | null };
type Foto = { id: string };
type Rdo = {
  id: string; data: string; clima: string;
  horarioInicio: string | null; horarioTermino: string | null; observacoes: string | null;
  trabalhadores: Trab[]; atividades: Ativ[]; pendencias: Pend[]; fotos: Foto[];
};

const CLIMA = [
  { v: "SOL", label: "☀️ Sol" }, { v: "NUBLADO", label: "☁️ Nublado" },
  { v: "CHUVA", label: "🌧️ Chuva" }, { v: "TEMPO_RUIM", label: "⛈️ Ruim" },
];

function agora() { return new Date().toTimeString().slice(0, 5); }
function horas(e: string | null, s: string | null) {
  if (!e || !s) return null;
  const [eh, em] = e.split(":").map(Number); const [sh, sm] = s.split(":").map(Number);
  let m = sh * 60 + sm - (eh * 60 + em); if (m < 0) m += 1440;
  return (m / 60).toFixed(1);
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
  const [novaPend, setNovaPend] = useState("");
  const [flash, setFlash] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    const [r, f] = await Promise.all([
      fetch(`/api/rdo/hoje?obraId=${obraId}&data=${dataISO}`),
      fetch("/api/funcionarios"),
    ]);
    if (r.ok) setRdo(await r.json());
    if (f.ok) setFuncs(await f.json());
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
    const r = await fetch(`/api/rdo/${rdo.id}/trabalhador`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funcionarioId: f?.id, nome, funcao: f?.cargo || "—", entrada: agora() }) });
    setBusy(false);
    if (r.ok) { setSel(""); setAvulso(""); setAberto(false); carregar(); }
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
    await fetch(`/api/rdo/${rdo.id}/atividade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: novaAtiv.trim(), situacao: ativFin ? "FINALIZADA" : "PARCIAL" }) });
    setNovaAtiv(""); setAtivFin(false); carregar();
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
  async function gerarRDO() {
    if (!rdo) return;
    const entradas = rdo.trabalhadores.map((t) => t.entrada).filter(Boolean) as string[];
    const inicio = rdo.horarioInicio || (entradas.length ? entradas.sort()[0] : agora());
    await fetch(`/api/rdo/${rdo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ horarioInicio: inicio, horarioTermino: agora() }) });
    setFlash("✅ RDO do dia salvo no histórico!");
    setTimeout(() => setFlash(""), 4000);
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
              <div className="flex gap-2">
                <button type="button" disabled={busy || (!sel && !avulso.trim())} onClick={registrarEntrada} className="btn-primary flex-1 py-2.5 text-base disabled:opacity-50 sm:text-sm">Entrada agora ({agora()})</button>
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
                    <span className="text-xs text-neutral-500">{t.entrada}–{t.saida} · {horas(t.entrada, t.saida)}h</span>
                    <button type="button" onClick={() => patchTrab(t.id, { saida: null })} className="text-xs text-brand" title="Reabrir">↩</button>
                    <button type="button" onClick={() => removerTrab(t.id)} className="text-xs text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- resto do RDO (preenche durante/depois) ---- */}
          <div className="mt-4 border-t border-brand/20 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Relatório do dia</p>

            {/* Atividades */}
            <p className="mb-1 text-xs font-medium text-neutral-500">Atividades realizadas</p>
            <div className="mb-2 flex flex-col gap-1">
              {(rdo.atividades ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                  <span>{a.situacao === "FINALIZADA" ? "✅" : "🔶"}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{a.descricao}</span>
                  <button type="button" onClick={() => delAtividade(a.id)} className="text-xs text-red-500">✕</button>
                </div>
              ))}
            </div>
            <div className="mb-3 flex gap-2">
              <input value={novaAtiv} onChange={(e) => setNovaAtiv(e.target.value)} placeholder="O que foi feito…" className={inp} />
              <button type="button" onClick={() => setAtivFin((v) => !v)} className={`shrink-0 rounded-lg border px-2 text-xs ${ativFin ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-ink-300 text-neutral-500"}`} title="Finalizada?">{ativFin ? "✅ Fim" : "🔶 Parc"}</button>
              <button type="button" onClick={addAtividade} className="shrink-0 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white">+</button>
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

            {/* Gerar / fechar RDO */}
            {flash && <p className="mb-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">{flash}</p>}
            <button type="button" onClick={gerarRDO} className="btn-primary w-full py-3 text-base">
              {rdo.horarioTermino ? "Atualizar RDO do dia" : "Gerar RDO do dia"}
            </button>
            <p className="mt-2 text-[11px] text-neutral-500">Cada "Finalizar" já lança a diária da pessoa. O RDO do dia salva sozinho conforme você preenche — o botão acima registra a hora de término e deixa ele fechado no histórico.</p>
          </div>
        </>
      )}
    </div>
  );
}
