"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

// [̀-ͯ] montado por fromCharCode pra não depender de caractere combinante no fonte
const DIACRITICOS = new RegExp(String.fromCharCode(91, 92, 117, 48, 51, 48, 48, 45, 92, 117, 48, 51, 54, 102, 93), "g");
function norm(s: any) {
  return String(s ?? "").trim().normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}
function acha(headers: string[], cands: string[]) {
  const nh = headers.map(norm);
  for (const c of cands) {
    const i = nh.indexOf(norm(c));
    if (i >= 0) return headers[i];
  }
  return null;
}
function excelData(v: any): string | undefined {
  if (v === "" || v == null) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}
function hhmm(v: any): string | undefined {
  if (v === "" || v == null) return undefined;
  if (v instanceof Date) return `${String(v.getHours()).padStart(2, "0")}:${String(v.getMinutes()).padStart(2, "0")}`;
  if (typeof v === "number") {
    const mins = Math.round(v * 24 * 60);
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
}
function mapClima(v: string) {
  const n = norm(v);
  if (n.includes("nubl")) return "NUBLADO";
  if (n.includes("chuv")) return "CHUVA";
  if (n.includes("ruim") || n.includes("tempestade")) return "TEMPO_RUIM";
  return "SOL";
}
function rowsDe(wb: XLSX.WorkBook, nomes: string[]): Record<string, any>[] {
  const nome = wb.SheetNames.find((s) => nomes.some((n) => norm(s) === norm(n) || norm(s).includes(norm(n))));
  if (!nome) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: "" });
}

export default function RdoImport({ obraId }: { obraId: string }) {
  const router = useRouter();
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportando(true);
    setMsg(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });

      // Cabeçalho do RDO (aba "RDO")
      const cab = rowsDe(wb, ["RDO", "Cabeçalho", "Ficha"])[0] ?? {};
      const ch = Object.keys(cab);
      const colData = acha(ch, ["data"]);
      const colClima = acha(ch, ["clima", "tempo"]);
      const colIni = acha(ch, ["horário início", "horario inicio", "início", "inicio"]);
      const colFim = acha(ch, ["horário término", "horario termino", "término", "termino", "fim"]);
      const colObs = acha(ch, ["observações", "observacoes", "obs"]);

      const data = colData ? excelData(cab[colData]) : undefined;
      if (!data) {
        setMsg('Não achei a data do RDO. Preencha "Data" na aba "RDO" (ex.: 26/08/2026).');
        return;
      }

      // Equipe
      const equipe = rowsDe(wb, ["Equipe", "Trabalhadores", "Mão de obra"]);
      const trabalhadores = equipe
        .map((r) => {
          const h = Object.keys(r);
          const nome = String(r[acha(h, ["nome"]) ?? ""] ?? "").trim();
          const funcao = String(r[acha(h, ["função", "funcao", "cargo"]) ?? ""] ?? "").trim() || "Ajudante";
          const entrada = hhmm(r[acha(h, ["entrada"]) ?? ""]);
          const saida = hhmm(r[acha(h, ["saída", "saida"]) ?? ""]);
          return { nome, funcao, entrada, saida };
        })
        .filter((t) => t.nome);

      // Atividades
      const ativs = rowsDe(wb, ["Atividades", "Serviços", "Servicos"]);
      const atividades = ativs
        .map((r) => {
          const h = Object.keys(r);
          const descricao = String(r[acha(h, ["descrição", "descricao", "atividade", "serviço", "servico"]) ?? ""] ?? "").trim();
          const sit = norm(r[acha(h, ["situação", "situacao", "status"]) ?? ""]);
          return { descricao, situacao: sit.includes("final") ? "FINALIZADA" : "PARCIAL" };
        })
        .filter((a) => a.descricao);

      // Pendências
      const pends = rowsDe(wb, ["Pendências", "Pendencias"]);
      const pendencias = pends
        .map((r) => {
          const h = Object.keys(r);
          const descricao = String(r[acha(h, ["descrição", "descricao", "pendência", "pendencia"]) ?? ""] ?? "").trim();
          const observacao = String(r[acha(h, ["observação", "observacao", "obs"]) ?? ""] ?? "").trim() || undefined;
          return { descricao, observacao };
        })
        .filter((p) => p.descricao);

      const body = {
        obraId,
        data,
        clima: mapClima(colClima ? String(cab[colClima]) : "Sol"),
        horarioInicio: colIni ? String(cab[colIni] ?? "").trim() || undefined : undefined,
        horarioTermino: colFim ? String(cab[colFim] ?? "").trim() || undefined : undefined,
        observacoes: colObs ? String(cab[colObs] ?? "").trim() || undefined : undefined,
        trabalhadores,
        atividades,
        pendencias,
      };

      const res = await fetch("/api/rdo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Alimenta as Diárias: cria lançamento de ponto pra cada trabalhador da ficha
        // que casa (pelo nome) com um funcionário cadastrado no RH e tem entrada+saída.
        let pontos = 0;
        try {
          const fRes = await fetch("/api/funcionarios");
          const funcs: { id: string; nome: string }[] = fRes.ok ? await fRes.json() : [];
          for (const t of trabalhadores) {
            if (!t.entrada || !t.saida) continue;
            const m = funcs.find(
              (f) => norm(f.nome) === norm(t.nome) || norm(f.nome).includes(norm(t.nome)) || norm(t.nome).includes(norm(f.nome))
            );
            if (!m) continue;
            const pr = await fetch("/api/ponto", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ obraId, funcionarioId: m.id, dia: data, entrada: t.entrada, saida: t.saida }),
            });
            if (pr.ok) pontos++;
          }
        } catch {}
        const semPonto = trabalhadores.length - pontos;
        setMsg(
          `RDO de ${data.split("-").reverse().join("/")} importado: ${atividades.length} atividade(s), ${pendencias.length} pendência(s). ` +
            `Diárias: ${pontos} ponto(s) lançado(s)` +
            (semPonto > 0 ? ` — ${semPonto} da equipe não casou com o RH (cadastre no RH pra virar diária).` : ".")
        );
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg("Não deu pra importar" + (err?.error?.includes?.("Unique") || res.status === 409 ? " — já existe um RDO nessa data." : "."));
      }
    } catch (err: any) {
      setMsg("Erro ao ler a ficha: " + (err?.message ?? String(err)));
    } finally {
      setImportando(false);
    }
  }

  function baixarModelo() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ Data: "26/08/2026", Clima: "Sol", "Horário início": "07:00", "Horário término": "17:00", "Observações": "" }]),
      "RDO"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Nome: "Gerson", "Função": "Encarregado", Entrada: "07:00", "Saída": "17:00" },
        { Nome: "Ajudante 1", "Função": "Ajudante", Entrada: "07:00", "Saída": "17:00" },
      ]),
      "Equipe"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { "Descrição": "Montagem das tesouras eixo 1-4", "Situação": "Parcial" },
        { "Descrição": "Solda das terças", "Situação": "Finalizada" },
      ]),
      "Atividades"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ "Descrição": "Faltou material X", "Observação": "cliente vai entregar amanhã" }]),
      "Pendências"
    );
    XLSX.writeFile(wb, "modelo-rdo-steelnova.xlsx");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-sm ${importando ? "opacity-60" : ""}`}>
        {importando ? "Importando..." : "📥 Importar ficha (Excel)"}
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importando} />
      </label>
      <button onClick={baixarModelo} className="btn-ghost px-3 py-1.5 text-sm">
        Baixar modelo
      </button>
      {msg && <span className="text-xs text-neutral-500">{msg}</span>}
    </div>
  );
}
