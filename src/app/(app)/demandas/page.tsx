"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { useSession } from "next-auth/react";

type Obra = { id: string; nome: string };
type Demanda = {
  id: string;
  obraId: string;
  categoria: string;
  descricao: string;
  quantidade: string | null;
  unidade: string | null;
  solicitante: string;
  urgencia: "BAIXA" | "MEDIA" | "ALTA";
  status: "SOLICITADA" | "APROVADA" | "COMPRADA" | "ENTREGUE" | "RECUSADA";
  observacao: string | null;
  createdAt: string;
  obra: { id: string; nome: string };
};

const CATEGORIAS = ["Material", "Ferramenta", "EPI", "Serviço", "Outro"];
const URG = [
  { v: "BAIXA", label: "Baixa" },
  { v: "MEDIA", label: "Média" },
  { v: "ALTA", label: "Alta" },
] as const;
const URG_CLS: Record<string, string> = {
  BAIXA: "bg-neutral-100 text-neutral-600 border-neutral-300",
  MEDIA: "bg-amber-100 text-amber-800 border-amber-300",
  ALTA: "bg-red-100 text-red-700 border-red-300",
};
const STATUS: Record<string, { label: string; cls: string }> = {
  SOLICITADA: { label: "Solicitada", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  APROVADA: { label: "Aprovada", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  COMPRADA: { label: "Comprada", cls: "bg-teal-100 text-teal-800 border-teal-300" },
  ENTREGUE: { label: "Entregue", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  RECUSADA: { label: "Recusada", cls: "bg-rose-100 text-rose-800 border-rose-300" },
};
const STATUS_KEYS = Object.keys(STATUS);

export default function DemandasPage() {
  const { data: session } = useSession();
  const readOnly = session?.user && (session.user as any).role === "VISUALIZADOR";

  const [obras, setObras] = useState<Obra[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [filtro, setFiltro] = useState<string>("ABERTAS");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    obraId: "",
    categoria: "Material",
    descricao: "",
    quantidade: "",
    unidade: "",
    urgencia: "MEDIA" as "BAIXA" | "MEDIA" | "ALTA",
    solicitante: "",
    observacao: "",
  });

  async function load() {
    const [o, d] = await Promise.all([fetch("/api/obras"), fetch("/api/demandas")]);
    if (o.ok) {
      const obs = await o.json();
      setObras(obs.map((x: any) => ({ id: x.id, nome: x.nome })));
    }
    if (d.ok) setDemandas(await d.json());
  }
  useEffect(() => {
    load();
    const nome = (session?.user?.name as string) || "";
    setForm((f) => (f.solicitante ? f : { ...f, solicitante: nome }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.name]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.obraId || !form.descricao.trim() || !form.solicitante.trim()) return;
    setSaving(true);
    const res = await fetch("/api/demandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId: form.obraId,
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        quantidade: form.quantidade ? Number(form.quantidade) : undefined,
        unidade: form.unidade || undefined,
        urgencia: form.urgencia,
        solicitante: form.solicitante.trim(),
        observacao: form.observacao || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm((f) => ({ ...f, categoria: "Material", descricao: "", quantidade: "", unidade: "", urgencia: "MEDIA", observacao: "" }));
      load();
    }
  }

  async function mudarStatus(id: string, status: string) {
    setDemandas((prev) => prev.map((d) => (d.id === id ? { ...d, status: status as Demanda["status"] } : d)));
    await fetch(`/api/demandas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta demanda?")) return;
    const res = await fetch(`/api/demandas/${id}`, { method: "DELETE" });
    if (res.ok) setDemandas((prev) => prev.filter((d) => d.id !== id));
  }

  const abertas = demandas.filter((d) => d.status !== "ENTREGUE" && d.status !== "RECUSADA");
  const lista = filtro === "ABERTAS" ? abertas : filtro === "TODAS" ? demandas : demandas.filter((d) => d.status === filtro);
  const input = "w-full pill-field px-3 py-2.5 text-base sm:py-2 sm:text-sm";
  const label = "mb-1 block text-xs font-medium text-neutral-500";

  return (
    <div>
      <TopBar title="Demandas" subtitle="Solicitações de compra da equipe de campo" />
      <div className="p-4 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* ---- Formulário: pedir compra ---- */}
          <form onSubmit={enviar} className="card h-fit p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-fg">Nova solicitação</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className={label}>Obra *</label>
                <select required value={form.obraId} onChange={(e) => setForm({ ...form, obraId: e.target.value })} className={input}>
                  <option value="">Selecione a obra…</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Categoria</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIAS.map((c) => (
                    <button type="button" key={c} onClick={() => setForm({ ...form, categoria: c })}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${form.categoria === c ? "border-brand bg-brand/10 font-medium text-brand" : "border-ink-700 text-fg-muted"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label}>O que precisa? *</label>
                <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: eletrodo 6013, disco de corte 4½…" className={input} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Quantidade</label>
                  <input type="number" step="any" inputMode="decimal" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} className={input} />
                </div>
                <div>
                  <label className={label}>Unidade</label>
                  <input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="un, kg, cx, m…" className={input} />
                </div>
              </div>
              <div>
                <label className={label}>Urgência</label>
                <div className="flex gap-1.5">
                  {URG.map((u) => (
                    <button type="button" key={u.v} onClick={() => setForm({ ...form, urgencia: u.v })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${form.urgencia === u.v ? URG_CLS[u.v] + " font-semibold" : "border-ink-700 text-fg-muted"}`}>
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label}>Quem está pedindo? *</label>
                <input required value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} placeholder="Seu nome" className={input} />
              </div>
              <div>
                <label className={label}>Observação (opcional)</label>
                <textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className={input} />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-base disabled:opacity-50 sm:py-2 sm:text-sm">
                {saving ? "Enviando…" : "Enviar solicitação"}
              </button>
            </div>
          </form>

          {/* ---- Lista de demandas ---- */}
          <div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[["ABERTAS", `Abertas (${abertas.length})`], ["TODAS", "Todas"], ...STATUS_KEYS.map((s) => [s, STATUS[s].label])].map(([v, l]) => (
                <button key={v} onClick={() => setFiltro(v)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${filtro === v ? "border-brand bg-brand/10 text-brand" : "border-ink-700 text-neutral-500"}`}>
                  {l}
                </button>
              ))}
            </div>

            {lista.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">Nenhuma demanda aqui.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {lista.map((d) => (
                  <div key={d.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS[d.status].cls}`}>{STATUS[d.status].label}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${URG_CLS[d.urgencia]}`}>{d.urgencia === "ALTA" ? "🔴 Urgente" : d.urgencia === "MEDIA" ? "Média" : "Baixa"}</span>
                          <span className="text-[11px] text-neutral-500">{d.categoria}</span>
                        </div>
                        <p className="mt-1.5 font-medium text-fg">{d.descricao}</p>
                        <p className="text-xs text-neutral-500">
                          {d.quantidade ? `${Number(d.quantidade)} ${d.unidade ?? ""} · ` : ""}{d.obra?.nome} · por {d.solicitante} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                        {d.observacao && <p className="mt-1 text-xs text-fg-muted">{d.observacao}</p>}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1.5">
                          <select value={d.status} onChange={(e) => mudarStatus(d.id, e.target.value)} className="pill-field px-2 py-1.5 text-xs">
                            {STATUS_KEYS.map((s) => (
                              <option key={s} value={s}>{STATUS[s].label}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => excluir(d.id)} className="px-1.5 text-xs text-red-600" title="Excluir">✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
