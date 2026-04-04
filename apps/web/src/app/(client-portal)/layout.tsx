import AppShell from "@/components/layout/app-shell";

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell variant="client">{children}</AppShell>;
}
