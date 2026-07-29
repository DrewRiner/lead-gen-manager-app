"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { markLeadNotSpam } from "@/lib/actions/leads";

/** Clears a spam flag by re-running the lead as normal (manual override). */
export function NotSpamButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const res = await markLeadNotSpam(leadId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" onClick={onClick} disabled={pending}>
        {pending ? "Restoring…" : "Not spam"}
      </Button>
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
