import { getProjectMonogram } from "@/lib/projects/shared";

export function ProjectAvatar({
  name,
  brandName,
  logoUrl,
  sizeClassName = "size-14 rounded-[1.25rem]",
}: {
  name: string;
  brandName?: string | null;
  logoUrl?: string | null;
  sizeClassName?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`${sizeClassName} border border-white/75 object-cover shadow-[0_16px_28px_rgba(17,39,63,0.1)]`}
      />
    );
  }

  return (
    <span
      className={`flex ${sizeClassName} items-center justify-center border border-white/78 bg-[linear-gradient(180deg,rgba(215,237,247,0.92),rgba(255,255,255,0.84))] font-mono text-sm uppercase tracking-[0.2em] text-accent-foreground shadow-[0_16px_28px_rgba(17,39,63,0.08)]`}
    >
      {getProjectMonogram({ name, brand_name: brandName ?? null })}
    </span>
  );
}
