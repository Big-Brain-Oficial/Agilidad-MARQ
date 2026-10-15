// Logo de MARQ Experience (wordmark). Se usa en el panel del mapa y en el HUD 3D.
// El SVG vive en public/brand para que lo sirva Next y también lo lea la preview (og:image).

export function BrandLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- SVG estático con tamaño fijo por CSS; no necesita next/image.
  return <img className={className} src="/brand/marq-experience.svg" alt="MARQ Experience" />;
}
