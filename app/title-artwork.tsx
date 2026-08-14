import Image from "next/image";
import type { CSSProperties } from "react";

import { getTitleArtwork, TITLE_ARTWORK_DISCLOSURE_AR } from "@/lib/title-artwork";

import styles from "./title-artwork.module.css";

export default function TitleArtwork({
  titleId,
  className = "",
  sizes = "160px",
  priority = false,
  showDisclosure = false,
  fallback = false,
}: {
  titleId: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  showDisclosure?: boolean;
  fallback?: boolean;
}) {
  const artwork = getTitleArtwork(titleId);
  if (!artwork && !fallback) return null;

  const style = artwork ? ({ "--artwork-color": artwork.dominantColor } as CSSProperties) : undefined;
  return (
    <figure className={`${styles.frame}${className ? ` ${className}` : ""}`} style={style}>
      {artwork ? (
        <Image
          className={styles.image}
          src={artwork.src}
          alt={artwork.altAr}
          width={720}
          height={960}
          sizes={sizes}
          priority={priority}
          unoptimized
        />
      ) : <span className={styles.fallback}>لا يوجد غلاف توضيحي متاح بعد</span>}
      {artwork && showDisclosure ? <figcaption className={styles.label}>{TITLE_ARTWORK_DISCLOSURE_AR}</figcaption> : null}
    </figure>
  );
}
