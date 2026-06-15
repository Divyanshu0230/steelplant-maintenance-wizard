"use client";

import { useEffect, useState } from "react";

export function useSectionSpy(sectionIds: string[], rootMargin = "-20% 0px -60% 0px") {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin, threshold: [0.1, 0.25, 0.5] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds, rootMargin]);

  return activeId;
}

export function scrollToSection(
  id: string,
  onActive?: (id: string) => void
) {
  onActive?.(id);
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.remove("section-flash");
  void el.offsetWidth;
  el.classList.add("section-flash");
  window.setTimeout(() => el.classList.remove("section-flash"), 2200);
}
