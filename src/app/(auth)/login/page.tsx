import Link from "next/link";
import { login } from "@/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Field, Input } from "@/components/ui/input";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <>
      {reset && <p className="mb-4 rounded-md bg-success/10 px-3 py-2 text-sm text-success">Password updated. Sign in with your new password.</p>}
      <AuthForm action={login} submit="Sign in">
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      </AuthForm>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/register" className="text-primary hover:underline">Create account</Link>
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
      </div>
    </>
  );
}
