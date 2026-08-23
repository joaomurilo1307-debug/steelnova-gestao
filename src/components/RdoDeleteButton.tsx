"use client";

import { useRouter } from "next/navigation";

export default function RdoDeleteButton({ rdoId }: { rdoId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Excluir este RDO?")) return;
    const res = await fetch(`/api/rdo/${rdoId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">
      Excluir
    </button>
  );
}
