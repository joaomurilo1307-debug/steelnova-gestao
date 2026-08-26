"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Custo = {
  id: string;
  categoria: string;
  tipo: string; // "Direto" | "Indireto"
  descricao: string;
  valorPrevisto: string;
  valorRealizado: string | null;
  data: string;
};
type Funcionario = { id: string; nome: string; regime: string; diariaPadrao: string | null; valorFixo: string | null };
type Ponto = { id: string; entrada: string; saida: string; funcionario: Funcionario };
type Desembolso = { id: string; categoria: string; valor: string };
type Material = { id: string; nome: string; quantidadePrevista: string; custoUnitario: string | null; fornecidoPeloCliente: boolean };

const CATEGORIAS = ["Material", "Insumos", "Mão de obra", "Equipamento", "Terceiros", "Administrativo", "Imprevisto", "Outros"];
const TIPOS = ["Direto", "Indireto"];

function horasEntre(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  let mins = sh * 60 + sm - (eh * 60 + em);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export default function CustosObra({ obraId }: { obraId: string }) {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [desembolsos, setDesembolsos] = useState<Desembolso[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [horasPorDiaria, setHorasPorDiaria] = useState(8);
  const [diariaPadrao, setDiariaPadrao] = useState(150);
  const [form, setForm] = useState({
    categoria: CATEGORIAS[0],
    tipo: "Direto",
    descricao: "",
    valorPrevisto: "",
    valorRealizado: "",
    data: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const [cRes, pRes, dRes, mRes, paramRes] = await Promise.all([
      fetch(`/api/custos?obraId=${obraId}`),
      fetch(`/api/ponto?obraId=${obraId}`),
      fetch(`/api/desembolsos?obraId=${obraId}`),
      fetch(`/api/materiais?obraId=${obraId}`),
      fetch(`/api/obras/${obraId}/parametros-orcamento`),
    ]);
    if (cRes.ok) setCustos(await cRes.json());
    if (pRes.ok) setPontos(await pRes.json());
    if (dRes.ok) setDesembolsos(await dRes.json());
    if (mRes.ok) setMateriais(await mRes.json());
    if (paramRes.ok) {
      const p = await paramRes.json();
      setHorasPorDiaria(Number(p.horasPorDiaria));
      setDiariaPadrao(Number(p.diariaPadrao));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valorPrevisto) return;
    const res = await fetch("/api/custos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        categoria: form.categoria,
        tipo: form.tipo,
        descricao: form.descricao,
        valorPrevisto: Number(form.valorPrevisto),
        valorRealizado: form.valorRealizado ? Number(form.valorRealizado) : undefined,
        data: form.data,
      }),
    });
    if (res.ok) {
      setForm({ ...form, descricao: "", valorPrevisto: "", valorRealizado: "" });
      load();
    }
  }

  // ---- Consolidação: soma as outras abas + os lançamentos avulsos ----
  // Mão de obra (aba Diárias / ponto): horas × taxa horária, ou valor fixo.
  const maoDeObra = pontos.reduce((s, p) => {
    const h = horasEntre(p.entrada, p.saida);
    const taxa = p.funcionario.diariaPadrao ? Number(p.funcionario.diariaPadrao) : diariaPadrao;
    return s + h * (taxa / horasPorDiaria);
  }, 0);

  // Desembolsos de bolso (aba Diárias) — exceto adiantamento (adiantamento é acerto de mão de obra, não custo extra).
  const desembolsosDiretos = desembolsos
    .filter((d) => d.categoria !== "Adiantamento")
    .reduce((s, d) => s + Number(d.valor), 0);

  // Materiais com custo unitário informado (aba Materiais) — material do cliente não é custo da SteelNova.
  const materiaisCusto = materiais
    .filter((m) => !m.fornecidoPeloCliente && m.custoUnitario)
    .reduce((s, m) => s + Number(m.custoUnitario) * Number(m.quantidadePrevista), 0);

  // Lançamentos avulsos/imprevistos (esta aba), separados por tipo.
  const manualIndireto = custos
    .filter((c) => c.tipo === "Indireto")
    .reduce((s, c) => s + Number(c.valorRealizado ?? c.valorPrevisto), 0);
  const manualDireto = custos
    .filter((c) => c.tipo !== "Indireto")
    .reduce((s, c) => s + Number(c.valorRealizado ?? c.valorPrevisto), 0);

  const totalDireto = maoDeObra + desembolsosDiretos + materiaisCusto + manualDireto;
  const totalIndireto = manualIndireto;
  const totalGeral = totalDireto + totalIndireto;

  const fontes = [
    { label: "Mão de obra", sub: "aba Diárias", valor: maoDeObra, cor: "from-sky-50 to-blue-100 border-sky-200", txt: "text-sky-700" },
    { label: "Materiais", sub: "aba Materiais", valor: materiaisCusto, cor: "from-violet-50 to-indigo-100 border-violet-200", txt: "text-violet-700" },
    { label: "Desembolsos", sub: "aba Diárias", valor: desembolsosDiretos, cor: "from-amber-50 to-orange-100 border-amber-200", txt: "text-amber-700" },
    { label: "Avulsos / imprevistos", sub: "esta aba", valor: manualDireto + manualIndireto, cor: "from-rose-50 to-red-100 border-rose-200", txt: "text-rose-700" },
  ];

  return (
    <div className="p-8">
      {/* Total geral consolidado */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/60">Custo total da obra</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">{formatBRL(totalGeral)}</p>
          <p className="mt-1 text-xs text-emerald-800/70">soma automática de todas as abas</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Custos diretos</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{formatBRL(totalDireto)}</p>
          <p className="mt-1 text-xs text-neutral-500">mão de obra, material, desembolso e diretos avulsos</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Custos indiretos</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{formatBRL(totalIndireto)}</p>
          <p className="mt-1 text-xs text-neutral-500">avulsos marcados como indiretos</p>
        </div>
      </div>

      {/* Fontes consolidadas */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {fontes.map((f) => (
          <div key={f.label} className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${f.cor}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{f.label}</p>
            <p className={`mt-1 text-xl font-bold ${f.txt}`}>{formatBRL(f.valor)}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{f.sub}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-fg">Lançar custo avulso / imprevisto</h2>
      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
          <input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-48 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Previsto (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.valorPrevisto}
            onChange={(e) => setForm({ ...form, valorPrevisto: e.target.value })}
            className="w-32 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Realizado (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.valorRealizado}
            onChange={(e) => setForm({ ...form, valorRealizado: e.target.value })}
            className="w-32 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Data</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Lançar
        </button>
      </form>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Data</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Categoria</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Tipo</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Descrição</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Previsto</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Realizado</th>
            </tr>
          </thead>
          <tbody>
            {custos.map((c) => (
              <tr key={c.id} className="border-t border-ink-800">
                <td className="px-4 py-3 text-neutral-600">{new Date(c.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td className="px-4 py-3 text-neutral-600">{c.categoria}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${c.tipo === "Indireto" ? "border-purple-300 bg-purple-100 text-purple-800" : "border-teal-300 bg-teal-100 text-teal-800"}`}>
                    {c.tipo || "Direto"}
                  </span>
                </td>
                <td className="px-4 py-3 text-fg">{c.descricao}</td>
                <td className="px-4 py-3 text-neutral-600">{formatBRL(Number(c.valorPrevisto))}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {c.valorRealizado ? formatBRL(Number(c.valorRealizado)) : "—"}
                </td>
              </tr>
            ))}
            {custos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Nenhum custo avulso lançado. O total acima já soma mão de obra, materiais e desembolsos das outras abas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
