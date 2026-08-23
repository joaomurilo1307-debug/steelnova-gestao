"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  IconPainel,
  IconPlanejamento,
  IconKanban,
  IconGantt,
  IconRdo,
  IconCustos,
  IconObras,
  IconEquipe,
  IconRelatorios,
  IconRaci,
} from "@/components/NavIcons";

const EMPRESA = [{ href: "/raci", label: "Matriz RACI", icon: IconRaci }];

const OPERACAO = [
  { href: "/painel", label: "Painel", icon: IconPainel },
  { href: "/planejamento", label: "Planejamento", icon: IconPlanejamento },
  { href: "/kanban", label: "Kanban", icon: IconKanban },
  { href: "/gantt", label: "Gantt", icon: IconGantt },
  { href: "/rdo", label: "RDO", icon: IconRdo },
  { href: "/custos", label: "Custos", icon: IconCustos },
];

const CADASTROS = [
  { href: "/obras", label: "Obras", icon: IconObras },
  { href: "/equipe", label: "Equipe", icon: IconEquipe },
  { href: "/relatorios", label: "Relatórios", icon: IconRelatorios },
];

function NavGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: typeof OPERACAO;
  pathname: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand/15 font-medium text-brand"
                  : "text-neutral-300 hover:bg-ink-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 px-3 py-5">
      <div className="mb-8 flex items-center gap-2 px-2">
        <Image src="/logo-steelnova.png" alt="SteelNova" width={32} height={32} className="rounded" />
        <div>
          <p className="text-sm font-semibold text-white">Obra SteelNova</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavGroup title="Empresa" items={EMPRESA} pathname={pathname} />
        <NavGroup title="Operação" items={OPERACAO} pathname={pathname} />
        <NavGroup title="Cadastros" items={CADASTROS} pathname={pathname} />
      </div>

      <p className="px-2 text-[11px] text-neutral-600">Dados sincronizados entre a equipe.</p>
    </aside>
  );
}
