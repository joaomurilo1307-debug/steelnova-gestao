"use client";

import { useSession } from "next-auth/react";
import SignOutButton from "@/components/SignOutButton";

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data: session } = useSession();
  const readOnly = session?.user && (session.user as any).role === "VISUALIZADOR";
  const initials = session?.user?.name
    ?.split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950 px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {readOnly && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Só leitura
          </span>
        )}
        {session?.user && (
          <div className="flex items-center gap-2 rounded-full bg-ink-800 py-1 pl-1 pr-3 text-sm text-white">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold">
              {initials}
            </span>
            {session.user.name}
          </div>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
