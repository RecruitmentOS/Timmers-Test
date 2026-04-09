import AppShell from "@/components/layout/app-shell";

export default function HMPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell variant="hm">{children}</AppShell>;
}
