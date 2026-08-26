"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconInicio,
  IconPainel,
  IconObras,
  IconTarefas,
  IconCalendario,
  IconEquipe,
  IconRelatorios,
  IconRaci,
  IconCustos,
  IconPropostas,
} from "@/components/NavIcons";

const OPERACAO = [
  { href: "/inicio", label: "Início", icon: IconInicio },
  { href: "/painel", label: "Painel", icon: IconPainel },
  { href: "/obras", label: "Obras", icon: IconObras },
  { href: "/tarefas", label: "Tarefas (todas)", icon: IconTarefas },
  { href: "/calendario", label: "Calendário", icon: IconCalendario },
];

const COMERCIAL = [{ href: "/propostas", label: "Propostas", icon: IconPropostas }];

const RH = [{ href: "/rh", label: "Funcionários", icon: IconEquipe }];

const EMPRESA = [
  { href: "/financas", label: "Finanças", icon: IconCustos },
  { href: "/equipe", label: "Equipe (sócios)", icon: IconEquipe },
  { href: "/relatorios", label: "Relatórios", icon: IconRelatorios },
  { href: "/raci", label: "Matriz RACI", icon: IconRaci },
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
                  : "text-fg-muted hover:bg-ink-800 hover:text-fg"
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
      <div className="mb-8 flex items-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-steelnova.png" alt="SteelNova Engenharia" style={{ height: 30, width: "auto" }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavGroup title="Operação" items={OPERACAO} pathname={pathname} />
        <NavGroup title="Comercial" items={COMERCIAL} pathname={pathname} />
        <NavGroup title="RH" items={RH} pathname={pathname} />
        <NavGroup title="Empresa" items={EMPRESA} pathname={pathname} />
      </div>

      <p className="px-2 text-[11px] text-neutral-600">Dados sincronizados entre a equipe.</p>
    </aside>
  );
}
