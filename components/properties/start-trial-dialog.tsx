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
import { startTrial } from "@/lib/actions/assignments";

export function StartTrialDialog({
  propertyId,
  clients,
  defaultStartedOn,
  trigger,
}: {
  propertyId: string;
  clients: { id: string; businessName: string }[];
  /** "YYYY-MM-DD" (org tz today) */
  defaultStartedOn: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Select a prospect.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await startTrial(propertyId, clientId, formData);
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
          <DialogTitle>Start free trial</DialogTitle>
          <DialogDescription>
            A trial delivers leads to a prospect for free. It books zero revenue;
            estimated value still accrues as the cost of the trial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Prospect</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="startedOn">
                Start date
              </Label>
              <Input id="startedOn" name="startedOn" type="date" defaultValue={defaultStartedOn} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="trialDays">
                Trial length (days)
              </Label>
              <Input id="trialDays" name="trialDays" type="number" min={7} max={30} defaultValue={14} />
            </div>
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Starting…" : "Start trial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
