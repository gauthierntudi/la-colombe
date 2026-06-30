const AVATAR_PX = { lg: 68, sm: 48 } as const;
const BADGE_PX = 68;

type PhotoOrbitItem = {
  kind: "photo";
  src: string;
  angle: number;
  size: keyof typeof AVATAR_PX;
  delay: string;
};

type BadgeOrbitItem = {
  kind: "badge";
  label: string;
  angle: number;
  delay: string;
  color: string;
};

type OrbitItem = PhotoOrbitItem | BadgeOrbitItem;

const INNER_AVATARS: PhotoOrbitItem[] = [
  { kind: "photo", src: "/bg/bg01.png", angle: 0, size: "lg", delay: "0s" },
  { kind: "photo", src: "/bg/bg02.png", angle: 45, size: "sm", delay: "0.6s" },
  { kind: "photo", src: "/bg/bg03.png", angle: 90, size: "lg", delay: "1.2s" },
  { kind: "photo", src: "/bg/bg04.png", angle: 135, size: "sm", delay: "0.3s" },
  { kind: "photo", src: "/bg/bg05.png", angle: 180, size: "lg", delay: "0.9s" },
  { kind: "photo", src: "/bg/bg06.png", angle: 225, size: "sm", delay: "1.5s" },
  { kind: "photo", src: "/bg/bg07.png", angle: 270, size: "lg", delay: "0.45s" },
  { kind: "photo", src: "/bg/bg08.png", angle: 315, size: "sm", delay: "1.1s" },
];

const OUTER_ITEMS: OrbitItem[] = [
  { kind: "photo", src: "/bg/bg09.png", angle: 22, size: "sm", delay: "0.2s" },
  { kind: "badge", label: "Factures", angle: 67, delay: "0.8s", color: "#00b7eb" },
  { kind: "photo", src: "/bg/bg011.png", angle: 112, size: "sm", delay: "1.3s" },
  { kind: "badge", label: "Caisse", angle: 157, delay: "0.5s", color: "#10b981" },
  { kind: "photo", src: "/bg/bg013.png", angle: 202, size: "sm", delay: "1.0s" },
  { kind: "badge", label: "Stock", angle: 247, delay: "1.6s", color: "#f97316" },
  { kind: "photo", src: "/bg/bg015.png", angle: 292, size: "sm", delay: "0.35s" },
  { kind: "badge", label: "CDF", angle: 337, delay: "1.25s", color: "#a855f7" },
];

function OrbitLayer({
  items,
  orbitClass,
  uprightClass,
}: {
  items: OrbitItem[];
  orbitClass: string;
  uprightClass: string;
}) {
  return (
    <div className={orbitClass}>
      {items.map((item) => (
        <div
          key={item.kind === "photo" ? item.src : item.label}
          className="login-anim-orbit-slot"
          style={{ "--angle": `${item.angle}deg` } as React.CSSProperties}
        >
          <div className={uprightClass}>
            <div
              className="login-anim-orbit-bob"
              style={{ animationDelay: item.delay } as React.CSSProperties}
            >
              {item.kind === "photo" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt=""
                    width={AVATAR_PX[item.size]}
                    height={AVATAR_PX[item.size]}
                    className="login-anim-avatar"
                    style={{
                      width: AVATAR_PX[item.size],
                      height: AVATAR_PX[item.size],
                      minWidth: AVATAR_PX[item.size],
                      minHeight: AVATAR_PX[item.size],
                    }}
                    draggable={false}
                  />
                </>
              ) : (
                <span
                  className="login-anim-badge"
                  style={{
                    width: BADGE_PX,
                    height: BADGE_PX,
                    minWidth: BADGE_PX,
                    minHeight: BADGE_PX,
                    backgroundColor: item.color,
                  }}
                >
                  {item.label}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoginAnimatedBackground() {
  return (
    <div className="login-anim-bg" aria-hidden>
      <div className="login-anim-scene">
        <div className="login-anim-ring-outer" />
        <OrbitLayer
          items={OUTER_ITEMS}
          orbitClass="login-anim-orbit login-anim-orbit-outer"
          uprightClass="login-anim-orbit-upright login-anim-orbit-upright-reverse"
        />
        <div className="login-anim-ring" />
        <div className="login-anim-smiley">
          <span className="login-anim-eye login-anim-eye-left" />
          <span className="login-anim-eye login-anim-eye-right" />
          <span className="login-anim-mouth" />
        </div>
        <OrbitLayer
          items={INNER_AVATARS}
          orbitClass="login-anim-orbit"
          uprightClass="login-anim-orbit-upright"
        />
      </div>
    </div>
  );
}
