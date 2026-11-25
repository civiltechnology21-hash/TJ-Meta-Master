import { BRAND } from "@/lib/brand.generated";

/**
 * The picture of the brand name (public/brand-name.png).
 * If public/brand-name-light.png also exists, it is shown instead in the light theme
 * (CSS switches them, so there is no flash and no script). Without it, one picture is used
 * in both themes. Only call this when BRAND.name is set.
 */
export function BrandNameImage({ alt, className }: { alt: string; className?: string }) {
  if (!BRAND.name) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND.name}
        alt={alt}
        className={BRAND.nameLight ? `brand-name-dark ${className ?? ""}` : className}
      />
      {BRAND.nameLight ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND.nameLight} alt="" aria-hidden="true" className={`brand-name-light ${className ?? ""}`} />
      ) : null}
    </>
  );
}
