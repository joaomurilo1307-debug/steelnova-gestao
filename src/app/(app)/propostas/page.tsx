"use client";

import { Fragment, useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { formatBRL, periodoContratoLabel } from "@/lib/format";

type Proposta = {
  id: string;
  cliente: string;
  contato: string | null;
  segmento: string | null;
  escopo: string;
  valor: string | null;
  custoEstimado: string | null;
  status: string;
  dataEnvio: string | null;
  validade: string | null;
  observacoes: string | null;
  motivoPerda: string | null;
  responsavel: { id: string; name: string } | null;
  obraId: string | null;
  obra: { id: string; nome: string; status: string; dataInicio: string; prazoPrevistoDias: number } | null;
  dataInicioPrevista: string | null;
  prazoDiasContrato: number | null;
  arquivos: { id: string; nome: string; tamanho: number }[];
};


type Obra = { id: string; nome: string };
type Material = { id: string; nome: string; quantidadePrevista: string; quantidadeRecebida: string; unidade: string; fornecedor: string | null };

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

function AquisicoesResumo({ obraId }: { obraId: string }) {
  const [materiais, setMateriais] = useState<Material[] | null>(null);

  useEffect(() => {
    fetch(`/api/materiais?obraId=${obraId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMateriais);
  }, [obraId]);

  if (!materiais) return <p className="text-xs text-neutral-500">Carregando aquisições...</p>;
  const pendentes = materiais.filter((m) => Number(m.quantidadePrevista) - Number(m.quantidadeRecebida) > 0.001);

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-500">Compras e aquisições da obra ({materiais.length} itens, {pendentes.length} pendentes)</p>
      {pendentes.length === 0 ? (
        <p className="text-xs text-emerald-600">Tudo recebido.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {pendentes.slice(0, 6).map((m) => (
            <li key={m.id} className="text-xs text-fg-muted">
              {m.nome} — falta {(Number(m.quantidadePrevista) - Number(m.quantidadeRecebida)).toLocaleString("pt-BR")} {m.unidade}
              {m.fornecedor && ` (${m.fornecedor})`}
            </li>
          ))}
          {pendentes.length > 6 && <li className="text-xs text-neutral-500">+ {pendentes.length - 6} outros...</li>}
        </ul>
      )}
    </div>
  );
}

function PropostaDetalhe({ p, obras, onChanged }: { p: Proposta; obras: Obra[]; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function patch(body: any) {
    await fetch(`/api/propostas/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onChanged();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/propostas/${p.id}/arquivos`, { method: "POST", body: fd });
    setUploading(false);
    onChanged();
  }

  async function handleDeleteArquivo(arquivoId: string) {
    await fetch(`/api/propostas/arquivos/${arquivoId}`, { method: "DELETE" });
    onChanged();
  }

  const inputCls = "w-full pill-field px-2 py-1.5 text-sm";

  return (
    <tr className="border-t border-ink-800/60 bg-ink-800/30">
      <td colSpan={8} className="px-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Custo estimado (R$)</label>
            <input
              type="number"
              step="0.01"
              defaultValue={p.custoEstimado ?? ""}
              onBlur={(e) => patch({ custoEstimado: e.target.value ? Number(e.target.value) : null })}
              className={inputCls}
            />
            {p.valor && p.custoEstimado && (
              <p className="mt-1 text-xs text-neutral-500">
                Margem: {formatBRL(Number(p.valor) - Number(p.custoEstimado))} (
                {(((Number(p.valor) - Number(p.custoEstimado)) / Number(p.valor)) * 100).toFixed(1)}%)
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Referência a projeto/obra</label>
            <select defaultValue={p.obraId ?? ""} onChange={(e) => patch({ obraId: e.target.value || null })} className={inputCls}>
              <option value="">Nenhuma (proposta autônoma)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Motivo de perda (se recusada)</label>
            <input defaultValue={p.motivoPerda ?? ""} onBlur={(e) => patch({ motivoPerda: e.target.value || null })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Início previsto (estimativa)</label>
            <input
              type="date"
              defaultValue={p.dataInicioPrevista?.slice(0, 10) ?? ""}
              onBlur={(e) => patch({ dataInicioPrevista: e.target.value || null })}
              disabled={!!p.obraId}
              className={`${inputCls} disabled:opacity-50`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Prazo do contrato (dias)</label>
            <input
              type="number"
              defaultValue={p.prazoDiasContrato ?? ""}
              onBlur={(e) => patch({ prazoDiasContrato: e.target.value ? Number(e.target.value) : null })}
              disabled={!!p.obraId}
              className={`${inputCls} disabled:opacity-50`}
            />
            {p.obraId && <p className="mt-1 text-[11px] text-neutral-500">Convertida em obra — período real vem do Planejamento.</p>}
          </div>
        </div>

        {p.obraId && (
          <div className="mt-4 rounded-lg border border-ink-800 bg-ink-900 p-3">
            <AquisicoesResumo obraId={p.obraId} />
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-500">Arquivos anexados (planilhas, propostas, orçamentos)</p>
            <label className="cursor-pointer text-xs text-brand hover:underline">
              {uploading ? "Enviando..." : "+ Anexar arquivo"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {p.arquivos.length === 0 ? (
            <p className="text-xs text-neutral-500">Nenhum arquivo anexado.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {p.arquivos.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-xs">
                  <a href={`/api/propostas/arquivos/${a.id}`} className="text-fg hover:underline">
                    {a.nome} <span className="text-neutral-500">({(a.tamanho / 1024).toFixed(0)} KB)</span>
                  </a>
                  <button onClick={() => handleDeleteArquivo(a.id)} className="text-red-600 hover:underline">
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PropostasPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    cliente: "",
    contato: "",
    segmento: "",
    escopo: "",
    valor: "",
    validade: "",
    observacoes: "",
    dataInicioPrevista: "",
    prazoDiasContrato: "",
  });

  async function load() {
    const [pRes, oRes] = await Promise.all([fetch("/api/propostas"), fetch("/api/obras")]);
    if (pRes.ok) setPropostas(await pRes.json());
    if (oRes.ok) setObras(await oRes.json());
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
        dataInicioPrevista: form.dataInicioPrevista || undefined,
        prazoDiasContrato: form.prazoDiasContrato ? Number(form.prazoDiasContrato) : undefined,
      }),
    });
    if (res.ok) {
      setForm({ cliente: "", contato: "", segmento: "", escopo: "", valor: "", validade: "", observacoes: "", dataInicioPrevista: "", prazoDiasContrato: "" });
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

      <div className="p-8">
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs uppercase text-neutral-500">Propostas</p>
            <p className="mt-1 text-lg font-semibold text-fg">{propostas.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase text-neutral-500">Em aberto</p>
            <p className="mt-1 text-lg font-semibold text-fg">{emAberto}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase text-neutral-500">Valor no funil</p>
            <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(valorTotal)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase text-neutral-500">Aprovado</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600">{formatBRL(valorAprovado)}</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="mb-4 btn-primary px-4 py-2 text-sm"
        >
          {showForm ? "Fechar formulário" : "+ Nova proposta"}
        </button>

        {showForm && (
          <form onSubmit={handleAdd} className="mb-6 grid grid-cols-2 gap-2 card p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Cliente</label>
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Contato</label>
              <input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} placeholder="nome / telefone" className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Segmento</label>
              <input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} placeholder="industrial, agro..." className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-neutral-500">Escopo</label>
              <input value={form.escopo} onChange={(e) => setForm({ ...form, escopo: e.target.value })} placeholder="estrutura metálica, galpão, reforma..." className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
              <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Validade</label>
              <input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Início previsto (estimativa)</label>
              <input
                type="date"
                value={form.dataInicioPrevista}
                onChange={(e) => setForm({ ...form, dataInicioPrevista: e.target.value })}
                className="w-full pill-field px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Prazo do contrato (dias)</label>
              <input
                type="number"
                value={form.prazoDiasContrato}
                onChange={(e) => setForm({ ...form, prazoDiasContrato: e.target.value })}
                className="w-full pill-field px-2 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-neutral-500">Observações</label>
              <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="w-full pill-field px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" className="col-span-1 self-end btn-primary px-4 py-2 text-sm">
              Criar
            </button>
          </form>
        )}

        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-600">
              <tr>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Cliente</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Escopo</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Obra vinculada</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Valor</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label" title="Real (Planejamento) se já virou obra, senão a estimativa lançada">Período do contrato</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Validade</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Status</th>
                <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label"></th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-ink-800">
                    <td className="px-4 py-3 text-fg">
                      <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="text-left hover:underline">
                        {expandedId === p.id ? "▾ " : "▸ "}
                        {p.cliente}
                      </button>
                      {p.contato && <p className="pl-3 text-xs text-neutral-500">{p.contato}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{p.escopo}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.obra?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-fg">{p.valor ? formatBRL(Number(p.valor)) : "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{periodoContratoLabel(p)}</td>
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
                  {expandedId === p.id && <PropostaDetalhe p={p} obras={obras} onChanged={load} />}
                </Fragment>
              ))}
              {propostas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500">
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
