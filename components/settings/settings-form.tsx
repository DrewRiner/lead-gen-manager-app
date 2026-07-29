"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "@/lib/actions/settings";

export function SettingsForm({
  timezones,
  orgTimezone,
  defaultBillableThresholdSeconds,
  producingMinBillableLeads,
  producingMonthsRequired,
  spamScoreThreshold,
}: {
  timezones: string[];
  orgTimezone: string;
  defaultBillableThresholdSeconds: number;
  producingMinBillableLeads: number;
  producingMonthsRequired: number;
  spamScoreThreshold: number;
}) {
  const router = useRouter();
  const [tz, setTz] = useState(orgTimezone);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orgTimezone", tz);
    startTransition(async () => {
      const res = await updateSettings(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(res.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-5">
      <div className="space-y-1.5">
        <Label className="text-sm">Organization timezone</Label>
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {timezones.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          All dashboard and report date bucketing uses this timezone.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm" htmlFor="defaultBillableThresholdSeconds">
          Default billable call threshold (seconds)
        </Label>
        <Input
          id="defaultBillableThresholdSeconds"
          name="defaultBillableThresholdSeconds"
          type="number"
          min={0}
          defaultValue={defaultBillableThresholdSeconds}
        />
        <p className="text-xs text-muted-foreground">
          Default for new properties. Each property can override its own
          threshold.
        </p>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Producing-health signal</p>
          <p className="text-xs text-muted-foreground">
            An advisory read on whether a property is actually producing, from
            billable lead flow. It never changes a property&rsquo;s status — it
            only flags mismatches for review.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm" htmlFor="producingMinBillableLeads">
            Min billable leads
          </Label>
          <Input
            id="producingMinBillableLeads"
            name="producingMinBillableLeads"
            type="number"
            min={1}
            defaultValue={producingMinBillableLeads}
          />
          <p className="text-xs text-muted-foreground">
            A property counts as producing when it clears this many{" "}
            <span className="font-medium">billable</span> leads in the trailing
            30 days (spam, non-billable, pending, and unmatched never count).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm" htmlFor="producingMonthsRequired">
            Months required (of last 3)
          </Label>
          <Input
            id="producingMonthsRequired"
            name="producingMonthsRequired"
            type="number"
            min={1}
            max={3}
            defaultValue={producingMonthsRequired}
          />
          <p className="text-xs text-muted-foreground">
            It must also clear that bar in at least this many of the last 3
            complete calendar months, so one lucky or slow month can&rsquo;t flip
            the signal.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border p-3">
        <Label className="text-sm" htmlFor="spamScoreThreshold">
          Spam score threshold
        </Label>
        <Input
          id="spamScoreThreshold"
          name="spamScoreThreshold"
          type="number"
          min={1}
          defaultValue={spamScoreThreshold}
        />
        <p className="text-xs text-muted-foreground">
          Inbound form leads scoring at or above this are flagged{" "}
          <span className="font-medium">spam</span> — but always saved and
          reviewable, never blocked. Lower catches more spam (and risks real
          leads); higher is more permissive. Default 70.
        </p>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm font-medium text-emerald-600">{message}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
