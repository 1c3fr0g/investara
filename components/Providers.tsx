"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { OfflinePaperTrading } from "./OfflinePaperTrading";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider><OfflinePaperTrading>{children}</OfflinePaperTrading></SessionProvider>;
}
