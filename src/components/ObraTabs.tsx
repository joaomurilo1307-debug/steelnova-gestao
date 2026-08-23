"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "", label: "Visão geral" },
  { seg: "orcamento", label: "Orçamento" },
  { seg: "kanban", label: "Kanban" },
  { seg: "lista", label: "Lista" },
  { seg: "cronograma", label: "Cronograma" },
  { seg: "rdo", label: "RDO" },
  { seg: "diarias", label: "Diárias" },
  { seg: "custos", label: "Custos" },
  { seg: "materiais", label: "Materiais" },
  { seg: "equipe", label: "Equipe" },
  { seg: "arquivos", label: "Arquivos" },
  { seg: "chat", label: "Chat" },
  { seg: "resultado", label: "Resultado" },
];

export default function ObraTabs({ obraId }: { obraId: string }) {
  const pathname = usePathname();
  const base = `/obras/${obraId}`;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-ink-800 px-6">
      {TABS.map((tab) => {
        const href = tab.seg ? `${base}/${tab.seg}` : base;
        const active = pathname === href;
        return (
          <Link
            key={tab.seg}
            href={href}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition ${
              active
                ? "border-brand font-medium text-brand"
                : "border-transparent text-neutral-600 hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
