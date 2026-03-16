import type { ReactNode } from "react";

type AuthShellProps = {
  badge?: string;
  title?: string;
  description?: string;
  caption?: string;
  children: ReactNode;
};

export function AuthShell({ caption, children }: AuthShellProps) {
  return (
    <section className="auth-stage-simple relative isolate w-full max-w-[34rem]">
      <div className="relative z-10 space-y-5">
        {children}
        {caption ? (
          <p className="mx-auto max-w-md text-center text-sm leading-6 text-[#7c92a1]">{caption}</p>
        ) : null}
        <div className="text-center font-mono text-[11px] uppercase tracking-[0.24em] text-[#a4b7c3]">
          Secure session with Supabase Auth
        </div>
      </div>
    </section>
  );
}
