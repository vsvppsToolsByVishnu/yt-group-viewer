import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GroupProvider } from "./context/GroupContext";
import { APIKeyProvider } from "./context/APIKeyContext";
import DatabaseInitializer from "./components/DatabaseInitializer";
import './db/dbInit';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YouTube Channel Grouping Tool",
  description: "Aggregate and manage videos from your favorite YouTube channels",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DatabaseInitializer>
          <APIKeyProvider>
            <GroupProvider>
              {children}
            </GroupProvider>
          </APIKeyProvider>
        </DatabaseInitializer>
      </body>
    </html>
  );
}
