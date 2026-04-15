/**
 * Favicon SVG 192×192: remove o preto do mark via filtro (luminance → alpha),
 * referência ao PNG em /public (sem base64 gigante).
 */
const ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="192" height="192" viewBox="0 0 192 192">
  <defs>
    <filter id="loopsale-lum" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="a"/>
      <feComposite in="SourceGraphic" in2="a" operator="in"/>
    </filter>
  </defs>
  <image
    xlink:href="/brand/loopsale-mark.png"
    href="/brand/loopsale-mark.png"
    x="12" y="12" width="168" height="168"
    preserveAspectRatio="xMidYMid meet"
    filter="url(#loopsale-lum)"
  />
</svg>`;

export default function Icon() {
  return new Response(ICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control":
        process.env.NODE_ENV === "development"
          ? "no-cache, no-store"
          : "public, max-age=86400, s-maxage=86400",
    },
  });
}
