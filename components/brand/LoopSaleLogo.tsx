import Image from "next/image";
import Link from "next/link";

type LoopSaleLogoProps = {
  /** Se omitido ou string vazia, renderiza sem link */
  href?: string | null;
  variant?: "full" | "mark";
  className?: string;
  /**
   * Sobrescreve as classes da imagem (tamanho/ajuste). Útil em barras baixas,
   * como o header do LoopChat, onde a altura padrão é grande demais.
   */
  imgClassName?: string;
};

export function LoopSaleLogo({
  href = "/",
  variant = "full",
  className = "",
  imgClassName,
}: LoopSaleLogoProps) {
  const isMark = variant === "mark";

  const content = isMark ? (
    <span
      className="loopsale-mark-icon"
      role="img"
      aria-label="LoopSale"
    />
  ) : (
    <span className="inline-flex items-center">
      <Image
        src="/brand/loopsale-logo-transparent.png"
        alt="LoopSale"
        width={800}
        height={180}
        className={
          imgClassName ??
          "h-[104px] w-auto max-h-[120px] max-w-[min(100%,560px)] object-contain object-left sm:h-[120px] sm:max-w-[min(100%,720px)]"
        }
        priority
        unoptimized
      />
    </span>
  );

  if (href === null || href === "") {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
