function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name,
  photoUrl,
  size = 24,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
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
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name || "?")}
    </span>
  );
}
