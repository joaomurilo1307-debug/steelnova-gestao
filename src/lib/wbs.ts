export type WithParent = { id: string; tarefaMaeId?: string | null };

export type WbsRow<T> = { tarefa: T; depth: number; wbs: string };

// Numeração hierárquica estilo WBS (1, 1.1, 1.2, 2, 2.1...) — mesma ordem de inserção dos irmãos.
// Porta direta de src/lib/wbs.ts do consominas-gestao (mesmo algoritmo, campo tarefaMaeId em vez de parentTaskId).
export function buildWbsHierarchy<T extends WithParent>(tarefas: T[]): WbsRow<T>[] {
  const idSet = new Set(tarefas.map((t) => t.id));
  const byParent = new Map<string | null, T[]>();
  for (const t of tarefas) {
    const key = t.tarefaMaeId && idSet.has(t.tarefaMaeId) ? t.tarefaMaeId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  const result: WbsRow<T>[] = [];
  function walk(parentId: string | null, prefix: string) {
    const siblings = byParent.get(parentId) ?? [];
    siblings.forEach((t, i) => {
      const wbs = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      const depth = wbs.split(".").length - 1;
      result.push({ tarefa: t, depth, wbs });
      walk(t.id, wbs);
    });
  }
  walk(null, "");
  return result;
}
