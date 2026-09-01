"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import AscentFooter from "@/components/AscentFooter";
import AscentHeader from "@/components/AscentHeader";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { isAscentPath } from "@/lib/ascent-site";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const ascent = isAscentPath(pathname);

  useEffect(() => {
    document.documentElement.classList.toggle("ascent-world", ascent);
    return () => document.documentElement.classList.remove("ascent-world");
  }, [ascent]);

  if (ascent) {
    return (
      <div className="ascent-shell">
        <AscentHeader />
        <main>{children}</main>
        <AscentFooter />
      </div>
    );
  }

  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
