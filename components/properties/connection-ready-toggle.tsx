"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setConnectionReady } from "@/lib/actions/properties";

// "Mark as ready to receive leads" — admin override for the connection dot.
// Once real leads flow, the dot stays green from the lead signal regardless.
export function ConnectionReadyToggle({
  propertyId,
  ready,
}: {
  propertyId: string;
  ready: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setConnectionReady(propertyId, !ready);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {ready ? (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Marked ready — unmark
        </>
      ) : (
        <>
          <Circle className="mr-2 h-4 w-4" /> Mark as ready to receive leads
        </>
      )}
    </Button>
  );
}
