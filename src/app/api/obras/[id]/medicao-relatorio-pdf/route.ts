import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMedicaoData } from "@/lib/medicao";
import { getCurvaSData } from "@/lib/curvaS";
import { formatBRL } from "@/lib/format";

// Dados jurídicos reais da SteelNova (confirmados pelo João em 26/08/2026). A chave PIX é
// placeholder até ele passar a real — nunca inventar uma chave.
const EMPRESA = {
  nomeFantasia: "SteelNova Engenharia",
  razaoSocial: "LCS LTDA",
  cnpj: "64.795.338/0001-60",
};
const PIX_CHAVE = "[CHAVE PIX A DEFINIR]";
const PIX_BANCO = "[BANCO / AGÊNCIA / CONTA A DEFINIR]";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;

function fmtData(d: string | Date) {
  const iso = typeof d === "string" ? d : d.toISOString();
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR");
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [obra, medicao, curva, medicoes] = await Promise.all([
    prisma.obra.findUnique({ where: { id: params.id }, select: { nome: true, cliente: true, endereco: true, valorContrato: true } }),
    getMedicaoData(params.id),
    getCurvaSData(params.id),
    prisma.medicao.findMany({ where: { obraId: params.id }, orderBy: { data: "asc" } }),
  ]);
  if (!obra) return NextResponse.json({ error: "obra não encontrada" }, { status: 404 });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Relatório de Medição — ${obra.nome}`);
  pdf.setAuthor(EMPRESA.nomeFantasia);

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logoImg = null as Awaited<ReturnType<typeof pdf.embedPng>> | null;
  try {
    const logoBytes = await fs.readFile(path.join(process.cwd(), "public", "logo-steelnova.png"));
    logoImg = await pdf.embedPng(logoBytes);
  } catch {
    // segue sem logo se o arquivo não existir no ambiente
  }

  const black = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.45, 0.45, 0.48);
  const brand = rgb(0.91, 0.5, 0.17); // laranja SteelNova (#E8802B)
  const amber = rgb(0.7, 0.45, 0.05);
  const lineGray = rgb(0.85, 0.85, 0.87);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageNum = 1;

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    pageNum++;
  }

  // fecha (rodapé) a página atual antes de abrir a próxima — cada página leva exatamente
  // um rodapé: a última é fechada pela chamada explícita no fim da função.
  function ensureSpace(h: number) {
    if (y - h < MARGIN + 24) {
      drawFooter();
      newPage();
    }
  }

  function text(str: string, x: number, size: number, opts?: { bold?: boolean; color?: ReturnType<typeof rgb> }) {
    page.drawText(str, {
      x,
      y,
      size,
      font: opts?.bold ? fontBold : fontRegular,
      color: opts?.color ?? black,
    });
  }

  function line(yy: number) {
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: PAGE_W - MARGIN, y: yy }, thickness: 0.75, color: lineGray });
  }

  function drawFooter() {
    page.drawText(`SteelNova Gestão · Relatório de Medição · pág. ${pageNum}`, {
      x: MARGIN,
      y: 24,
      size: 7.5,
      font: fontRegular,
      color: gray,
    });
  }

  // ---- Cabeçalho ----
  if (logoImg) {
    const w = 90;
    const h = (logoImg.height / logoImg.width) * w;
    page.drawImage(logoImg, { x: MARGIN, y: y - h + 10, width: w, height: h });
  }
  text("RELATÓRIO DE MEDIÇÃO", PAGE_W - MARGIN - 220, 16, { bold: true, color: brand });
  y -= 18;
  text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, PAGE_W - MARGIN - 220, 9, { color: gray });
  y -= 40;

  text(`${EMPRESA.razaoSocial} (${EMPRESA.nomeFantasia})`, MARGIN, 10, { bold: true });
  y -= 13;
  text(`CNPJ ${EMPRESA.cnpj}`, MARGIN, 9, { color: gray });
  y -= 22;
  line(y);
  y -= 20;

  // ---- Dados da obra ----
  text("OBRA", MARGIN, 9, { bold: true, color: gray });
  y -= 14;
  text(obra.nome, MARGIN, 12, { bold: true });
  y -= 16;
  text(`Cliente: ${obra.cliente}`, MARGIN, 9.5);
  y -= 13;
  if (obra.endereco) {
    text(`Endereço: ${obra.endereco}`, MARGIN, 9.5);
    y -= 13;
  }
  y -= 10;
  line(y);
  y -= 22;

  // ---- Resumo financeiro ----
  const totalMedido = medicoes.reduce((s, m) => s + Number(m.valor), 0);
  const valorContrato = Number(obra.valorContrato);
  const pctMedido = valorContrato > 0 ? (totalMedido / valorContrato) * 100 : 0;
  const saldo = valorContrato - totalMedido;

  text("RESUMO FINANCEIRO", MARGIN, 9, { bold: true, color: gray });
  y -= 16;
  const cardW = (PAGE_W - MARGIN * 2 - 24) / 4;
  const cards: [string, string][] = [
    ["Valor do contrato", formatBRL(valorContrato)],
    ["Total medido", formatBRL(totalMedido)],
    ["% medido", `${pctMedido.toFixed(1)}%`],
    ["Saldo a medir", formatBRL(saldo)],
  ];
  cards.forEach(([label, value], i) => {
    const x = MARGIN + i * (cardW + 8);
    text(label, x, 8, { color: gray });
    page.drawText(value, { x, y: y - 15, size: 12, font: fontBold, color: i === 3 && saldo < 0 ? rgb(0.75, 0.15, 0.15) : black });
  });
  y -= 40;

  if (curva) {
    text(
      `Curva S — previsto ${curva.pctPrevistoHoje.toFixed(1)}% (hoje) × realizado ${curva.pctRealizadoAtual.toFixed(1)}%  ·  desvio ${
        curva.desvio >= 0 ? "+" : ""
      }${curva.desvio.toFixed(1)} p.p.`,
      MARGIN,
      9.5,
      { color: curva.desvio >= 0 ? rgb(0.05, 0.45, 0.25) : rgb(0.75, 0.15, 0.15) }
    );
    y -= 22;
  }
  line(y);
  y -= 20;

  // ---- Tabela por serviço ----
  text("MEDIÇÃO POR SERVIÇO (ponderada pelo valor)", MARGIN, 9, { bold: true, color: gray });
  y -= 16;

  const cols = [
    { label: "Serviço", w: 190 },
    { label: "Qtd.", w: 65 },
    { label: "Valor serviço", w: 75 },
    { label: "Insumos cli.", w: 65 },
    { label: "% concl.", w: 45 },
    { label: "Valor medido", w: 75 },
  ];
  function tableHeader() {
    let x = MARGIN;
    for (const c of cols) {
      text(c.label, x, 8.5, { bold: true, color: gray });
      x += c.w;
    }
    y -= 12;
    line(y);
    y -= 12;
  }
  tableHeader();
  for (const l of medicao.linhas) {
    ensureSpace(16);
    let x = MARGIN;
    const cells = [
      l.nome.length > 42 ? l.nome.slice(0, 40) + "…" : l.nome,
      `${l.baseQtd.toLocaleString("pt-BR")} ${l.unidade}`,
      formatBRL(l.valor),
      l.insumosCliente > 0 ? formatBRL(l.insumosCliente) : "—",
      `${l.pctConcluido.toFixed(0)}%`,
      formatBRL((l.valor * l.pctConcluido) / 100),
    ];
    cells.forEach((c, i) => {
      text(c, x, 9, { color: i === 3 ? amber : black });
      x += cols[i].w;
    });
    y -= 15;
  }
  ensureSpace(18);
  line(y + 4);
  y -= 6;
  text(`Total serviços (SteelNova): ${formatBRL(medicao.valorTotalServicos)}`, MARGIN, 9, { bold: true });
  y -= 13;
  if (medicao.valorInsumosCliente > 0) {
    text(`+ ${formatBRL(medicao.valorInsumosCliente)} em insumos por conta do cliente (fora do preço acima)`, MARGIN, 8.5, { color: amber });
    y -= 13;
  }
  y -= 12;
  line(y);
  y -= 20;

  // ---- Medições lançadas ----
  ensureSpace(60);
  text("MEDIÇÕES LANÇADAS", MARGIN, 9, { bold: true, color: gray });
  y -= 16;
  if (medicoes.length === 0) {
    text("Nenhuma medição lançada ainda.", MARGIN, 9, { color: gray });
    y -= 15;
  } else {
    const mCols = [
      { label: "Nº", w: 30 },
      { label: "Data", w: 70 },
      { label: "Descrição", w: 280 },
      { label: "Valor", w: 90 },
    ];
    let x = MARGIN;
    for (const c of mCols) {
      text(c.label, x, 8.5, { bold: true, color: gray });
      x += c.w;
    }
    y -= 12;
    line(y);
    y -= 12;
    let acumulado = 0;
    for (const m of medicoes) {
      ensureSpace(16);
      acumulado += Number(m.valor);
      x = MARGIN;
      const desc = (m.descricao ?? "—").slice(0, 60);
      const cells = [String(m.numero), fmtData(m.data), desc, formatBRL(Number(m.valor))];
      cells.forEach((c, i) => {
        text(c, x, 9);
        x += mCols[i].w;
      });
      y -= 15;
    }
  }
  y -= 10;
  line(y);
  y -= 22;

  // ---- Dados para pagamento ----
  ensureSpace(90);
  text("DADOS PARA PAGAMENTO", MARGIN, 9, { bold: true, color: gray });
  y -= 16;
  text(`Favorecido: ${EMPRESA.razaoSocial} (${EMPRESA.nomeFantasia})`, MARGIN, 9.5);
  y -= 14;
  text(`CNPJ: ${EMPRESA.cnpj}`, MARGIN, 9.5);
  y -= 14;
  text(`Chave PIX: ${PIX_CHAVE}`, MARGIN, 9.5, { color: amber });
  y -= 14;
  text(`Dados bancários: ${PIX_BANCO}`, MARGIN, 9.5, { color: amber });
  y -= 20;
  text("* Dados de pagamento genéricos — substituir pelos dados reais antes de enviar ao cliente.", MARGIN, 7.5, { color: gray });

  drawFooter();

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-medicao-${obra.nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf"`,
    },
  });
}
