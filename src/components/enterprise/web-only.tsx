"use client";

import { ReactNode, useEffect, useState } from "react";

function detectNativePlatform(): boolean {
  const maybeCapacitor = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return maybeCapacitor?.isNativePlatform?.() === true;
}

export function WebOnly({ children }: { children: ReactNode }) {
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    setIsNativeApp(detectNativePlatform());
  }, []);

  if (isNativeApp) return null;
  return <>{children}</>;
}

