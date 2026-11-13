import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { site } from "@/content/site";

const ui = IBM_Plex_Sans({ variable: "--font-ui", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-mono-ui", subsets: ["latin", "latin-ext"], weight: ["400", "500"], display: "swap" });
const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: site.title, template: `%s · ${site.short}` },
  description: site.description,
  openGraph: { title: site.title, description: site.description, locale: "fr_DZ", type: "website" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0f1a2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${ui.variable} ${mono.variable} ${bodoni.variable} h-full`}>
      <body className="flex min-h-full flex-col text-[15px] xl:text-[16px]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
