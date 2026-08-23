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
};

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
        grupo: form.grupo || undefined,
        nome: form.nome,
        unidade: form.unidade,
        quantidadePrevista: Number(form.quantidadePrevista),
        fornecedor: form.fornecedor || undefined,
        pesoUnitario: form.pesoUnitario ? Number(form.pesoUnitario) : undefined,
      }),
    });
    if (res.ok) {
      setForm({ grupo: "", nome: "", unidade: "", quantidadePrevista: "", fornecedor: "", pesoUnitario: "" });
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

  return (
    <div className="p-6">
      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Grupo</label>
          <input
            placeholder="Galpão 1, Tesouras..."
            value={form.grupo}
            onChange={(e) => setForm({ ...form, grupo: e.target.value })}
            className="w-36 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Material</label>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-48 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Unidade</label>
          <input
            placeholder="kg, m², un..."
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value })}
            className="w-24 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Qtd. prevista</label>
          <input
            type="number"
            step="0.01"
            value={form.quantidadePrevista}
            onChange={(e) => setForm({ ...form, quantidadePrevista: e.target.value })}
            className="w-28 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Fornecedor</label>
          <input
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            className="w-40 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Peso un. (kg)</label>
          <input
            type="number"
            step="0.01"
            value={form.pesoUnitario}
            onChange={(e) => setForm({ ...form, pesoUnitario: e.target.value })}
            className="w-24 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Adicionar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Grupo</th>
              <th className="px-4 py-3 font-medium">Material</th>
              <th className="px-4 py-3 font-medium">Fornecedor</th>
              <th className="px-4 py-3 font-medium">Previsto</th>
              <th className="px-4 py-3 font-medium">Recebido</th>
              <th className="px-4 py-3 font-medium">Peso total</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {materiais.map((m) => (
              <tr key={m.id} className="border-t border-ink-800">
                <td className="px-4 py-3 text-neutral-600">{m.grupo ?? "—"}</td>
                <td className="px-4 py-3 text-fg">{m.nome}</td>
                <td className="px-4 py-3 text-neutral-600">{m.fornecedor ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {Number(m.quantidadePrevista)} {m.unidade}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {Number(m.quantidadeRecebida)} {m.unidade}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {m.pesoUnitario ? `${(Number(m.pesoUnitario) * Number(m.quantidadePrevista)).toFixed(1)} kg` : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleReceber(m.id, m.quantidadeRecebida)}
                    className="text-xs text-brand hover:underline"
                  >
                    Registrar recebimento
                  </button>
                </td>
              </tr>
            ))}
            {materiais.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  Nenhum material cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
