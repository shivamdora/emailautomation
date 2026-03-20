"use client";

import { useEffect, useState } from "react";

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

export function DeferredHeroVideo() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g"
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setShouldLoad(true);
    }, 1200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  if (!shouldLoad) {
    return <div aria-hidden="true" suppressHydrationWarning className="marketing-hero-video" />;
  }

  return (
    <video
      suppressHydrationWarning
      className="marketing-hero-video"
      src="/media/outboundflow-hero.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}
