import AppShell from "@/components/layout/app-shell";

export default function AgentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell variant="agent">{children}</AppShell>;
}
