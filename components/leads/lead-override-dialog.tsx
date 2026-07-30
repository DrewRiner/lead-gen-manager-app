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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { overrideLeadBillableStatus } from "@/lib/actions/leads";

const STATUSES = [
  "billable",
  "not_billable",
  "disputed",
  "pending_review",
  "spam",
] as const;

const LABEL: Record<string, string> = {
  billable: "Billable",
  not_billable: "Not billable",
  disputed: "Disputed",
  pending_review: "Pending review",
  spam: "Spam",
};

// Common override reasons — quick-pick to fill the field (still editable).
// Stored verbatim in billable_reason.
const PRESET_REASONS = [
  "Not a real lead",
  "Wrong service area",
  "Existing customer",
  "Poor quality",
] as const;

export function LeadOverrideDialog({
  leadId,
  current,
  trigger,
}: {
  leadId: string;
  current: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(current);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("billableStatus", status);
    startTransition(async () => {
      const res = await overrideLeadBillableStatus(leadId, formData);
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override billable status</DialogTitle>
          <DialogDescription>
            This marks the lead as manually reviewed. Automated rules will no
            longer change it. Billed and estimated values are re-derived from
            the property&rsquo;s current rates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">New status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="reason">
              Reason
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs transition-colors " +
                    (reason === p
                      ? "border-primary bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted")
                  }
                >
                  {p}
                </button>
              ))}
            </div>
            <Textarea
              id="reason"
              name="reason"
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being overridden? Pick a preset above or type your own."
            />
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
              {pending ? "Saving…" : "Save override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
