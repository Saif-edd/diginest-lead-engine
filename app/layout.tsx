import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diginest Lead Engine",
  description: "Internal lead qualification workspace for Diginest.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
