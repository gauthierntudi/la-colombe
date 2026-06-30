"use client";

import { Package } from "lucide-react";
import Image from "next/image";

type ProductImageProps = {
  src: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "w-9 h-9",
  md: "w-11 h-11",
  lg: "w-24 h-24",
};

export function ProductImage({ src, name, size = "md", className = "" }: ProductImageProps) {
  const dim = size === "sm" ? 36 : size === "md" ? 44 : 96;

  if (src) {
    return (
      <div
        className={`${sizes[size]} rounded-xl overflow-hidden bg-[var(--bg)] border border-[var(--border-light)] shrink-0 ${className}`}
      >
        <Image
          src={src}
          alt={name}
          width={dim}
          height={dim}
          className="w-full h-full object-cover"
          unoptimized={src.startsWith("http")}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-xl bg-[var(--accent-soft)] border border-[var(--border-light)] flex items-center justify-center shrink-0 ${className}`}
    >
      <Package size={size === "lg" ? 28 : size === "md" ? 18 : 14} className="text-[var(--accent)]" />
    </div>
  );
}
