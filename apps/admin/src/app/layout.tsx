import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Colombe — Admin",
  description: "Dashboard de gestion — maison La Colombe",
  icons: {
    icon: [
      { url: "/images/icon-app.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/images/icon-app.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/images/icon-app.png",
  },
  appleWebApp: {
    title: "La Colombe",
    statusBarStyle: "default",
  },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
