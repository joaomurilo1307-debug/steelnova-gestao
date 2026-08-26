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
function num(v: any): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
function mapTurno(v: any) {
  const n = norm(v);
  return n.includes("noite") ? "Noite" : "Dia";
}
function mapStatus(v: any) {
  const n = norm(v);
  if (n.includes("bloq")) return "BLOQUEADO";
  if (n.includes("feito") || n.includes("conclu")) return "FEITO";
  if (n.includes("fazendo") || n.includes("andamento")) return "FAZENDO";
  return "A_FAZER";
}

export default function PlanejamentoImport({ obraId }: { obraId: string }) {
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
      const nome = wb.SheetNames.find((s) => norm(s).includes("planejamento")) ?? wb.SheetNames[0];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: "" });
      if (rows.length === 0) {
        setMsg("Planilha vazia — não achei nenhuma linha na aba de planejamento.");
        return;
      }
      const h = Object.keys(rows[0]);
      const colNum = acha(h, ["nº", "n", "numero", "número", "eap"]);
      const colFase = acha(h, ["fase", "bloco"]);
      const colTitulo = acha(h, ["atividade", "atividade / passo", "titulo", "título", "tarefa"]);
      const colDias = acha(h, ["dias", "dias (dur.)", "duracao", "duração"]);
      const colPessoas = acha(h, ["pessoas"]);
      const colHoras = acha(h, ["horas"]);
      const colTurno = acha(h, ["turno"]);
      const colInicio = acha(h, ["inicio", "início", "data inicio", "data início"]);
      const colResp = acha(h, ["responsavel", "responsável", "responsavel / equipe", "responsável / equipe"]);
      const colPred = acha(h, ["pred", "pred.", "predecessora", "predecessor"]);
      const colStatus = acha(h, ["status"]);
      const colObs = acha(h, ["observacoes", "observações", "obs"]);

      if (!colTitulo) {
        setMsg('Não achei a coluna de atividade. A planilha precisa de uma coluna "Atividade".');
        return;
      }

      // 1ª passada: cria as tarefas, guardando o Nº/EAP -> id criado (pra ligar predecessora depois)
      const porEap = new Map<string, string>();
      const linhas = rows
        .map((r) => ({
          eap: colNum ? String(r[colNum] ?? "").trim() : "",
          fase: colFase ? String(r[colFase] ?? "").trim() || undefined : undefined,
          titulo: String(r[colTitulo] ?? "").trim(),
          duracaoDias: colDias ? num(r[colDias]) : undefined,
          pessoas: colPessoas ? num(r[colPessoas]) : undefined,
          horas: colHoras ? num(r[colHoras]) : undefined,
          turno: colTurno ? mapTurno(r[colTurno]) : undefined,
          dataInicio: colInicio ? excelData(r[colInicio]) : undefined,
          responsavelNome: colResp ? String(r[colResp] ?? "").trim() || undefined : undefined,
          predecessoraEap: colPred ? String(r[colPred] ?? "").trim() : "",
          status: colStatus ? mapStatus(r[colStatus]) : undefined,
          observacoes: colObs ? String(r[colObs] ?? "").trim() || undefined : undefined,
        }))
        .filter((l) => l.titulo);

      let criadas = 0;
      let falhas = 0;
      const criadasComPred: { id: string; predecessoraEap: string }[] = [];
      for (const l of linhas) {
        const res = await fetch("/api/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            obraId,
            eap: l.eap || undefined,
            fase: l.fase,
            titulo: l.titulo,
            duracaoDias: l.duracaoDias,
            pessoas: l.pessoas,
            horas: l.horas,
            turno: l.turno,
            dataInicio: l.dataInicio,
            responsavelNome: l.responsavelNome,
            status: l.status,
            observacoes: l.observacoes,
          }),
        });
        if (res.ok) {
          criadas++;
          const tarefa = await res.json();
          if (l.eap) porEap.set(l.eap, tarefa.id);
          if (l.predecessoraEap) criadasComPred.push({ id: tarefa.id, predecessoraEap: l.predecessoraEap });
        } else {
          falhas++;
        }
      }

      // 2ª passada: liga as predecessoras pelo Nº/EAP (só entre linhas desta mesma importação)
      let ligadas = 0;
      for (const { id, predecessoraEap } of criadasComPred) {
        const predId = porEap.get(predecessoraEap);
        if (!predId) continue;
        const pr = await fetch(`/api/tarefas/${id}/dependencias`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ predecessoraId: predId }),
        });
        if (pr.ok) ligadas++;
      }

      setMsg(
        `Importado: ${criadas} atividade(s)` +
          (falhas > 0 ? `, ${falhas} falharam` : "") +
          (ligadas > 0 ? `, ${ligadas} predecessora(s) ligada(s)` : "") +
          "."
      );
      router.refresh();
    } catch (err: any) {
      setMsg("Erro ao ler a planilha: " + (err?.message ?? String(err)));
    } finally {
      setImportando(false);
    }
  }

  function baixarModelo() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          "Nº": "1", "Fase": "Preparação", "Atividade": "Medidas gerais, reconhecimento em loco",
          "Dias": 1, "Pessoas": 2, "Horas": 4, "Turno": "Dia", "Início": "26/08/2026",
          "Responsável": "Gustavo/Lucas", "Pred.": "", "Status": "A fazer", "Observações": "",
        },
        {
          "Nº": "2", "Fase": "Fabricação", "Atividade": "Corte e solda dos perfis",
          "Dias": 15, "Pessoas": 2, "Horas": 8, "Turno": "Dia", "Início": "27/08/2026",
          "Responsável": "Passabém + Nando", "Pred.": "1", "Status": "A fazer", "Observações": "",
        },
        {
          "Nº": "3", "Fase": "Montagem", "Atividade": "Montagem completa em obra",
          "Dias": 20, "Pessoas": 3, "Horas": 8, "Turno": "Dia", "Início": "", "Responsável": "Mika, Ivo, Nando",
          "Pred.": "2", "Status": "A fazer", "Observações": "",
        },
      ]),
      "Planejamento"
    );
    const ws2 = wb.Sheets["Planejamento"];
    ws2["!cols"] = [
      { wch: 4 }, { wch: 14 }, { wch: 42 }, { wch: 6 }, { wch: 8 }, { wch: 7 },
      { wch: 7 }, { wch: 12 }, { wch: 20 }, { wch: 6 }, { wch: 10 }, { wch: 24 },
    ];
    XLSX.writeFile(wb, "modelo-planejamento-steelnova.xlsx");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-sm ${importando ? "opacity-60" : ""}`}>
        {importando ? "Importando..." : "📥 Importar planejamento (Excel)"}
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importando} />
      </label>
      <button onClick={baixarModelo} className="btn-ghost px-3 py-1.5 text-sm">
        Baixar modelo
      </button>
      {msg && <span className="text-xs text-neutral-500">{msg}</span>}
    </div>
  );
}
