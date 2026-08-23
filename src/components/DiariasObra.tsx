"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Funcionario = { id: string; nome: string; regime: string; diariaPadrao: string | null; valorFixo: string | null };
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

  const [novoFunc, setNovoFunc] = useState({ nome: "", regime: "Diaria", diariaPadrao: "", valorFixo: "" });
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
        regime: novoFunc.regime,
        diariaPadrao: novoFunc.diariaPadrao ? Number(novoFunc.diariaPadrao) : undefined,
        valorFixo: novoFunc.valorFixo ? Number(novoFunc.valorFixo) : undefined,
      }),
    });
    if (res.ok) {
      setNovoFunc({ nome: "", regime: "Diaria", diariaPadrao: "", valorFixo: "" });
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
    <div className="p-6">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Mão de obra a pagar</p>
          <p className="mt-1 text-lg font-semibold text-white">{formatBRL(totalAPagar)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Desembolsado (material/adiant.)</p>
          <p className="mt-1 text-lg font-semibold text-white">{formatBRL(totalDesembolsado)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Saldo a pagar (líquido)</p>
          <p className="mt-1 text-lg font-semibold text-emerald-400">
            {formatBRL(resumo.reduce((s, r) => s + r.saldo, 0))}
          </p>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-white">Lançamentos de ponto</h2>
      <form onSubmit={handleAddPonto} className="mb-3 flex flex-wrap items-end gap-2">
        <select
          value={novoPonto.funcionarioId}
          onChange={(e) => setNovoPonto({ ...novoPonto, funcionarioId: e.target.value })}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        >
          <option value="">Funcionário...</option>
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={novoPonto.dia}
          onChange={(e) => setNovoPonto({ ...novoPonto, dia: e.target.value })}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <input
          type="time"
          value={novoPonto.entrada}
          onChange={(e) => setNovoPonto({ ...novoPonto, entrada: e.target.value })}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <input
          type="time"
          value={novoPonto.saida}
          onChange={(e) => setNovoPonto({ ...novoPonto, saida: e.target.value })}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Lançar
        </button>
        <details className="ml-auto">
          <summary className="cursor-pointer text-xs text-neutral-500">+ Cadastrar funcionário</summary>
          <form onSubmit={handleAddFuncionario} className="mt-2 flex flex-wrap items-end gap-2">
            <input
              placeholder="Nome"
              value={novoFunc.nome}
              onChange={(e) => setNovoFunc({ ...novoFunc, nome: e.target.value })}
              className="w-36 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
            />
            <select
              value={novoFunc.regime}
              onChange={(e) => setNovoFunc({ ...novoFunc, regime: e.target.value })}
              className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
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
                className="w-28 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
            ) : (
              <input
                type="number"
                placeholder="Diária (opcional)"
                value={novoFunc.diariaPadrao}
                onChange={(e) => setNovoFunc({ ...novoFunc, diariaPadrao: e.target.value })}
                className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
            )}
            <button type="submit" className="rounded-lg bg-ink-700 px-3 py-2 text-xs text-white hover:bg-ink-700/80">
              Salvar
            </button>
          </form>
        </details>
      </form>

      <div className="mb-6 overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">Dia</th>
              <th className="px-3 py-2 font-medium">Funcionário</th>
              <th className="px-3 py-2 font-medium">Entrada</th>
              <th className="px-3 py-2 font-medium">Saída</th>
              <th className="px-3 py-2 font-medium">Horas</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => (
              <tr key={l.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-neutral-400">{new Date(l.dia).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td className="px-3 py-2 text-white">{l.funcionario.nome}</td>
                <td className="px-3 py-2 text-neutral-400">{l.entrada}</td>
                <td className="px-3 py-2 text-neutral-400">{l.saida}</td>
                <td className="px-3 py-2 text-neutral-400">{horasEntre(l.entrada, l.saida).toFixed(2)}h</td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDeletePonto(l.id)} className="text-xs text-red-400 hover:underline">
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

      <h2 className="mb-2 text-sm font-semibold text-white">Resumo por funcionário — acerto</h2>
      <div className="mb-6 overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">Funcionário</th>
              <th className="px-3 py-2 font-medium">Regime</th>
              <th className="px-3 py-2 font-medium">Horas</th>
              <th className="px-3 py-2 font-medium">Diárias</th>
              <th className="px-3 py-2 font-medium">A pagar</th>
              <th className="px-3 py-2 font-medium">Adiantado</th>
              <th className="px-3 py-2 font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((r) => (
              <tr key={r.funcionario.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-white">{r.funcionario.nome}</td>
                <td className="px-3 py-2 text-neutral-400">{r.funcionario.regime}</td>
                <td className="px-3 py-2 text-neutral-400">{r.horas.toFixed(2)}h</td>
                <td className="px-3 py-2 text-neutral-400">{r.diarias.toFixed(2)}</td>
                <td className="px-3 py-2 text-neutral-400">{formatBRL(r.aPagar)}</td>
                <td className="px-3 py-2 text-neutral-400">{formatBRL(r.adiantado)}</td>
                <td className="px-3 py-2 font-medium text-emerald-400">{formatBRL(r.saldo)}</td>
              </tr>
            ))}
            {resumo.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  Sem dados ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-white">Desembolsos (quem pagou do próprio bolso)</h2>
      <form onSubmit={handleAddDesembolso} className="mb-3 flex flex-wrap items-end gap-2">
        <input
          placeholder="Pessoa (quem pagou)"
          value={novoDesembolso.pessoa}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, pessoa: e.target.value })}
          className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <input
          placeholder="Item"
          value={novoDesembolso.item}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, item: e.target.value })}
          className="w-44 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <select
          value={novoDesembolso.categoria}
          onChange={(e) => setNovoDesembolso({ ...novoDesembolso, categoria: e.target.value })}
          className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
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
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
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
          className="w-28 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Lançar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">Pessoa</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Categoria</th>
              <th className="px-3 py-2 font-medium">Ref.</th>
              <th className="px-3 py-2 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {desembolsos.map((d) => (
              <tr key={d.id} className="border-t border-ink-800">
                <td className="px-3 py-2 text-white">{d.pessoa}</td>
                <td className="px-3 py-2 text-neutral-400">{d.item}</td>
                <td className="px-3 py-2 text-neutral-400">{d.categoria}</td>
                <td className="px-3 py-2 text-neutral-400">{d.funcionarioRef?.nome ?? "—"}</td>
                <td className="px-3 py-2 text-white">{formatBRL(Number(d.valor))}</td>
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
