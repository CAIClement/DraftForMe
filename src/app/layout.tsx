import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "DraftForMe — Draft coach League of Legends",
  description: "Sachez quoi pick. Évitez les mauvais choix. DraftForMe vous aide à choisir un champion adapté à la draft, au rôle joué et aux risques de la partie."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geist.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
