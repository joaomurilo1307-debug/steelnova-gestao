"use client";

import { useEffect, useState } from "react";

type Material = {
  id: string;
  grupo: string | null;
  nome: string;
  unidade: string;
  quantidadePrevista: string;
  quantidadeRecebida: string;
  fornecedor: string | null;
  pesoUnitario: string | null;
  fornecidoPeloCliente: boolean;
};

// Tipos de componente da estrutura metálica — para separar o material
const COMPONENTES = [
  "Tesouras",
  "Terças",
  "Contraventamentos",
  "Tirantes",
  "Chapas / Ligações",
  "Cobertura / Telha",
  "Calhas e Rufos",
  "Pingadeira",
  "Insumos",
  "Outros",
];

export default function MateriaisObra({ obraId }: { obraId: string }) {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [form, setForm] = useState({ grupo: "", nome: "", unidade: "", quantidadePrevista: "", fornecedor: "", pesoUnitario: "" });

  async function load() {
    const res = await fetch(`/api/materiais?obraId=${obraId}`);
    if (res.ok) setMateriais(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.unidade.trim() || !form.quantidadePrevista) return;
    const res = await fetch("/api/materiais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        grupo: form.grupo || "Outros",
        nome: form.nome,
        unidade: form.unidade,
        quantidadePrevista: Number(form.quantidadePrevista),
        fornecedor: form.fornecedor || undefined,
        pesoUnitario: form.pesoUnitario ? Number(form.pesoUnitario) : undefined,
      }),
    });
    if (res.ok) {
      setForm({ grupo: form.grupo, nome: "", unidade: "", quantidadePrevista: "", fornecedor: "", pesoUnitario: "" });
      load();
    }
  }

  async function handleReceber(id: string, atual: string) {
    const valor = prompt("Quantidade recebida agora:", "0");
    if (!valor) return;
    const nova = Number(atual) + Number(valor);
    const res = await fetch(`/api/materiais/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantidadeRecebida: nova }),
    });
    if (res.ok) load();
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este material?")) return;
    const res = await fetch(`/api/materiais/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function handleFornecidoPeloCliente(id: string, valor: boolean) {
    const res = await fetch(`/api/materiais/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fornecidoPeloCliente: valor }),
    });
    if (res.ok) load();
  }

  const pesoDe = (m: Material) => (m.pesoUnitario ? Number(m.pesoUnitario) * Number(m.quantidadePrevista) : 0);

  // Agrupa por tipo de componente (grupo), na ordem de COMPONENTES + extras
  const gruposPresentes = Array.from(new Set(materiais.map((m) => m.grupo || "Outros")));
  const ordem = [...COMPONENTES, ...gruposPresentes.filter((g) => !COMPONENTES.includes(g))];
  const grupos = ordem.filter((g) => gruposPresentes.includes(g));
  const pesoTotal = materiais.reduce((s, m) => s + pesoDe(m), 0);
  const saldoDe = (m: Material) => Number(m.quantidadePrevista) - Number(m.quantidadeRecebida);
  // "Compras necessárias" é só o que a SteelNova precisa comprar — material fornecido
  // pelo cliente (ex.: HNSD) não entra, mesmo com saldo pendente de recebimento.
  const pendentes = materiais.filter((m) => saldoDe(m) > 0.001 && !m.fornecidoPeloCliente);
  const fornecidosPeloCliente = materiais.filter((m) => m.fornecidoPeloCliente);

  return (
    <div className="p-8">
      <form onSubmit={handleAdd} className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Componente</label>
          <select
            value={form.grupo}
            onChange={(e) => setForm({ ...form, grupo: e.target.value })}
            className="w-44 pill-field px-3 py-2 text-sm"
          >
            <option value="">— tipo —</option>
            {COMPONENTES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Material</label>
          <input
            placeholder="Perfil UDC 127x50..."
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-52 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Unidade</label>
          <input
            placeholder="kg, m², un..."
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value })}
            className="w-24 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Qtd. prevista</label>
          <input
            type="number"
            step="0.01"
            value={form.quantidadePrevista}
            onChange={(e) => setForm({ ...form, quantidadePrevista: e.target.value })}
            className="w-28 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Fornecedor</label>
          <input
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            className="w-40 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Peso un. (kg)</label>
          <input
            type="number"
            step="0.001"
            value={form.pesoUnitario}
            onChange={(e) => setForm({ ...form, pesoUnitario: e.target.value })}
            className="w-24 pill-field px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Adicionar
        </button>
      </form>

      {materiais.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="card px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Componentes</div>
            <div className="text-xl font-bold text-fg">{grupos.length}</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Itens</div>
            <div className="text-xl font-bold text-fg">{materiais.length}</div>
          </div>
          <div className="card px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Peso total</div>
            <div className="text-xl font-bold text-brand">{pesoTotal.toFixed(1)} kg</div>
          </div>
        </div>
      )}

      {materiais.length > 0 && (
        pendentes.length > 0 ? (
          <div className="mb-5 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
            <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-2.5">
              <span className="text-lg">🛒</span>
              <b className="text-sm text-amber-900">Compras necessárias</b>
              <span className="text-xs text-amber-700">· {pendentes.length} {pendentes.length === 1 ? "item a comprar" : "itens a comprar"}</span>
              {fornecidosPeloCliente.length > 0 && (
                <span className="text-xs text-amber-700/70">
                  · {fornecidosPeloCliente.length} fornecido{fornecidosPeloCliente.length > 1 ? "s" : ""} pelo cliente (não conta aqui)
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-amber-800/70">
                  <tr>
                    <th className="sticky top-0 z-10 bg-amber-50 px-4 py-2 font-medium">Componente</th>
                    <th className="sticky top-0 z-10 bg-amber-50 px-4 py-2 font-medium">Material</th>
                    <th className="sticky top-0 z-10 bg-amber-50 px-4 py-2 font-medium">Fornecedor</th>
                    <th className="sticky top-0 z-10 bg-amber-50 px-4 py-2 text-right font-medium">Falta comprar</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((m) => (
                    <tr key={m.id} className="border-t border-amber-100">
                      <td className="px-4 py-2 text-neutral-600">{m.grupo || "Outros"}</td>
                      <td className="px-4 py-2 font-medium text-fg">{m.nome}</td>
                      <td className="px-4 py-2 text-neutral-600">{m.fornecedor ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-semibold text-amber-700">{saldoDe(m).toLocaleString("pt-BR")} {m.unidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            <span className="text-lg">✅</span>
            <b>Tudo recebido</b> — nenhuma compra pendente nesta obra.
          </div>
        )
      )}

      {grupos.length === 0 && (
        <div className="card px-4 py-10 text-center text-neutral-500">
          Nenhum material cadastrado ainda. Escolha o <b>componente</b> (tesouras, terças, chapas…) e adicione.
        </div>
      )}

      <div className="space-y-5">
        {grupos.map((grupo) => {
          const itens = materiais.filter((m) => (m.grupo || "Outros") === grupo);
          const pesoGrupo = itens.reduce((s, m) => s + pesoDe(m), 0);
          return (
            <div key={grupo} className="overflow-hidden card">
              <div className="flex items-center justify-between border-b border-ink-800 bg-ink-800 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                  <b className="text-sm text-fg">{grupo}</b>
                  <span className="text-xs text-neutral-500">· {itens.length} {itens.length === 1 ? "item" : "itens"}</span>
                </div>
                {pesoGrupo > 0 && <span className="text-sm font-semibold text-brand">{pesoGrupo.toFixed(1)} kg</span>}
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Material</th>
                    <th className="px-4 py-2 font-medium">Fornecedor</th>
                    <th className="px-4 py-2 font-medium">Previsto</th>
                    <th className="px-4 py-2 font-medium">Recebido</th>
                    <th className="px-4 py-2 font-medium">Peso total</th>
                    <th className="px-4 py-2 font-medium" title="Marca que o material é fornecido pelo cliente, não é compra da SteelNova">
                      Cliente fornece
                    </th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((m) => (
                    <tr key={m.id} className={`border-t border-ink-800 ${m.fornecidoPeloCliente ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2.5 text-fg">{m.nome}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{m.fornecedor ?? "—"}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{Number(m.quantidadePrevista)} {m.unidade}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{Number(m.quantidadeRecebida)} {m.unidade}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{m.pesoUnitario ? `${pesoDe(m).toFixed(1)} kg` : "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={m.fornecidoPeloCliente}
                          onChange={(e) => handleFornecidoPeloCliente(m.id, e.target.checked)}
                          title="Fornecido pelo cliente"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleReceber(m.id, m.quantidadeRecebida)} className="text-xs text-brand hover:underline">Receber</button>
                        <button onClick={() => handleExcluir(m.id)} className="ml-3 text-xs text-neutral-400 hover:text-red-500">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
