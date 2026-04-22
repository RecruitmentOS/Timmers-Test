import CookieConsent from "@/components/cookie-consent";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      {children}
      <CookieConsent />
    </div>
  );
}
