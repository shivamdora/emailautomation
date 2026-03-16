import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/forms/auth-form";
import { getServerPostAuthRedirectPath } from "@/lib/auth/redirects";
import { getSessionUser } from "@/lib/auth/session";

export default async function SignInPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(await getServerPostAuthRedirectPath(user.id));
  }

  return (
    <AuthShell
      caption="Use your account to access your workspace."
    >
      <AuthForm mode="sign-in" />
      <p className="text-center text-sm text-[#688295]">
        New here?{" "}
        <Link href="/sign-up" className="font-semibold text-[#163548] transition hover:text-[#2b6f95]">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
