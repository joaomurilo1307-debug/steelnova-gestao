import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "SteelNova | Gestão de Obras",
  description: "Gestão de obras, planejamento, custos e equipe da SteelNova Engenharia.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SteelNova Obras" },
};

export const viewport = {
  themeColor: "#E8802B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
