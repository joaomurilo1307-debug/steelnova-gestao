"use client";

import { useEffect, useState } from "react";
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
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
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
  const [open, setOpen] = useState(false);

  // fecha o menu ao trocar de página (clicar num link)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Barra superior — só no celular */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-3 border-b border-ink-800 bg-ink-950 px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-fg hover:bg-ink-800"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-steelnova.png" alt="SteelNova Engenharia" style={{ height: 24, width: "auto" }} />
      </div>

      {/* Fundo escuro quando o menu está aberto (celular) */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar: drawer no celular, fixa no desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-950 px-3 py-5 transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-steelnova.png" alt="SteelNova Engenharia" style={{ height: 30, width: "auto" }} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-ink-800 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
          <NavGroup title="Operação" items={OPERACAO} pathname={pathname} />
          <NavGroup title="Comercial" items={COMERCIAL} pathname={pathname} />
          <NavGroup title="RH" items={RH} pathname={pathname} />
          <NavGroup title="Empresa" items={EMPRESA} pathname={pathname} />
        </div>

        <p className="px-2 text-[11px] text-neutral-600">Dados sincronizados entre a equipe.</p>
      </aside>
    </>
  );
}
