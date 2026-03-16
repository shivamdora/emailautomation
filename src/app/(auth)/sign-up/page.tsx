import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/forms/auth-form";
import { getServerPostAuthRedirectPath } from "@/lib/auth/redirects";
import { getSessionUser } from "@/lib/auth/session";

export default async function SignUpPage() {
  const user = await getSessionUser();

  if (user) {
    redirect(await getServerPostAuthRedirectPath(user.id));
  }

  return (
    <AuthShell
      caption="Create your account and start quickly."
    >
      <AuthForm mode="sign-up" />
      <p className="text-center text-sm text-[#688295]">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-[#163548] transition hover:text-[#2b6f95]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
