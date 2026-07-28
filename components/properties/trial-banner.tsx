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
import { convertTrial, endTrial } from "@/lib/actions/assignments";
import { formatNumber } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

type BillingType = "flat_monthly" | "per_lead" | "hybrid";

export function TrialBanner({
  assignmentId,
  prospectName,
  dayN,
  dayM,
  daysRemaining,
  expired,
  leadsDelivered,
  estimatedDelivered,
  targetMonthlyRent,
  today,
}: {
  assignmentId: string;
  prospectName: string;
  dayN: number;
  dayM: number;
  daysRemaining: number;
  expired: boolean;
  leadsDelivered: number;
  estimatedDelivered: string;
  targetMonthlyRent: string;
  today: string;
}) {
  const router = useRouter();
  const [convertOpen, setConvertOpen] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>("flat_monthly");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showMonthly = billingType === "flat_monthly" || billingType === "hybrid";
  const showPerLead = billingType === "per_lead" || billingType === "hybrid";

  function onEnd() {
    setError(null);
    const fd = new FormData();
    fd.set("endedOn", today);
    startTransition(async () => {
      const res = await endTrial(assignmentId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onConvert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("billingType", billingType);
    startTransition(async () => {
      const res = await convertTrial(assignmentId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConvertOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "mb-6 rounded-lg border p-4",
        expired
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-200">
              FREE TRIAL
            </span>
            <span className="font-semibold">{prospectName}</span>
            {expired ? (
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                EXPIRED
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Day {dayN} of {dayM} · {formatNumber(Math.max(0, daysRemaining))} days left
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {formatNumber(leadsDelivered)} leads delivered ·{" "}
            {formatCurrency(estimatedDelivered)} estimated value delivered
          </div>
          {error ? (
            <p className="mt-1 text-sm font-medium text-destructive">{error}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setConvertOpen(true)} disabled={pending}>
            Convert to paid
          </Button>
          <Button variant="outline" onClick={onEnd} disabled={pending}>
            End trial
          </Button>
        </div>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert trial to paid</DialogTitle>
            <DialogDescription>
              Ends the trial and starts a paid rental for {prospectName} the day
              after. Rent is prefilled with the target we were aiming for.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onConvert} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="startedOn">
                Paid start date
              </Label>
              <Input id="startedOn" name="startedOn" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Billing type</Label>
              <Select value={billingType} onValueChange={(v) => setBillingType(v as BillingType)}>
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
                  <Input name="monthlyRate" type="number" step="0.01" min={0} defaultValue={targetMonthlyRent} />
                </div>
              ) : (
                <input type="hidden" name="monthlyRate" value="0" />
              )}
              {showPerLead ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Per-lead call ($)</Label>
                    <Input name="perLeadCallRate" type="number" step="0.01" min={0} defaultValue="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Per-lead form ($)</Label>
                    <Input name="perLeadFormRate" type="number" step="0.01" min={0} defaultValue="0" />
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
              <Button type="button" variant="outline" onClick={() => setConvertOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Converting…" : "Convert to paid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
