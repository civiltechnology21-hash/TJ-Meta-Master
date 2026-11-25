import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import { BRAND } from "@/lib/brand.generated";
import { DEFAULT_THEME, THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "TJ Meta Master",
  description: "SEO-friendly title, description and keyword generator for stock files.",
  // Favicon comes from public/logo.(png|jpg|jpeg|webp|svg)
  icons: {
    icon: [{ url: BRAND.logo, type: BRAND.logoType }],
    shortcut: BRAND.logo,
    ...(BRAND.logoType === "image/svg+xml" ? {} : { apple: BRAND.logo }),
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Dark is the default; the script below switches this tag if a light theme was saved.
  themeColor: THEME_COLORS[DEFAULT_THEME],
  colorScheme: DEFAULT_THEME,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is rewritten by the script before the first paint, so React is told not to
    // complain that the server said "dark" while the browser already shows "light".
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
