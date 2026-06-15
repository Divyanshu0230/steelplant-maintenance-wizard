"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  glow?: boolean;
  hover?: boolean;
  tilt3d?: boolean;
}

export default function AnimatedCard({
  children,
  className,
  delay = 0,
  glow = false,
  hover = true,
  tilt3d = false,
}: AnimatedCardProps) {
  return (
    <div
      className={clsx(
        "card animate-fade-in-up",
        glow && "glow-border",
        hover && !tilt3d && "transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-xl",
        tilt3d && "tilt-3d-card",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
