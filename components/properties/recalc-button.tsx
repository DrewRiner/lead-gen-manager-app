"use client";

import { RefreshCw } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { recalcEstimatedValues } from "@/lib/actions/properties";

export function RecalcEstimatedValuesButton({
  propertyId,
  leadCount,
}: {
  propertyId: string;
  leadCount: number;
}) {
  return (
    <ConfirmDialog
      title="Recalculate estimated values?"
      description={
        <>
          This re-runs the property&rsquo;s current estimated call and form
          values across all <strong>{leadCount}</strong> of its historical
          lead{leadCount === 1 ? "" : "s"}. Only billable leads receive value.
          This is the only action that changes historical estimated values, and
          it does not touch billed amounts.
        </>
      }
      confirmLabel="Recalculate"
      action={recalcEstimatedValues.bind(null, propertyId)}
      trigger={
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Recalculate estimated values
        </Button>
      }
    />
  );
}
