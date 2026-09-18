import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import { BrandHeader } from "@/components/brand-header";
import { SITE_NAME } from "@/lib/config";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `Domande dal pubblico | ${SITE_NAME}`, template: `%s | ${SITE_NAME}` },
  description: "Invia e segui le domande dal pubblico durante gli incontri di Marcello Coppo.",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${display.variable} ${body.variable}`}>
      <body>
        <BrandHeader />
        {children}
      </body>
    </html>
  );
}
