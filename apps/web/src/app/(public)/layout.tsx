export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="text-center text-sm text-gray-400 py-4">
        Powered by{" "}
        <a href="https://recruitment-os.nl" className="underline">
          Recruitment OS
        </a>
      </footer>
    </div>
  );
}
