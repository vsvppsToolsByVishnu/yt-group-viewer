import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GroupProvider } from "./context/GroupContext";
import { APIKeyProvider } from "./context/APIKeyContext";
import { LinkGroupProvider } from "./context/LinkGroupContext";
import DatabaseInitializer from "./components/DatabaseInitializer";
import './db/dbInit';

// Use Inter as a fallback font instead of Geist since it has better compatibility
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning={true}
      >
        <DatabaseInitializer>
          <APIKeyProvider>
            <GroupProvider>
              <LinkGroupProvider>
                {children}
              </LinkGroupProvider>
            </GroupProvider>
          </APIKeyProvider>
        </DatabaseInitializer>
      </body>
    </html>
  );
}
