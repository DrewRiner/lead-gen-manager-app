"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeActiveRate } from "@/lib/actions/assignments";

type BillingType = "flat_monthly" | "per_lead" | "hybrid";

export interface ActiveAssignmentRates {
  billingType: BillingType;
  monthlyRate: string;
  perLeadCallRate: string;
  perLeadFormRate: string;
}

export function ChangeRateDialog({
  propertyId,
  active,
  defaultEffectiveDate,
  clientName,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  propertyId: string;
  active: ActiveAssignmentRates;
  /** "YYYY-MM-DD" (org tz today) */
  defaultEffectiveDate: string;
  clientName: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [billingType, setBillingType] = useState<BillingType>(active.billingType);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showMonthly = billingType === "flat_monthly" || billingType === "hybrid";
  const showPerLead = billingType === "per_lead" || billingType === "hybrid";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("billingType", billingType);
    startTransition(async () => {
      const res = await changeActiveRate(propertyId, formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change rate</DialogTitle>
          <DialogDescription>
            Reprice {clientName ?? "the current client"} from an effective date.
            The current assignment ends the day before and a new one starts with
            these rates, so past months keep the old rate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="effectiveDate">
              Effective date
            </Label>
            <Input
              id="effectiveDate"
              name="effectiveDate"
              type="date"
              defaultValue={defaultEffectiveDate}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billing type</Label>
            <Select
              value={billingType}
              onValueChange={(v) => setBillingType(v as BillingType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat_monthly">Flat monthly</SelectItem>
                <SelectItem value="per_lead">Per lead</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {showMonthly ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Monthly rate ($)</Label>
                <Input
                  name="monthlyRate"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={active.monthlyRate}
                />
              </div>
            ) : (
              <input type="hidden" name="monthlyRate" value="0" />
            )}
            {showPerLead ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Per-lead call ($)</Label>
                  <Input
                    name="perLeadCallRate"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={active.perLeadCallRate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Per-lead form ($)</Label>
                  <Input
                    name="perLeadFormRate"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={active.perLeadFormRate}
                  />
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="perLeadCallRate" value="0" />
                <input type="hidden" name="perLeadFormRate" value="0" />
              </>
            )}
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Change rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
