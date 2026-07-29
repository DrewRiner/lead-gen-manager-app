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
  spamScoreThreshold,
}: {
  timezones: string[];
  orgTimezone: string;
  defaultBillableThresholdSeconds: number;
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
