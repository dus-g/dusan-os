"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ButtonProps } from "@/components/ui/button";

/** Form bound to a `(state, formData) => FormState` server action with inline feedback. */
export function ActionForm({ action, submit, variant, children, className = "grid gap-3" }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  submit: string;
  variant?: ButtonProps["variant"];
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-full">
        {state?.error && <p role="alert" className="mr-auto text-sm text-destructive">{state.error}</p>}
        {state?.success && <p role="status" className="mr-auto text-sm text-success">{state.success}</p>}
        <SubmitButton size="sm" variant={variant}>{submit}</SubmitButton>
      </div>
    </form>
  );
}
