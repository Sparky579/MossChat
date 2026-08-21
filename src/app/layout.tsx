import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mosschat.xyz"),
  title: "MossChat · Local AI workspace",
  description: "MossChat is a local, browser-only multi-model chat workspace",
  icons: {
    icon: "/icon.svg",
    apple: "/icons/mosschat-192.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MossChat" },
};

export const viewport: Viewport = {
  themeColor: "#198754",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
