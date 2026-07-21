import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Achafestas | O mapa das festas populares de Portugal",
  description:
    "Descobre romarias, arraiais, feiras e festas populares perto de ti. Datas confirmadas, localização no mapa e direções — de Viana ao Algarve.",
  icons: { icon: "/logo-mark.svg" },
  metadataBase: new URL("https://achafestas.com"),
  openGraph: {
    title: "Achafestas | O mapa das festas populares de Portugal",
    description:
      "Descobre romarias, arraiais, feiras e festas populares perto de ti.",
    locale: "pt_PT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
