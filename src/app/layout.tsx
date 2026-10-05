import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Insper 2027.1 · Meu preparo",
  description: "Catálogo pessoal de questões, provas e fontes para preparação ao Insper."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
