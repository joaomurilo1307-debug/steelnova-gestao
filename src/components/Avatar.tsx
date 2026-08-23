function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name,
  photoUrl,
  color,
  size = 24,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  color?: string;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photoUrl}
        alt={name}
        title={name}
        className={`inline-block shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size, boxShadow: color ? `0 0 0 2px ${color}` : undefined }}
      />
    );
  }
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: color ?? "#E8802B" }}
    >
      {initials(name || "?")}
    </span>
  );
}
