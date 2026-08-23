"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NovoRdoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    clima: "Bom",
    efetivo: "",
    atividades: "",
    ocorrencias: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/rdo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId: params.id,
        data: form.data,
        clima: form.clima,
        efetivo: Number(form.efetivo),
        atividades: form.atividades,
        ocorrencias: form.ocorrencias || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error === "string" ? body.error : "Não foi possível salvar. Confira se já existe RDO para essa data.");
      return;
    }

    router.push(`/obras/${params.id}/rdo`);
    router.refresh();
  }

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-600">Data</label>
          <input
            type="date"
            required
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-600">Clima</label>
          <select
            value={form.clima}
            onChange={(e) => setForm({ ...form, clima: e.target.value })}
            className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-fg outline-none focus:border-brand"
          >
            <option>Bom</option>
            <option>Nublado</option>
            <option>Chuva</option>
            <option>Chuva forte (impraticável)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-600">Efetivo em campo (pessoas)</label>
          <input
            type="number"
            min={0}
            required
            value={form.efetivo}
            onChange={(e) => setForm({ ...form, efetivo: e.target.value })}
            className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-600">Atividades executadas</label>
          <textarea
            required
            rows={4}
            value={form.atividades}
            onChange={(e) => setForm({ ...form, atividades: e.target.value })}
            className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-600">Ocorrências (opcional)</label>
          <textarea
            rows={2}
            value={form.ocorrencias}
            onChange={(e) => setForm({ ...form, ocorrencias: e.target.value })}
            className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-fg outline-none focus:border-brand"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 self-start rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar RDO"}
        </button>
      </form>
    </div>
  );
}
