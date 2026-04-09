import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/lib/query-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SocketProvider } from "@/providers/socket-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Recruitment OS",
  description:
    "Recruitment operating system for high-volume blue-collar hiring",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={cn("font-sans antialiased", inter.variable)}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <SocketProvider>
            <NuqsAdapter>
              <QueryProvider>
                <TooltipProvider>{children}</TooltipProvider>
              </QueryProvider>
            </NuqsAdapter>
          </SocketProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
