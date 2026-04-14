import dynamic from "next/dynamic";
import AppShell from "@/components/layout/app-shell";
import { ProductTour } from "@/components/product-tour";
import { ErrorBoundary } from "@/components/error-boundary";

const CookieConsent = dynamic(() => import("@/components/cookie-consent"), {
  ssr: false,
});

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="full">
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <ProductTour />
      <CookieConsent />
    </AppShell>
  );
}
