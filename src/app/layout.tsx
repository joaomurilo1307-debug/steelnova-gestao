import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import Providers from "@/components/Providers";

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
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
