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
import { createClient, updateClient } from "@/lib/actions/clients";

type Status = "active" | "paused" | "churned";

export interface ClientDialogValue {
  id: string;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  status: Status;
  notes: string | null;
}

export function ClientDialog({
  mode,
  client,
  trigger,
}: {
  mode: "create" | "edit";
  client?: ClientDialogValue;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(client?.status ?? "active");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("status", status);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createClient(formData)
          : await updateClient(client!.id, formData);
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
          <DialogTitle>
            {mode === "create" ? "Add client" : "Edit client"}
          </DialogTitle>
          <DialogDescription>
            Business owners renting leads. One client can hold several
            properties.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Business name <span className="text-destructive">*</span>
            </Label>
            <Input
              name="businessName"
              defaultValue={client?.businessName ?? ""}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Contact name</Label>
              <Input name="contactName" defaultValue={client?.contactName ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input name="email" type="email" defaultValue={client?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                name="phone"
                placeholder="(555) 123-4567"
                defaultValue={client?.phone ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea name="notes" rows={2} defaultValue={client?.notes ?? ""} />
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
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create client"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
