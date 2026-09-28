import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "LoopSale - CRM de Retenção e Pós-venda para Infoprodutores",
  description:
    "Plataforma de retenção: recupere checkout abandonado, nutra leads e automatize com WhatsApp, E-mail e SMS. Kiwify e Hotmart.",
  icons: {
    icon: [
      { url: "/pwa/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/pwa/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/pwa/icon-192.png",
    apple: "/pwa/apple-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={dmSans.variable}>
      <body className="antialiased min-h-screen font-sans" suppressHydrationWarning>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
