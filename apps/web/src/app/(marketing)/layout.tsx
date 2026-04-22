import type { Metadata } from "next";
import Link from "next/link";
import CookieConsent from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: "Recruitment OS - Het recruitmentplatform voor transport",
  description:
    "Het complete recruitmentplatform voor chauffeurs. Van vacature tot plaatsing, in een systeem.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-slate-900">
            Recruitment<span className="text-blue-600">OS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Inloggen
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Gratis proberen
            </Link>
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} Recruitment OS. Alle rechten voorbehouden.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-700">
                Privacy
              </Link>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-700">
                Voorwaarden
              </a>
              <a
                href="mailto:info@recruitment-os.nl"
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}
