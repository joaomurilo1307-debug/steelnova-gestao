"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import SignOutButton from "@/components/SignOutButton";
import Avatar from "@/components/Avatar";

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data: session } = useSession();
  const readOnly = session?.user && (session.user as any).role === "VISUALIZADOR";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/usuarios/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => setAvatarUrl(u?.avatarUrl ?? null));
  }, [session?.user]);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950 px-4 py-3 sm:px-6 sm:py-4">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-fg sm:text-lg">{title}</h1>
        {subtitle && <p className="truncate text-xs text-neutral-500 sm:text-sm">{subtitle}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {readOnly && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Só leitura
          </span>
        )}
        {session?.user && (
          <div className="flex items-center gap-2 rounded-full bg-ink-800 py-1 pl-1 pr-1 text-sm text-fg sm:pr-3">
            <Avatar name={session.user.name ?? "?"} photoUrl={avatarUrl} size={24} />
            <span className="hidden sm:inline">{session.user.name}</span>
          </div>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
