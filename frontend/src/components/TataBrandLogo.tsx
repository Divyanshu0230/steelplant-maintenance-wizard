"use client";

import clsx from "clsx";

interface TataBrandLogoProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
}

const SIZES = {
  sm: { h: 32, maxW: 160 },
  md: { h: 44, maxW: 220 },
  lg: { h: 56, maxW: 280 },
};

export default function TataBrandLogo({
  size = "md",
  showSubtitle = false,
  className,
}: TataBrandLogoProps) {
  const { h, maxW } = SIZES[size];

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tata-steel-logo.png"
        alt="Tata Steel"
        className="rounded-md object-contain object-left"
        style={{ height: h, maxWidth: maxW, width: "auto" }}
      />
      {showSubtitle && (
        <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
          Maintenance Wizard
        </div>
      )}
    </div>
  );
}
