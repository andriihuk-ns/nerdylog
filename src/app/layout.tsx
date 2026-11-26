import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  // A14: Ukrainian copy needs the Cyrillic glyphs.
  subsets: ["latin", "cyrillic"],
});

// globals.css maps Tailwind's --font-mono to var(--font-geist-mono).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: { default: "nerdylog", template: "%s · nerdylog" },
    description: t("description"),
  };
}

/** A14: locale from the NEXT_LOCALE cookie (src/i18n/request.ts); messages reach client components via the provider. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies .dark before first paint; see components/shell/theme.ts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
