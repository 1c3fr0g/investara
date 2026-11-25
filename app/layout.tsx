import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/ui";
import { Providers } from "@/components/Providers";
import { AiChatbot } from "@/components/AiChatbot";
import { CommandPalette } from "@/components/CommandPalette";
import { DynamicIslandDock } from "@/components/DynamicIslandDock";
import { InvestaraAnalytics } from "@/components/InvestaraAnalytics";

export const metadata: Metadata = {
  title: "Investara - Platform Analisis Saham IDX & Kripto",
  description: "Terminal riset dan screener pasar saham Indonesia (IHSG) & cryptocurrency dengan data dividen, sinyal teknikal kuantitatif, dan kalkulator return.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased selection:bg-blue-200 selection:text-blue-950">
        <a
          href="#main-content"
          className="crystal-primary sr-only rounded-xl px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[210]"
        >
          Lewati ke konten utama
        </a>
        <Providers>
          <Suspense fallback={null}>
            <SiteHeader />
          </Suspense>
          <div id="main-content" tabIndex={-1} className="crystal-content min-w-0 flex-1 scroll-mt-24 pb-20">
            {children}
          </div>
          <Suspense fallback={null}>
            <AiChatbot />
          </Suspense>
          <Suspense fallback={null}>
            <CommandPalette />
          </Suspense>
          <Suspense fallback={null}>
            <DynamicIslandDock />
          </Suspense>
        </Providers>
        <InvestaraAnalytics />
      </body>
    </html>
  );
}
