import Image from "next/image"
import styles from "./BannerPromo.module.css"

export function BannerPromo() {
  return (
    <div className={styles.bannerPromo}>
      <Image
        src="/promo-banner1824x254.png"
        alt="Promoção ProBar"
        width={2784}
        height={384}
        priority
        sizes="(max-width: 768px) 100vw, 920px"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
        }}
      />
    </div>
  )
}
