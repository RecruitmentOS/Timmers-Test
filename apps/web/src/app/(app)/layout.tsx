import AppShell from "@/components/layout/app-shell";
import { ProductTour } from "@/components/product-tour";
import { ErrorBoundary } from "@/components/error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="full">
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <ProductTour />
    </AppShell>
  );
}
