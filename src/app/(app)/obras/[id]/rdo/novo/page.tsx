"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Funcionario = { id: string; nome: string; cargo: string | null };

type TrabalhadorRow = { funcionarioId: string; nome: string; funcao: string; entrada: string; saida: string };
type AtividadeRow = { descricao: string; situacao: "FINALIZADA" | "PARCIAL" };
type PendenciaRow = { descricao: string; observacao: string };

const CLIMA_OPTIONS = [
  { value: "SOL", label: "Sol" },
  { value: "NUBLADO", label: "Nublado" },
  { value: "CHUVA", label: "Chuva" },
  { value: "TEMPO_RUIM", label: "Tempo ruim" },
];

export default function NovoRdoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    clima: "SOL",
    horarioInicio: "",
    horarioTermino: "",
    houveParalisacao: false,
    horarioParalisacao: "",
    motivoParalisacao: "",
    observacoes: "",
  });
  const [trabalhadores, setTrabalhadores] = useState<TrabalhadorRow[]>([
    { funcionarioId: "", nome: "", funcao: "", entrada: "07:00", saida: "17:00" },
  ]);
  const [atividades, setAtividades] = useState<AtividadeRow[]>([{ descricao: "", situacao: "PARCIAL" }]);
  const [pendencias, setPendencias] = useState<PendenciaRow[]>([]);
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/funcionarios")
      .then((r) => (r.ok ? r.json() : []))
      .then(setFuncionarios);
  }, []);

  function updateTrabalhador(i: number, patch: Partial<TrabalhadorRow>) {
    setTrabalhadores((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function pickFuncionario(i: number, funcionarioId: string) {
    const f = funcionarios.find((x) => x.id === funcionarioId);
    updateTrabalhador(i, { funcionarioId, nome: f?.nome ?? "", funcao: f?.cargo ?? "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trabalhadoresValidos = trabalhadores.filter((t) => t.nome.trim());
    const atividadesValidas = atividades.filter((a) => a.descricao.trim());
    const pendenciasValidas = pendencias.filter((p) => p.descricao.trim());

    const res = await fetch("/api/rdo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId: params.id,
        data: form.data,
        clima: form.clima,
        horarioInicio: form.horarioInicio || undefined,
        horarioTermino: form.horarioTermino || undefined,
        houveParalisacao: form.houveParalisacao,
        horarioParalisacao: form.houveParalisacao ? form.horarioParalisacao || undefined : undefined,
        motivoParalisacao: form.houveParalisacao ? form.motivoParalisacao || undefined : undefined,
        observacoes: form.observacoes || undefined,
        trabalhadores: trabalhadoresValidos.map((t) => ({
          nome: t.nome,
          funcao: t.funcao || "—",
          entrada: t.entrada || undefined,
          saida: t.saida || undefined,
        })),
        atividades: atividadesValidas,
        pendencias: pendenciasValidas.map((p) => ({ descricao: p.descricao, observacao: p.observacao || undefined })),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Não foi possível salvar. Confira se já existe RDO para essa data.");
      setLoading(false);
      return;
    }

    const rdo = await res.json();

    // Atualiza o ponto/Diárias para quem tem funcionário vinculado
    for (const t of trabalhadoresValidos) {
      if (t.funcionarioId && t.entrada && t.saida) {
        await fetch("/api/ponto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            obraId: params.id,
            funcionarioId: t.funcionarioId,
            dia: form.data,
            entrada: t.entrada,
            saida: t.saida,
          }),
        }).catch(() => {});
      }
    }

    if (foto) {
      const fd = new FormData();
      fd.append("file", foto);
      fd.append("legenda", "Ficha preenchida em obra");
      await fetch(`/api/rdo/${rdo.id}/fotos`, { method: "POST", body: fd }).catch(() => {});
    }

    setLoading(false);
    router.push(`/obras/${params.id}/rdo`);
    router.refresh();
  }

  const inputCls = "w-full pill-field px-3 py-2 text-sm";
  const labelCls = "mb-1 block text-xs text-neutral-500";

  return (
    <div className="p-8">
      <form onSubmit={handleSubmit} className="flex max-w-4xl flex-col gap-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">Identificação</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Horário início</label>
              <input type="time" value={form.horarioInicio} onChange={(e) => setForm({ ...form, horarioInicio: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Horário término</label>
              <input type="time" value={form.horarioTermino} onChange={(e) => setForm({ ...form, horarioTermino: e.target.value })} className={inputCls} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">Condições climáticas</h2>
          <div className="flex flex-wrap gap-2">
            {CLIMA_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm({ ...form, clima: c.value })}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  form.clima === c.value ? "border-brand bg-brand/10 font-medium text-brand" : "border-ink-700 text-fg-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="paralisacao"
              checked={form.houveParalisacao}
              onChange={(e) => setForm({ ...form, houveParalisacao: e.target.checked })}
            />
            <label htmlFor="paralisacao" className="text-sm text-fg">
              Houve paralisação no dia
            </label>
          </div>
          {form.houveParalisacao && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Horário da paralisação</label>
                <input value={form.horarioParalisacao} onChange={(e) => setForm({ ...form, horarioParalisacao: e.target.value })} placeholder="09:00 às 10:30" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Motivo</label>
                <input value={form.motivoParalisacao} onChange={(e) => setForm({ ...form, motivoParalisacao: e.target.value })} className={inputCls} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">Equipe presente no dia</h2>
            <button
              type="button"
              onClick={() => setTrabalhadores((r) => [...r, { funcionarioId: "", nome: "", funcao: "", entrada: "07:00", saida: "17:00" }])}
              className="text-xs text-brand hover:underline"
            >
              + Adicionar pessoa
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {trabalhadores.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-ink-800 bg-ink-900 p-3 sm:grid-cols-6">
                <select value={t.funcionarioId} onChange={(e) => pickFuncionario(i, e.target.value)} className={`${inputCls} sm:col-span-2`}>
                  <option value="">Selecionar da equipe...</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}{f.cargo ? ` — ${f.cargo}` : ""}
                    </option>
                  ))}
                </select>
                <input placeholder="Nome (ou avulso)" value={t.nome} onChange={(e) => updateTrabalhador(i, { nome: e.target.value })} className={inputCls} />
                <input placeholder="Função" value={t.funcao} onChange={(e) => updateTrabalhador(i, { funcao: e.target.value })} className={inputCls} />
                <input type="time" value={t.entrada} onChange={(e) => updateTrabalhador(i, { entrada: e.target.value })} className={inputCls} />
                <div className="flex gap-1">
                  <input type="time" value={t.saida} onChange={(e) => updateTrabalhador(i, { saida: e.target.value })} className={inputCls} />
                  <button type="button" onClick={() => setTrabalhadores((r) => r.filter((_, idx) => idx !== i))} className="px-2 text-xs text-red-600">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">Atividades realizadas no dia</h2>
            <button
              type="button"
              onClick={() => setAtividades((a) => [...a, { descricao: "", situacao: "PARCIAL" }])}
              className="text-xs text-brand hover:underline"
            >
              + Adicionar atividade
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {atividades.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  placeholder="Atividade executada"
                  value={a.descricao}
                  onChange={(e) => setAtividades((rows) => rows.map((r, idx) => (idx === i ? { ...r, descricao: e.target.value } : r)))}
                  className={`${inputCls} flex-1`}
                />
                <select
                  value={a.situacao}
                  onChange={(e) => setAtividades((rows) => rows.map((r, idx) => (idx === i ? { ...r, situacao: e.target.value as any } : r)))}
                  className="w-32 pill-field px-2 py-2 text-sm"
                >
                  <option value="FINALIZADA">Finalizada</option>
                  <option value="PARCIAL">Parcial</option>
                </select>
                <button type="button" onClick={() => setAtividades((r) => r.filter((_, idx) => idx !== i))} className="px-2 text-xs text-red-600">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-fg">Pendências / em execução</h2>
            <button
              type="button"
              onClick={() => setPendencias((p) => [...p, { descricao: "", observacao: "" }])}
              className="text-xs text-brand hover:underline"
            >
              + Adicionar pendência
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {pendencias.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  placeholder="Pendência"
                  value={p.descricao}
                  onChange={(e) => setPendencias((rows) => rows.map((r, idx) => (idx === i ? { ...r, descricao: e.target.value } : r)))}
                  className={`${inputCls} flex-1`}
                />
                <input
                  placeholder="Observação"
                  value={p.observacao}
                  onChange={(e) => setPendencias((rows) => rows.map((r, idx) => (idx === i ? { ...r, observacao: e.target.value } : r)))}
                  className={`${inputCls} flex-1`}
                />
                <button type="button" onClick={() => setPendencias((r) => r.filter((_, idx) => idx !== i))} className="px-2 text-xs text-red-600">
                  ✕
                </button>
              </div>
            ))}
            {pendencias.length === 0 && <p className="text-xs text-neutral-500">Nenhuma pendência registrada.</p>}
          </div>
        </div>

        <div>
          <label className={labelCls}>Observações / ocorrências do dia</label>
          <textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Anexar foto da ficha preenchida (opcional)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-2 file:text-sm file:text-fg"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="self-start btn-primary px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar RDO"}
        </button>
      </form>
    </div>
  );
}
