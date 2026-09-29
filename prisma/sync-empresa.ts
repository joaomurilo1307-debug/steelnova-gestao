import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Estado atual da empresa (recomeço) — idempotente: pode rodar em todo deploy.
// Obras NOVAS a garantir (por nome exato). Fase 1 e Fase 2 são tratadas à parte (só concluir).
const OBRAS_NOVAS = [
  { nome: "MD Predial — CDI (Mezanino)", cliente: "MD Predial", valorContrato: 20000, prazoPrevistoDias: 14, status: "CONCLUIDA", progresso: 100 },
  { nome: "Ronan — Ajustes (aguardando pagamento)", cliente: "Ronan", valorContrato: 2300, prazoPrevistoDias: 5, status: "CONCLUIDA", progresso: 100 },
  { nome: "Postim Energy", cliente: "MD Predial", valorContrato: 18000, prazoPrevistoDias: 10, status: "EM_ANDAMENTO", progresso: 0 },
  { nome: "Quadra Pedreira", cliente: "AQ Engenharia", valorContrato: 30000, prazoPrevistoDias: 20, status: "EM_ANDAMENTO", progresso: 0 },
  { nome: "Gradis — Gem Locações", cliente: "Gem Locação de Imóveis", valorContrato: 7500, prazoPrevistoDias: 10, status: "EM_ANDAMENTO", progresso: 0 },
  { nome: "Corrimão — MD Predial", cliente: "MD Predial", valorContrato: 7500, prazoPrevistoDias: 10, status: "EM_ANDAMENTO", progresso: 0 },
  { nome: "Skimo", cliente: "Skimo", valorContrato: 1000, prazoPrevistoDias: 5, status: "EM_ANDAMENTO", progresso: 0 },
  { nome: "Posto Pires", cliente: "Família Pires", valorContrato: 0, prazoPrevistoDias: 20, status: "PLANEJAMENTO", progresso: 0 },
  { nome: "Rubberbras", cliente: "Rubberbras", valorContrato: 0, prazoPrevistoDias: 90, status: "PLANEJAMENTO", progresso: 0 },
  { nome: "Reformas / Expansão", cliente: "A definir", valorContrato: 0, prazoPrevistoDias: 30, status: "PLANEJAMENTO", progresso: 0 },
];

const FUNCIONARIOS = ["Ivo", "Mica", "Pablo", "Fernando"];

async function main() {
  const hoje = new Date();

  // 1) Remover a obra do hospital (HNSD / Irmandade N.S. das Dores) — "nem existiu"
  const del = await prisma.obra.deleteMany({
    where: {
      OR: [
        { nome: { contains: "HNSD", mode: "insensitive" } },
        { nome: { contains: "Irmandade", mode: "insensitive" } },
        { nome: { contains: "Dores", mode: "insensitive" } },
      ],
    },
  });
  console.log(`[sync] HNSD removidas: ${del.count}`);

  // 2) Concluir MD Predial Fase 1 e Fase 2 (sem mexer em valor/nome)
  const conc = await prisma.obra.updateMany({
    where: { nome: { contains: "Fase", mode: "insensitive" } },
    data: { status: "CONCLUIDA" as any, progresso: 100 },
  });
  console.log(`[sync] Fases concluídas: ${conc.count}`);

  // 3) Garantir as obras novas (cria se não existir por nome exato)
  for (const o of OBRAS_NOVAS) {
    const ex = await prisma.obra.findFirst({ where: { nome: o.nome } });
    if (ex) {
      await prisma.obra.update({
        where: { id: ex.id },
        data: { cliente: o.cliente, valorContrato: o.valorContrato, status: o.status as any, prazoPrevistoDias: o.prazoPrevistoDias, progresso: o.progresso },
      });
      console.log(`[sync] obra atualizada: ${o.nome}`);
    } else {
      await prisma.obra.create({
        data: { nome: o.nome, cliente: o.cliente, valorContrato: o.valorContrato, status: o.status as any, dataInicio: hoje, prazoPrevistoDias: o.prazoPrevistoDias, progresso: o.progresso },
      });
      console.log(`[sync] obra criada: ${o.nome}`);
    }
  }

  // 4) Funcionários novos
  for (const nome of FUNCIONARIOS) {
    const ex = await prisma.funcionario.findFirst({ where: { nome } });
    if (!ex) {
      await prisma.funcionario.create({ data: { nome, regime: "Diaria" } });
      console.log(`[sync] funcionário criado: ${nome}`);
    }
  }

  // 5) Caixa (R$ 8.000) — só lança uma vez
  const cx = await prisma.lancamentoFinanceiro.findFirst({ where: { descricao: "Saldo em caixa" } });
  if (!cx) {
    await prisma.lancamentoFinanceiro.create({
      data: { tipo: "ENTRADA", descricao: "Saldo em caixa", valor: 8000, data: hoje },
    });
    console.log(`[sync] caixa lançado: R$ 8.000`);
  }

  console.log("[sync] SYNC EMPRESA OK");
}

main()
  .catch((e) => {
    console.error("[sync] erro:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
