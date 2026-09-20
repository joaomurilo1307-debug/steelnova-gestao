"use client";

import { useEffect, useState } from "react";

type Funcionario = { id: string; nome: string; cargo: string | null };
type Trab = { id: string; nome: string; funcao: string; entrada: string | null; saida: string | null; funcionarioId: string | null };
type Rdo = { id: string; data: string; clima: string; trabalhadores: Trab[] };

const CLIMA = [
  { v: "SOL", label: "☀️ Sol" },
  { v: "NUBLADO", label: "☁️ Nublado" },
  { v: "CHUVA", label: "🌧️ Chuva" },
  { v: "TEMPO_RUIM", label: "⛈️ Ruim" },
];

function agora() {
  return new Date().toTimeString().slice(0, 5); // HH:MM local
}
function horas(e: string | null, s: string | null) {
  if (!e || !s) return null;
  const [eh, em] = e.split(":").map(Number);
  const [sh, sm] = s.split(":").map(Number);
  let m = sh * 60 + sm - (eh * 60 + em);
  if (m < 0) m += 1440;
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

  async function carregar() {
    const [r, f] = await Promise.all([
      fetch(`/api/rdo/hoje?obraId=${obraId}&data=${dataISO}`),
      fetch("/api/funcionarios"),
    ]);
    if (r.ok) setRdo(await r.json());
    if (f.ok) setFuncs(await f.json());
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function abrirDia(clima = "SOL") {
    setBusy(true);
    const r = await fetch("/api/rdo/hoje", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, data: dataISO, clima }),
    });
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
    const r = await fetch(`/api/rdo/${rdo.id}/trabalhador`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funcionarioId: f?.id, nome, funcao: f?.cargo || "—", entrada: agora() }),
    });
    setBusy(false);
    if (r.ok) {
      setSel(""); setAvulso(""); setAberto(false);
      carregar();
    }
  }

  async function patch(tid: string, body: any) {
    await fetch(`/api/rdo/trabalhador/${tid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    carregar();
  }
  async function remover(tid: string) {
    if (!confirm("Remover esta pessoa do ponto de hoje?")) return;
    await fetch(`/api/rdo/trabalhador/${tid}`, { method: "DELETE" });
    carregar();
  }

  const dataLabel = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const trab = rdo?.trabalhadores ?? [];
  const ativos = trab.filter((t) => !t.saida);
  const prontos = trab.filter((t) => t.saida);
  // funcionários que ainda não bateram entrada hoje
  const jaTem = new Set(trab.map((t) => t.funcionarioId).filter(Boolean));
  const disp = funcs.filter((f) => !jaTem.has(f.id));

  return (
    <div className="mb-6 rounded-2xl border border-brand/30 bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-fg">Ponto de hoje</h2>
          <p className="text-xs capitalize text-neutral-500">{dataLabel}</p>
        </div>
        {rdo && (
          <div className="flex flex-wrap gap-1">
            {CLIMA.map((c) => (
              <button key={c.v} type="button" onClick={() => setClima(c.v)}
                className={`rounded-lg border px-2 py-1 text-xs ${rdo.clima === c.v ? "border-brand bg-brand/10 font-medium text-brand" : "border-ink-700 bg-white/60 text-fg-muted"}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!rdo ? (
        <button type="button" disabled={busy} onClick={() => abrirDia()} className="btn-primary w-full py-3 text-base disabled:opacity-50">
          {busy ? "Abrindo…" : "▶ Abrir o dia"}
        </button>
      ) : (
        <>
          {/* Trabalhando agora */}
          {ativos.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {ativos.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white p-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{t.nome}</p>
                    <p className="text-xs text-neutral-500">{t.funcao}</p>
                  </div>
                  <input type="time" value={t.entrada ?? ""} onChange={(e) => patch(t.id, { entrada: e.target.value })}
                    className="w-[92px] rounded-lg border border-ink-300 px-2 py-1.5 text-sm" title="Entrada" />
                  <button type="button" onClick={() => patch(t.id, { saida: agora() })}
                    className="shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white">Finalizar</button>
                  <button type="button" onClick={() => remover(t.id)} className="shrink-0 px-1 text-xs text-red-500">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar pessoa / registrar entrada */}
          {!aberto ? (
            <button type="button" onClick={() => setAberto(true)} className="w-full rounded-xl border border-dashed border-brand/50 py-2.5 text-sm font-medium text-brand">
              + Registrar entrada
            </button>
          ) : (
            <div className="rounded-xl border border-ink-200 bg-white p-3">
              <select value={sel} onChange={(e) => { setSel(e.target.value); setAvulso(""); }} className="mb-2 w-full pill-field px-3 py-2.5 text-base sm:text-sm">
                <option value="">Selecionar da equipe…</option>
                {disp.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` — ${f.cargo}` : ""}</option>
                ))}
              </select>
              {!sel && (
                <input value={avulso} onChange={(e) => setAvulso(e.target.value)} placeholder="ou nome avulso" className="mb-2 w-full pill-field px-3 py-2.5 text-base sm:text-sm" />
              )}
              <div className="flex gap-2">
                <button type="button" disabled={busy || (!sel && !avulso.trim())} onClick={registrarEntrada}
                  className="btn-primary flex-1 py-2.5 text-base disabled:opacity-50 sm:text-sm">Entrada agora ({agora()})</button>
                <button type="button" onClick={() => { setAberto(false); setSel(""); setAvulso(""); }} className="rounded-lg border border-ink-300 px-3 text-sm text-fg-muted">Cancelar</button>
              </div>
            </div>
          )}

          {/* Já finalizados hoje */}
          {prontos.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-neutral-500">Finalizados ({prontos.length})</p>
              <div className="flex flex-col gap-1">
                {prontos.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-fg">{t.nome}</span>
                    <span className="text-xs text-neutral-500">{t.entrada}–{t.saida} · {horas(t.entrada, t.saida)}h</span>
                    <button type="button" onClick={() => patch(t.id, { saida: null })} className="text-xs text-brand" title="Reabrir">↩</button>
                    <button type="button" onClick={() => remover(t.id)} className="text-xs text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-neutral-500">Cada "Finalizar" já lança a diária da pessoa (vai pra aba Diárias/Custos). Não precisa preencher nada no fim do dia.</p>
        </>
      )}
    </div>
  );
}
