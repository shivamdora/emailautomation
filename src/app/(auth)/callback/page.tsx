import { AuthShell } from "@/components/auth/auth-shell";
import { CallbackStatus } from "@/components/auth/callback-status";

export default function CallbackPage() {
  return (
    <AuthShell
      caption="Completing your authentication."
    >
      <div className="auth-card grid gap-6 p-7 sm:p-8">
        <CallbackStatus />
      </div>
    </AuthShell>
  );
}
