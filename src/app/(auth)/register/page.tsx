import Link from "next/link";
import { register } from "@/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Field, Input } from "@/components/ui/input";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <AuthForm action={register} submit="Create account">
        <Field label="Name" htmlFor="name"><Input id="name" name="name" autoComplete="name" defaultValue="Dusan" required /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Date of birth" htmlFor="dateOfBirth"><Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue="2003-12-09" /></Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
      </AuthForm>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
      </p>
    </>
  );
}
