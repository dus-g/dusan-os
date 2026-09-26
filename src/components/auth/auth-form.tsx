"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function AuthForm({ action, submit, children }: { action: (s: FormState, fd: FormData) => Promise<FormState>; submit: string; children: React.ReactNode }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4">
      {children}
      {state?.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      {state?.success && <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{state.success}</p>}
      <SubmitButton className="w-full">{submit}</SubmitButton>
    </form>
  );
}
