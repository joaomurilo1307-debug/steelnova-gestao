"use client";

import { useEffect, useRef, useState } from "react";

type Arquivo = {
  id: string;
  nome: string;
  categoria: string;
  tamanho: number;
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
  const [categoria, setCategoria] = useState("NOTA_FISCAL");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/arquivos?obraId=${obraId}`);
    if (res.ok) setArquivos(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("obraId", obraId);
    fd.append("categoria", categoria);
    const res = await fetch("/api/arquivos", { method: "POST", body: fd });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) load();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <label className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          {uploading ? "Enviando..." : "+ Enviar arquivo"}
          <input ref={inputRef} type="file" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Arquivo</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Tamanho</th>
              <th className="px-4 py-3 font-medium">Enviado por</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {arquivos.map((a) => (
              <tr key={a.id} className="border-t border-ink-800">
                <td className="px-4 py-3 text-white">{a.nome}</td>
                <td className="px-4 py-3 text-neutral-400">{CATEGORIA_LABEL[a.categoria] ?? a.categoria}</td>
                <td className="px-4 py-3 text-neutral-400">{fmtSize(a.tamanho)}</td>
                <td className="px-4 py-3 text-neutral-400">{a.uploadadoPor.name}</td>
                <td className="px-4 py-3">
                  <a href={`/api/arquivos/${a.id}/download`} className="text-xs text-brand hover:underline">
                    Baixar
                  </a>
                </td>
              </tr>
            ))}
            {arquivos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
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
