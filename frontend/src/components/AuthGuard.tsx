"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(() => isPublicPath(pathname));

  useEffect(() => {
    if (!pathname) return;

    const isPublic = isPublicPath(pathname);

    if (!isPublic && !isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (pathname === "/login" && isLoggedIn()) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready && !isPublicPath(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--muted)]">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
