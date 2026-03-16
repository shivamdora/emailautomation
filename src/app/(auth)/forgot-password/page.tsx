import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/forms/auth-form";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    mode?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const mode = params.mode === "update" ? "update-password" : "forgot-password";

  return (
    <AuthShell
      caption={mode === "update-password" ? "Set a new password to continue." : "Reset access to your account."}
    >
      <AuthForm mode={mode} />
      <p className="text-center text-sm text-[#688295]">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-[#163548] transition hover:text-[#2b6f95]">
          Return to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
