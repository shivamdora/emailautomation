export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page-shell relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="auth-page-orb auth-page-orb-left" />
      <div className="auth-page-orb auth-page-orb-right" />
      <div className="auth-page-orb auth-page-orb-bottom" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center justify-center">
        {children}
      </div>
    </main>
  );
}
