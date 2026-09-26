import Link from "next/link";
import { resetPassword } from "@/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Field, Input } from "@/components/ui/input";

export const metadata = { title: "Set new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p className="text-sm">This link is missing its token. <Link className="text-primary" href="/forgot-password">Request a new one.</Link></p>;
  return (
    <AuthForm action={resetPassword} submit="Save new password">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
    </AuthForm>
  );
}
