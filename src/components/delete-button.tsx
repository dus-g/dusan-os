"use client";

import { Trash2 } from "lucide-react";

/** Small destructive form button with a native confirm step. */
export function DeleteButton({ action, id, label = "Delete", confirmText = "Delete this item?", name = "id" }: { action: (fd: FormData) => Promise<void>; id: string; label?: string; confirmText?: string; name?: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault(); }}>
      <input type="hidden" name={name} value={id} />
      <button className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={label} title={label}>
        <Trash2 className="size-3.5" />
      </button>
    </form>
  );
}
