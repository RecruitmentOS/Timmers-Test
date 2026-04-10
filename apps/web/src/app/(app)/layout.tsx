import AppShell from "@/components/layout/app-shell";
import { ProductTour } from "@/components/product-tour";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell variant="full">
      {children}
      <ProductTour />
    </AppShell>
  );
}
