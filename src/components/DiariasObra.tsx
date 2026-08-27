"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Funcionario = { id: string; nome: string; cargo: string | null; regime: string; diariaPadrao: string | null; valorFixo: string | null };

const CARGOS = ["Mestre de obra", "Encarregado", "Soldador", "Caldeireiro", "Instalador/Montador", "Pintor", "Ajudante", "Motorista", "Outro"];
type Lancamento = {
  id: string;
  dia: string;
  entrada: string;
  saida: string;
  funcionario: Funcionario;
};
type Desembolso = {
  id: string;
  pessoa: string;
  item: string;
  categoria: string;
  valor: string;
  data: string | null;
  funcionarioRef: Funcionario | null;
};

function horasEntre(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  let mins = sh * 60 + sm - (eh * 60 + em);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export default function DiariasObra({ obraId }: { obraId: string }) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [desembolsos, setDesembolsos] = useState<Desembolso[]>([]);
  const [diariaPadrao, setDiariaPadrao] = useState(150);
  const [horasPorDiaria, setHorasPorDiaria] = useState(8);

  const [novoFunc, setNovoFunc] = useState({ nome: "", cargo: CARGOS[0], regime: "Diaria", diariaPadrao: "", valorFixo: "" });
  const [novoPonto, setNovoPonto] = useState({ funcionarioId: "", dia: "", entrada: "", saida: "" });
  const [novoDesembolso, setNovoDesembolso] = useState({
    pessoa: "",
    item: "",
    categoria: "Material",
    valor: "",
    funcionarioRefId: "",
  });

  async function load() {
    const [fRes, lRes, dRes, pRes] = await Promise.all([
      fetch("/api/funcionarios"),
      fetch(`/api/ponto?obraId=${obraId}`),
      fetch(`/api/desembolsos?obraId=${obraId}`),
      fetch(`/api/obras/${obraId}/parametros-orcamento`),
    ]);
    if (fRes.ok) setFuncionarios(await fRes.json());
    if (lRes.ok) setLancamentos(await lRes.json());
    if (dRes.ok) setDesembolsos(await dRes.json());
    if (pRes.ok) {
      const p = await pRes.json();
      setDiariaPadrao(Number(p.diariaPadrao));
      setHorasPorDiaria(Number(p.horasPorDiaria));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAddFuncionario(e: React.FormEvent) {
    e.preventDefault();
    if (!novoFunc.nome.trim()) return;
    const res = await fetch("/api/funcionarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoFunc.nome,
        cargo: novoFunc.cargo || undefined,
        regime: novoFunc.regime,
        diariaPadrao: novoFunc.diariaPadrao ? Number(novoFunc.diariaPadrao) : undefined,
        valorFixo: novoFunc.valorFixo ? Number(novoFunc.valorFixo) : undefined,
      }),
    });
    if (res.ok) {
      setNovoFunc({ nome: "", cargo: CARGOS[0], regime: "Diaria", diariaPadrao: "", valorFixo: "" });
      load();
    }
  }

  async function handleAddPonto(e: React.FormEvent) {
    e.preventDefault();
    if (!novoPonto.funcionarioId || !novoPonto.dia || !novoPonto.entrada || !novoPonto.saida) return;
    const res = await fetch("/api/ponto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, ...novoPonto }),
    });
    if (res.ok) {
      setNovoPonto({ funcionarioId: "", dia: "", entrada: "", saida: "" });
      load();
    }
  }

  async function handleDeletePonto(id: string) {
    const res = await fetch(`/api/ponto/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function handleAddDesembolso(e: React.FormEvent) {
    e.preventDefault();
    if (!novoDesembolso.pessoa.trim() || !novoDesembolso.item.trim() || !novoDesembolso.valor) return;
    const res = await fetch("/api/desembolsos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        pessoa: novoDesembolso.pessoa,
        item: novoDesembolso.item,
        categoria: novoDesembolso.categoria,
        valor: Number(novoDesembolso.valor),
        funcionarioRefId: novoDesembolso.funcionarioRefId || undefined,
      }),
    });
    if (res.ok) {
      setNovoDesembolso({ pessoa: "", item: "", categoria: "Material", valor: "", funcionarioRefId: "" });
      load();
    }
  }

  // Resumo por funcionário
  const resumo = funcionarios
    .map((f) => {
      const lancsF = lancamentos.filter((l) => l.funcionario.id === f.id);
      const horas = lancsF.reduce((s, l) => s + horasEntre(l.entrada, l.saida), 0);
      const diarias = horas / horasPorDiaria;
      const taxaDiaria = f.diariaPadrao ? Number(f.diariaPadrao) : diariaPadrao;
      const valorCalc = horas * (taxaDiaria / horasPorDiaria);
      const aPagar = f.regime === "Fixo" ? Number(f.valorFixo ?? 0) : valorCalc;
      const adiantado = desembolsos
        .filter((d) => d.categoria === "Adiantamento" && d.funcionarioRef?.id === f.id)
        .reduce((s, d) => s + Number(d.valor), 0);
      return { funcionario: f, horas, diarias, valorCalc, aPagar, adiantado, saldo: aPagar - adiantado };
    })
    .filter((r) => r.horas > 0 || r.funcionario.regime === "Fixo");

  const totalAPagar = resumo.reduce((s, r) => s + r.aPagar, 0);
  const totalDesembolsado = desembolsos.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="p-8">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Mão de obra a pagar</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(totalAPagar)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Desembolsado (material/adiant.)</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(totalDesembolsado)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Saldo a pagar (líquido)</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">
            {formatBRL(resumo.reduce((s, r) => s + r.saldo, 0))}
          </p>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-fg">Lançamentos de ponto</h2>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <form onSubmit={handleAddPonto} className="flex flex-wrap items-end gap-2">
          <select
            value={novoPonto.funcionarioId}
            onChange={(e) => setNovoPonto({ ...novoPonto, funcionarioId: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          >
            <option value="">Funcionário...</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}{f.cargo ? ` — ${f.cargo}` : ""}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={novoPonto.dia}
            onChange={(e) => setNovoPonto({ ...novoPonto, dia: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={novoPonto.entrada}
            onChange={(e) => setNovoPonto({ ...novoPonto, entrada: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={novoPonto.saida}
            onChange={(e) => setNovoPonto({ ...novoPonto, saida: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          />
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            Lançar
          </button>
        </form>
        {/* Fora do <form> de ponto de propósito — HTML não permite <form> aninhado, e um
            form dentro de outro quebra a hidratação do React (o parser do navegador
            descarta o form interno, gerando um DOM diferente do que o React esperava). */}
        <details className="ml-auto">
          <summary className="cursor-pointer text-xs text-neutral-500">+ Cadastrar funcionário</summary>
          <form onSubmit={handleAddFuncionario} className="mt-2 flex flex-wrap items-end gap-2">
            <input
              placeholder="Nome"
              value={novoFunc.nome}
              onChange={(e) => setNovoFunc({ ...novoFunc, nome: e.target.value })}
              className="w-36 pill-field px-3 py-2 text-sm"
            />
            <select
              value={novoFunc.cargo}
              onChange={(e) => setNovoFunc({ ...novoFunc, cargo: e.target.value })}
              className="pill-field px-3 py-2 text-sm"
            >
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={novoFunc.regime}
              onChange={(e) => setNovoFunc({ ...novoFunc, regime: e.target.value })}
              className="pill-field px-3 py-2 text-sm"
            >
              <option value="Diaria">Diária</option>
              <option value="Fixo">Fixo</option>
            </select>
            {novoFunc.regime === "Fixo" ? (
              <input
                type="number"
                placeholder="Valor fixo"
                value={novoFunc.valorFixo}
                onChange={(e) => setNovoFunc({ ...novoFunc, valorFixo: e.target.value })}
                className="w-28 pill-field px-3 py-2 text-sm"
              />
            ) : (
              <input
                type="number"
                placeholder="Diária (opcional)"
                value={novoFunc.diariaPadrao}
                onChange={(e) => setNovoFunc({ ...novoFunc, diariaPadrao: e.target.value })}
                className="w-32 pill-field px-3 py-2 text-sm"
              />
            )}
            <button type="submit" className="rounded-lg bg-ink-700 px-3 py-2 text-xs text-fg hover:bg-ink-700/80">
              Salvar
            </button>
          </form>
        </details>
      </div>

      <div className="mb-6 overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Dia</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Funcionário</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Entrada</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Saída</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Horas</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label"></th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => (
              <tr key={l.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-neutral-600">{new Date(l.dia).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td className="px-3 py-2 text-fg">{l.funcionario.nome}</td>
                <td className="px-3 py-2 text-neutral-600">{l.entrada}</td>
                <td className="px-3 py-2 text-neutral-600">{l.saida}</td>
                <td className="px-3 py-2 text-neutral-600">{horasEntre(l.entrada, l.saida).toFixed(2)}h</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDeletePonto(l.id)} className="text-xs text-red-600 hover:underline">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {lancamentos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Nenhum lançamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-fg">Resumo por funcionário — acerto</h2>
      <div className="mb-6 overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Funcionário</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Cargo</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Regime</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Horas</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Diárias</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">A pagar</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Adiantado</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((r) => (
              <tr key={r.funcionario.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-fg">{r.funcionario.nome}</td>
                <td className="px-3 py-2 text-neutral-600">{r.funcionario.cargo ?? "—"}</td>
                <td className="px-3 py-2 text-neutral-600">{r.funcionario.regime}</td>
                <td className="px-3 py-2 text-neutral-600">{r.horas.toFixed(2)}h</td>
                <td className="px-3 py-2 text-neutral-600">{r.diarias.toFixed(2)}</td>
                <td className="px-3 py-2 text-neutral-600">{formatBRL(r.aPagar)}</td>
                <td className="px-3 py-2 text-neutral-600">{formatBRL(r.adiantado)}</td>
                <td className="px-3 py-2 font-medium text-emerald-600">{formatBRL(r.saldo)}</td>
              </tr>
            ))}
            {resumo.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                  Sem dados ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-fg">Desembolsos (quem pagou do próprio bolso)</h2>
      <form onSubmit={handleAddDesembolso} className="mb-3 flex flex-wrap items-end gap-2">
        <input
          placeholder="Pessoa (quem pagou)"
          value={novoDesembolso.pessoa}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, pessoa: e.target.value })}
          className="w-32 pill-field px-3 py-2 text-sm"
        />
        <input
          placeholder="Item"
          value={novoDesembolso.item}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, item: e.target.value })}
          className="w-44 pill-field px-3 py-2 text-sm"
        />
        <select
          value={novoDesembolso.categoria}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, categoria: e.target.value })}
          className="pill-field px-3 py-2 text-sm"
        >
          <option>Material</option>
          <option>Alimentação</option>
          <option>Adiantamento</option>
          <option>Ferramenta</option>
          <option>Outro</option>
        </select>
        {novoDesembolso.categoria === "Adiantamento" && (
          <select
            value={novoDesembolso.funcionarioRefId}
            onChange={(e) => setNovoDesembolso({ ...novoDesembolso, funcionarioRefId: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
          >
            <option value="">Adiantamento p/...</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          step="0.01"
          placeholder="Valor"
          value={novoDesembolso.valor}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, valor: e.target.value })}
          className="w-28 pill-field px-3 py-2 text-sm"
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Lançar
        </button>
      </form>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Pessoa</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Item</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Categoria</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Ref.</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Valor</th>
            </tr>
          </thead>
          <tbody>
            {desembolsos.map((d) => (
              <tr key={d.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-fg">{d.pessoa}</td>
                <td className="px-3 py-2 text-neutral-600">{d.item}</td>
                <td className="px-3 py-2 text-neutral-600">{d.categoria}</td>
                <td className="px-3 py-2 text-neutral-600">{d.funcionarioRef?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-fg">{formatBRL(Number(d.valor))}</td>
              </tr>
            ))}
            {desembolsos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Nenhum desembolso lançado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
