import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ParentShield - Protect Your Family's Digital Life",
  description: "Take control of screen time and block distracting games and websites with enterprise-grade parental control software.",
  keywords: ["parental control", "screen time", "game blocker", "website filter", "family safety"],
  authors: [{ name: "ParentShield" }],
  openGraph: {
    title: "ParentShield - Protect Your Family's Digital Life",
    description: "Take control of screen time and block distracting games and websites.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
