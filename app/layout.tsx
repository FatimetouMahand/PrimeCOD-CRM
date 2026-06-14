import "./globals.css";
import type { Viewport } from "next";

export const metadata = {
  title: "Sou9nkc",
  description: "Sou9nkc — CRM & Analytics",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0d3938",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
