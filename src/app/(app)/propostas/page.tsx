"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { formatBRL } from "@/lib/format";

type Proposta = {
  id: string;
  cliente: string;
  contato: string | null;
  segmento: string | null;
  escopo: string;
  valor: string | null;
  status: string;
  dataEnvio: string | null;
  validade: string | null;
  observacoes: string | null;
  motivoPerda: string | null;
  responsavel: { id: string; name: string } | null;
};

const STATUS_OPTIONS = ["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO", "APROVADA", "RECUSADA", "CONVERTIDA"];

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  EM_NEGOCIACAO: "Em negociação",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  CONVERTIDA: "Convertida em obra",
};

const STATUS_BADGE: Record<string, string> = {
  RASCUNHO: "bg-neutral-200 text-neutral-700",
  ENVIADA: "bg-sky-100 text-sky-700",
  EM_NEGOCIACAO: "bg-amber-100 text-amber-700",
  APROVADA: "bg-emerald-100 text-emerald-700",
  RECUSADA: "bg-rose-100 text-rose-700",
  CONVERTIDA: "bg-violet-100 text-violet-700",
};

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cliente: "",
    contato: "",
    segmento: "",
    escopo: "",
    valor: "",
    validade: "",
    observacoes: "",
  });

  async function load() {
    const res = await fetch("/api/propostas");
    if (res.ok) setPropostas(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim() || !form.escopo.trim()) return;
    const res = await fetch("/api/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente: form.cliente,
        contato: form.contato || undefined,
        segmento: form.segmento || undefined,
        escopo: form.escopo,
        valor: form.valor ? Number(form.valor) : undefined,
        validade: form.validade || undefined,
        observacoes: form.observacoes || undefined,
      }),
    });
    if (res.ok) {
      setForm({ cliente: "", contato: "", segmento: "", escopo: "", valor: "", validade: "", observacoes: "" });
      setShowForm(false);
      load();
    }
  }

  async function handleStatus(id: string, status: string) {
    await fetch(`/api/propostas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta proposta?")) return;
    const res = await fetch(`/api/propostas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const valorTotal = propostas
    .filter((p) => p.status !== "RECUSADA")
    .reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const valorAprovado = propostas.filter((p) => p.status === "APROVADA" || p.status === "CONVERTIDA").reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const emAberto = propostas.filter((p) => !["APROVADA", "RECUSADA", "CONVERTIDA"].includes(p.status)).length;

  return (
    <div>
      <TopBar title="Propostas" subtitle="Funil comercial — captação, orçamento e fechamento" />

      <div className="p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">Propostas</p>
            <p className="mt-1 text-lg font-semibold text-fg">{propostas.length}</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">Em aberto</p>
            <p className="mt-1 text-lg font-semibold text-fg">{emAberto}</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">Valor no funil</p>
            <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(valorTotal)}</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">Aprovado</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">{formatBRL(valorAprovado)}</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="mb-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {showForm ? "Fechar formulário" : "+ Nova proposta"}
        </button>

        {showForm && (
          <form onSubmit={handleAdd} className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-ink-800 bg-ink-900 p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Cliente</label>
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Contato</label>
              <input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="nome / telefone" className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Segmento</label>
              <input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} placeholder="industrial, agro..." className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-neutral-500">Escopo</label>
              <input value={form.escopo} onChange={(e) => setForm({ ...form, escopo: e.target.value })} placeholder="estrutura metálica, galpão, reforma..." className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
              <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Validade</label>
              <input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-neutral-500">Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
            </div>
            <button type="submit" className="col-span-1 self-end rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Criar
            </button>
          </form>
        )}

        <div className="max-h-[72vh] overflow-auto rounded-xl border border-ink-800 bg-ink-900">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-600">
              <tr>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Cliente</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Escopo</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Segmento</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Valor</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Validade</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Status</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id} className="border-t border-ink-800">
                  <td className="px-4 py-3 text-fg">
                    {p.cliente}
                    {p.contato && <p className="text-xs text-neutral-500">{p.contato}</p>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{p.escopo}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.segmento ?? "—"}</td>
                  <td className="px-4 py-3 text-fg">{p.valor ? formatBRL(Number(p.valor)) : "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {p.validade ? new Date(p.validade).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.status}
                      onChange={(e) => handleStatus(p.id, e.target.value)}
                      className={`rounded-full border-0 px-2 py-1 text-xs font-medium outline-none ${STATUS_BADGE[p.status] ?? ""}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {propostas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                    Nenhuma proposta cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
