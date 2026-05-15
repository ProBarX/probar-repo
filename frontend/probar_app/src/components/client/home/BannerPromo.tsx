import Image from "next/image"

export function BannerPromo() {
  return (
    <div className="banner-promo">
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
      <style jsx>{`
        .banner-promo {
          background-color: #1a1a1a;
          border-radius: 12px;
          margin-bottom: 24px;
          overflow: hidden;
          width: 100%;
        }

        @media (max-width: 640px) {
          .banner-promo {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
