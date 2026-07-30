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
import { assignClient } from "@/lib/actions/assignments";

export function AssignClientDialog({
  propertyId,
  currentClientId,
  clients,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  propertyId: string;
  currentClientId: string | null;
  clients: { id: string; businessName: string }[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [clientId, setClientId] = useState<string>(currentClientId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isReassign = currentClientId != null;

  function onConfirm() {
    setError(null);
    if (!clientId) {
      setError("Select a client.");
      return;
    }
    startTransition(async () => {
      const res = await assignClient(propertyId, clientId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const options = clients.filter((c) => c.id !== currentClientId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isReassign ? "Reassign client" : "Assign client"}
          </DialogTitle>
          <DialogDescription>
            {isReassign
              ? "Ends the current assignment (today) and starts a new one, snapshotting the property's current rates."
              : "Starts a new assignment, snapshotting the property's current rates onto it."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="none" disabled>
                  No other clients available
                </SelectItem>
              ) : (
                options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.businessName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Saving…" : isReassign ? "Reassign" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
