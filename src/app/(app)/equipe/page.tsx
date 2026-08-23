import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  ENGENHEIRO: "Engenheiro",
  MESTRE_OBRA: "Mestre de obra",
  VISUALIZADOR: "Visualizador",
};

export default async function EquipePage() {
  const usuarios = await prisma.user.findMany({
    where: { active: true },
    include: { obras: { include: { obra: { select: { nome: true } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <TopBar title="Equipe" subtitle="Pessoas da SteelNova" />

      <div className="p-6">
        <div className="overflow-x-auto rounded-xl border border-ink-800">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Perfil</th>
                <th className="px-4 py-3 font-medium">Obras</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-ink-800">
                  <td className="px-4 py-3 text-white">{u.name}</td>
                  <td className="px-4 py-3 text-neutral-400">{u.email}</td>
                  <td className="px-4 py-3 text-neutral-400">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {u.obras.length === 0 ? "—" : u.obras.map((o) => o.obra.nome).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
