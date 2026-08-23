const PALETTE = [
  "#0f766e", // teal
  "#b45309", // amber
  "#7c3aed", // violet
  "#be123c", // rose
  "#1d4ed8", // blue
  "#15803d", // green
  "#c2410c", // orange
  "#4338ca", // indigo
  "#a16207", // yellow-brown
  "#0e7490", // cyan
];

export function personColor(id: string | null | undefined): string {
  if (!id) return "#6b6459";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
