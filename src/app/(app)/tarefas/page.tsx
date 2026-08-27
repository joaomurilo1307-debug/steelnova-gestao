"use client";

import { useState } from "react";
import TopBar from "@/components/TopBar";
import TarefasTodas from "@/components/TarefasTodas";
import RotinasLista from "@/components/RotinasLista";

export default function TarefasPage() {
  const [aba, setAba] = useState<"kanban" | "lista">("kanban");

  return (
    <div>
      <TopBar title="Tarefas" subtitle={aba === "kanban" ? "Kanban de todas as obras" : "Rotina / vida pessoal"} />
      <div className="flex gap-1 border-b border-ink-800 px-8">
        <button
          onClick={() => setAba("kanban")}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
            aba === "kanban" ? "border-brand text-fg" : "border-transparent text-neutral-500 hover:text-fg"
          }`}
        >
          Kanban (obras)
        </button>
        <button
          onClick={() => setAba("lista")}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
            aba === "lista" ? "border-brand text-fg" : "border-transparent text-neutral-500 hover:text-fg"
          }`}
        >
          Lista (rotina/pessoal)
        </button>
      </div>
      {aba === "kanban" ? <TarefasTodas /> : <RotinasLista />}
    </div>
  );
}
