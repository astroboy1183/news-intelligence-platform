import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import AutoRefresh from "@/components/AutoRefresh";
import CommandPalette from "@/components/CommandPalette";
import NavBar from "@/components/NavBar";
import Starfield from "@/components/Starfield";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "News Intelligence",
  description: "Story clustering, entities, topics, trends across India + global outlets.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-slate-100">
        <Starfield />
        <NavBar />
        <main className="flex-1">{children}</main>
        <CommandPalette />
        <AutoRefresh intervalMs={30_000} />
      </body>
    </html>
  );
}
