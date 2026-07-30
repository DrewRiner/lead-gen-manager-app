"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { restoreLead } from "@/lib/actions/leads";

/** Restore a soft-deleted lead back into all counts and metrics. */
export function RestoreLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const res = await restoreLead(leadId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" onClick={onClick} disabled={pending}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {pending ? "Restoring…" : "Restore lead"}
      </Button>
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
