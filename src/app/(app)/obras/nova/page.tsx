"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";

export default function NovaObraPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    cliente: "",
    endereco: "",
    valorContrato: "",
    dataInicio: "",
    prazoPrevistoDias: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/obras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        cliente: form.cliente,
        endereco: form.endereco || undefined,
        valorContrato: Number(form.valorContrato),
        dataInicio: form.dataInicio,
        prazoPrevistoDias: Number(form.prazoPrevistoDias),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Não foi possível criar a obra. Confira os campos.");
      return;
    }

    const obra = await res.json();
    router.push(`/obras/${obra.id}`);
    router.refresh();
  }

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div>
      <label className="mb-1 block text-sm text-neutral-600">{label}</label>
      <input
        type={type}
        required={key !== "endereco"}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-fg outline-none focus:border-brand"
      />
    </div>
  );

  return (
    <div>
      <TopBar title="Nova obra" subtitle="Cadastro de obra" />

      <div className="p-8">
        <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
          {field("Nome da obra", "nome")}
          {field("Cliente", "cliente")}
          {field("Endereço", "endereco")}
          {field("Valor do contrato (R$)", "valorContrato", "number")}
          {field("Data de início", "dataInicio", "date")}
          {field("Prazo previsto (dias)", "prazoPrevistoDias", "number")}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 self-start btn-primary px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar obra"}
          </button>
        </form>
      </div>
    </div>
  );
}
