import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Apartment Bill Manager",
  description: "Manage your apartment utility bills — Wi-Fi and Electricity payments made easy.",
  keywords: ["apartment bills", "utility bills", "GCash payment", "bill management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
