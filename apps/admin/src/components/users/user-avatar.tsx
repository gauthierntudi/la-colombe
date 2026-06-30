"use client";

import Image from "next/image";

type UserAvatarProps = {
  src: string | null | undefined;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-base",
  xl: "w-24 h-24 text-xl",
};

const pixels = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
  xl: 96,
};

function isRemoteImage(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

const AVATAR_PALETTES = [
  { from: "#0d30f5", to: "#7ba3ff" },
  { from: "#059669", to: "#34d399" },
  { from: "#7c3aed", to: "#a78bfa" },
  { from: "#dc2626", to: "#f87171" },
  { from: "#d97706", to: "#fbbf24" },
  { from: "#0891b2", to: "#22d3ee" },
  { from: "#db2777", to: "#f472b6" },
  { from: "#4338ca", to: "#818cf8" },
  { from: "#0f766e", to: "#2dd4bf" },
  { from: "#b45309", to: "#fcd34d" },
  { from: "#be185d", to: "#fb7185" },
  { from: "#4d7c0f", to: "#a3e635" },
] as const;

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getAvatarPalette(name: string) {
  const key = name.trim().toLowerCase() || "?";
  return AVATAR_PALETTES[hashString(key) % AVATAR_PALETTES.length];
}

export function UserAvatar({ src, name, size = "md", className = "" }: UserAvatarProps) {
  const dim = pixels[size];
  const initial = name.charAt(0).toUpperCase();
  const palette = getAvatarPalette(name);

  if (src) {
    return (
      <div
        className={`${sizes[size]} rounded-full overflow-hidden bg-[var(--bg)] border border-[var(--border-light)] shrink-0 ${className}`}
      >
        <Image
          src={src}
          alt={name}
          width={dim}
          height={dim}
          className="w-full h-full object-cover"
          unoptimized={isRemoteImage(src)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      style={{
        background: `linear-gradient(to bottom right, ${palette.from}, ${palette.to})`,
      }}
    >
      {initial}
    </div>
  );
}
