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
import { Textarea } from "@/components/ui/textarea";
import { createLead } from "@/lib/actions/leads";

type LeadType = "call" | "form";

export function AddLeadDialog({
  properties,
  defaultOccurredAt,
  tzLabel,
  defaultPropertyId,
  trigger,
}: {
  properties: { id: string; name: string }[];
  /** "YYYY-MM-DDTHH:mm" in org tz */
  defaultOccurredAt: string;
  tzLabel: string;
  defaultPropertyId?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [propertyId, setPropertyId] = useState<string>(
    defaultPropertyId ?? "",
  );
  const [type, setType] = useState<LeadType>("call");
  const [source, setSource] = useState<string>("organic");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!propertyId) {
      setError("Select a property.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    formData.set("propertyId", propertyId);
    formData.set("type", type);
    formData.set("source", source);
    startTransition(async () => {
      const res = await createLead(formData);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add lead manually</DialogTitle>
          <DialogDescription>
            The lead runs through the billing engine on save. Times are in{" "}
            {tzLabel}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Property *</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LeadType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organic">Organic</SelectItem>
                  <SelectItem value="gbp">GBP</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="callerName">
                Caller name
              </Label>
              <Input id="callerName" name="callerName" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="callerPhone">
                Caller phone
              </Label>
              <Input
                id="callerPhone"
                name="callerPhone"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="callerEmail">
                Caller email
              </Label>
              <Input id="callerEmail" name="callerEmail" type="email" />
            </div>
            {type === "call" ? (
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="callDurationSeconds">
                  Duration (seconds)
                </Label>
                <Input
                  id="callDurationSeconds"
                  name="callDurationSeconds"
                  type="number"
                  min={0}
                  placeholder="Leave blank if unknown"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="message">
              Message
            </Label>
            <Textarea id="message" name="message" rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="occurredAt">
              Occurred at
            </Label>
            <Input
              id="occurredAt"
              name="occurredAt"
              type="datetime-local"
              defaultValue={defaultOccurredAt}
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
              {pending ? "Saving…" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
