import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Field, Input } from "@/components/ui/input";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Enter your email and we'll send a link to set a new password.</p>
      <AuthForm action={requestPasswordReset} submit="Send reset link">
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      </AuthForm>
      <Link href="/login" className="mt-6 inline-block text-sm text-primary hover:underline">Back to sign in</Link>
    </>
  );
}
