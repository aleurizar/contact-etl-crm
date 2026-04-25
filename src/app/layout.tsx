import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contact ETL CRM",
  description: "Mini CRM, data warehouse y motor ETL para bases de contactos."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
