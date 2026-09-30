import type { Metadata } from "next";
import "./globals.css";
import "./radar.css";
import "./sources.css";

export const metadata: Metadata = {
  title: "Niche Radar | Lokal behandlingsanalyse",
  description: "Find lokale behandlingsnicher med klinik-match og transparent datakvalitet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
