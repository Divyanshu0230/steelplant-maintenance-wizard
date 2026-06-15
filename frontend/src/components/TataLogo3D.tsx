"use client";

import clsx from "clsx";

interface TataLogo3DProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
}

const SIZES = {
  sm: { scene: "h-14 w-14", text: "text-[9px]", sub: "text-[6px]" },
  md: { scene: "h-20 w-20", text: "text-[11px]", sub: "text-[7px]" },
  lg: { scene: "h-28 w-28", text: "text-sm", sub: "text-[9px]" },
};

/** Stylized 3D TATA Steel mark — CSS 3D cube + brand colors (hackathon demo). */
export default function TataLogo3D({ size = "md", showSubtitle = true, className }: TataLogo3DProps) {
  const s = SIZES[size];

  return (
    <div className={clsx("flex flex-col items-center gap-2", className)}>
      <div className={clsx("tata-logo-scene scene-3d relative", s.scene)}>
        <div className="tata-logo-orbit absolute inset-0 rounded-full border border-[var(--accent)]/15" />
        <div className="tata-logo-orbit-delay absolute inset-1 rounded-full border border-dashed border-[var(--accent)]/20" />
        <div className="tata-logo-cube absolute inset-0 m-auto h-[70%] w-[70%]">
          <div className="tata-cube-face tata-cube-front flex items-center justify-center">
            <span className={clsx("font-black tracking-[0.2em] text-[#e8e4dc]", s.text)}>TATA</span>
          </div>
          <div className="tata-cube-face tata-cube-back" />
          <div className="tata-cube-face tata-cube-right" />
          <div className="tata-cube-face tata-cube-left" />
          <div className="tata-cube-face tata-cube-top" />
          <div className="tata-cube-face tata-cube-bottom" />
        </div>
        <div className="absolute -bottom-1 left-1/2 h-2 w-[80%] -translate-x-1/2 rounded-[100%] bg-black/30 blur-md" />
      </div>
      {showSubtitle && (
        <div className="text-center leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--accent)]">
            Steel
          </div>
          <div className="text-[9px] text-[var(--muted)]">Maintenance Wizard</div>
        </div>
      )}
    </div>
  );
}
