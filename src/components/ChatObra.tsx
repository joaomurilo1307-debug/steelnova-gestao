"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Mensagem = { id: string; texto: string; createdAt: string; autor: { id: string; name: string } };

export default function ChatObra({ obraId }: { obraId: string }) {
  const { data: session } = useSession();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/chat?obraId=${obraId}`);
    if (res.ok) setMensagens(await res.json());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const t = texto;
    setTexto("");
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, texto: t }),
    });
    load();
  }

  return (
    <div className="p-6">
      <div className="flex h-[60vh] flex-col rounded-xl border border-ink-800 bg-ink-900">
        <div className="flex-1 overflow-y-auto p-4">
          {mensagens.length === 0 && (
            <p className="text-center text-sm text-neutral-500">Nenhuma mensagem ainda — comece a conversa da obra.</p>
          )}
          <div className="flex flex-col gap-3">
            {mensagens.map((m) => {
              const minha = m.autor.id === (session?.user as any)?.id;
              return (
                <div key={m.id} className={`flex flex-col ${minha ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                      minha ? "bg-brand text-white" : "border border-ink-800 bg-ink-800 text-fg"
                    }`}
                  >
                    {!minha && <p className="mb-0.5 text-xs font-medium opacity-70">{m.autor.name}</p>}
                    <p>{m.texto}</p>
                  </div>
                  <span className="mt-0.5 text-[10px] text-neutral-500">
                    {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
          <div ref={fimRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-800 p-3">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma mensagem..."
            className="flex-1 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
