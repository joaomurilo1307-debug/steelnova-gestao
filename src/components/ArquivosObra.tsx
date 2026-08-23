"use client";

import { useEffect, useRef, useState } from "react";
import { formatBRL } from "@/lib/format";

type Arquivo = {
  id: string;
  nome: string;
  categoria: string;
  tamanho: number;
  valor: string | null;
  descricao: string | null;
  data: string | null;
  createdAt: string;
  uploadadoPor: { name: string };
};

const CATEGORIA_LABEL: Record<string, string> = {
  NOTA_FISCAL: "Nota fiscal",
  PLANILHA_HORARIOS: "Planilha de horários",
  PROJETO: "Projeto",
  FOTO: "Foto",
  OUTRO: "Outro",
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ArquivosObra({ obraId }: { obraId: string }) {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ categoria: "NOTA_FISCAL", valor: "", descricao: "", data: "" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/arquivos?obraId=${obraId}`);
    if (res.ok) setArquivos(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("obraId", obraId);
    fd.append("categoria", form.categoria);
    if (form.valor) fd.append("valor", form.valor);
    if (form.descricao) fd.append("descricao", form.descricao);
    if (form.data) fd.append("data", form.data);
    const res = await fetch("/api/arquivos", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      setFile(null);
      setForm({ categoria: "NOTA_FISCAL", valor: "", descricao: "", data: "" });
      if (inputRef.current) inputRef.current.value = "";
      load();
    }
  }

  const totalNotas = arquivos
    .filter((a) => a.categoria === "NOTA_FISCAL")
    .reduce((s, a) => s + Number(a.valor ?? 0), 0);

  return (
    <div className="p-6">
      <div className="mb-4 rounded-xl border border-ink-800 bg-ink-900 p-4">
        <p className="text-xs uppercase text-neutral-500">Total em notas fiscais anexadas</p>
        <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(totalNotas)}</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          >
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
          <input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Ex: Compra de parafusos"
            className="w-52 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Data</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Arquivo (foto ou PDF da nota)</label>
          <input
            ref={inputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-56 text-sm text-fg file:mr-2 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3 file:py-2 file:text-sm file:text-fg"
          />
        </div>
        <button
          type="submit"
          disabled={uploading || !file}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {uploading ? "Enviando..." : "Anexar"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">Arquivo</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Enviado por</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {arquivos.map((a) => (
              <tr key={a.id} className="border-t border-ink-800">
                <td className="px-4 py-3 text-fg">
                  {a.nome}
                  <p className="text-xs text-neutral-500">{fmtSize(a.tamanho)}</p>
                </td>
                <td className="px-4 py-3 text-neutral-600">{a.descricao ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{CATEGORIA_LABEL[a.categoria] ?? a.categoria}</td>
                <td className="px-4 py-3 text-fg">{a.valor ? formatBRL(Number(a.valor)) : "—"}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {a.data ? new Date(a.data).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-600">{a.uploadadoPor.name}</td>
                <td className="px-4 py-3">
                  <a href={`/api/arquivos/${a.id}/download`} className="text-xs text-brand hover:underline">
                    Baixar
                  </a>
                </td>
              </tr>
            ))}
            {arquivos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  Nenhum arquivo enviado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
