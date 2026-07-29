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
import { createProperty, updateProperty } from "@/lib/actions/properties";

type BillingType = "flat_monthly" | "per_lead" | "hybrid";
type Status =
  | "building"
  | "optimizing"
  | "producing"
  | "trial"
  | "rented"
  | "paused";

// Manually selectable statuses (not 'rented' — that follows the assignment).
const SELECTABLE_STATUSES: { value: Status; label: string }[] = [
  { value: "building", label: "Building" },
  { value: "optimizing", label: "Optimizing" },
  { value: "producing", label: "Producing" },
  { value: "paused", label: "Paused" },
];
const STATUS_LABEL: Record<string, string> = {
  building: "Building",
  optimizing: "Optimizing",
  producing: "Producing",
  trial: "Trial",
  rented: "Rented",
  paused: "Paused",
};

export interface PropertyDialogValue {
  id: string;
  name: string;
  displayName: string | null;
  domain: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  status: Status;
  launchedOn: string | null;
  gbpPlaceId: string | null;
  trackingPhone: string | null;
  ghlLeadSource: string | null;
  ghlFormId: string | null;
  shortCode: string | null;
  clientId: string | null;
  billingType: BillingType;
  monthlyRate: string;
  targetMonthlyRent: string;
  perLeadCallRate: string;
  perLeadFormRate: string;
  estimatedCallValue: string;
  estimatedFormValue: string;
  billableThresholdSeconds: number;
  notes: string | null;
}

export function PropertyDialog({
  mode,
  property,
  trigger,
}: {
  mode: "create" | "edit";
  property?: PropertyDialogValue;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [billingType, setBillingType] = useState<BillingType>(
    property?.billingType ?? "flat_monthly",
  );
  const [status, setStatus] = useState<Status>(property?.status ?? "building");

  // Editing rates when a client is actively assigned is the silent-wrong-revenue
  // trap: these fields are only defaults for FUTURE assignments; the active
  // client keeps the rate snapshotted on their assignment.
  const hasActiveAssignment = mode === "edit" && property?.clientId != null;
  const [rateChanged, setRateChanged] = useState(false);
  const markRateChanged = () => setRateChanged(true);

  const showMonthly = billingType === "flat_monthly" || billingType === "hybrid";
  const showPerLead = billingType === "per_lead" || billingType === "hybrid";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createProperty(formData)
          : await updateProperty(property!.id, formData);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add property" : "Edit property"}
          </DialogTitle>
          <DialogDescription>
            One property is one brand. Billing and estimated-value rates are
            configured per property.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Hidden mirrors for shadcn selects */}
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="billingType" value={billingType} />

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input name="name" defaultValue={property?.name ?? ""} required />
            </Field>
            <Field label="Display name">
              <Input
                name="displayName"
                defaultValue={property?.displayName ?? ""}
              />
            </Field>
            <Field label="Domain">
              <Input
                name="domain"
                placeholder="example.com"
                defaultValue={property?.domain ?? ""}
              />
            </Field>
            <Field label="Niche">
              <Input
                name="niche"
                placeholder="plumbing"
                defaultValue={property?.niche ?? ""}
              />
            </Field>
            <Field label="City">
              <Input name="city" defaultValue={property?.city ?? ""} />
            </Field>
            <Field label="State">
              <Input
                name="state"
                placeholder="TX"
                defaultValue={property?.state ?? ""}
              />
            </Field>
            <Field label="Status">
              {hasActiveAssignment ? (
                <>
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {STATUS_LABEL[status] ?? status}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status follows the rental while a client is assigned.
                  </p>
                </>
              ) : (
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as Status)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTABLE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Launched on">
              <Input
                name="launchedOn"
                type="date"
                defaultValue={property?.launchedOn ?? ""}
              />
            </Field>
            <Field label="GBP place ID">
              <Input
                name="gbpPlaceId"
                defaultValue={property?.gbpPlaceId ?? ""}
              />
            </Field>
            <Field label="Tracking phone">
              <Input
                name="trackingPhone"
                placeholder="(555) 123-4567"
                defaultValue={property?.trackingPhone ?? ""}
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-semibold">Billing</h3>
              <p className="text-xs text-muted-foreground">
                What the client actually pays. Only fields relevant to the
                billing type are shown.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Billing type">
                <Select
                  value={billingType}
                  onValueChange={(v) => {
                    setBillingType(v as BillingType);
                    if (v !== property?.billingType) markRateChanged();
                  }}
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
              </Field>
              <Field label="Billable call threshold (seconds)">
                <Input
                  name="billableThresholdSeconds"
                  type="number"
                  min={0}
                  defaultValue={property?.billableThresholdSeconds ?? 60}
                />
              </Field>
              <Field label="Target monthly rent ($)">
                <Input
                  name="targetMonthlyRent"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={property?.targetMonthlyRent ?? "0"}
                />
              </Field>
              {showMonthly ? (
                <Field label="Monthly rate ($)">
                  <Input
                    name="monthlyRate"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={property?.monthlyRate ?? "0"}
                    onChange={markRateChanged}
                  />
                </Field>
              ) : (
                <input
                  type="hidden"
                  name="monthlyRate"
                  value={property?.monthlyRate ?? "0"}
                />
              )}
              {showPerLead ? (
                <>
                  <Field label="Per-lead call rate ($)">
                    <Input
                      name="perLeadCallRate"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={property?.perLeadCallRate ?? "0"}
                      onChange={markRateChanged}
                    />
                  </Field>
                  <Field label="Per-lead form rate ($)">
                    <Input
                      name="perLeadFormRate"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={property?.perLeadFormRate ?? "0"}
                      onChange={markRateChanged}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <input
                    type="hidden"
                    name="perLeadCallRate"
                    value={property?.perLeadCallRate ?? "0"}
                  />
                  <input
                    type="hidden"
                    name="perLeadFormRate"
                    value={property?.perLeadFormRate ?? "0"}
                  />
                </>
              )}
            </div>
            {hasActiveAssignment && rateChanged ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                These rates apply to <strong>future assignments only</strong>.
                The currently assigned client keeps the rate snapshotted when
                their assignment started. To reprice them, close this and use{" "}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-semibold underline underline-offset-2"
                >
                  Change rate
                </button>
                .
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-semibold">Estimated value</h3>
              <p className="text-xs text-muted-foreground">
                Market value of a lead in this niche and metro — what it is
                worth, not what the current client pays. Recorded on every
                billable lead.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Estimated call value ($)">
                <Input
                  name="estimatedCallValue"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={property?.estimatedCallValue ?? "0"}
                />
              </Field>
              <Field label="Estimated form value ($)">
                <Input
                  name="estimatedFormValue"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={property?.estimatedFormValue ?? "0"}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-semibold">Lead ingestion (GoHighLevel)</h3>
              <p className="text-xs text-muted-foreground">
                How inbound form submissions are matched to this property.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GHL Lead Source</Label>
              <Input
                name="ghlLeadSource"
                placeholder="e.g. Brunswick Fence Company"
                defaultValue={property?.ghlLeadSource ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                The exact value to put in the GHL form&rsquo;s{" "}
                <strong>Lead Source</strong> hidden field. Inbound leads carrying
                this value are matched to this property (case-insensitive).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Short code</Label>
              <Input
                name="shortCode"
                placeholder="Optional — a stable routing code, e.g. ROOF-ATL-01"
                defaultValue={property?.shortCode ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                A second Lead Source value that also routes here (case-insensitive).
                Use it to migrate forms from a brand name to a stable code.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GHL Form ID</Label>
              <Input
                name="ghlFormId"
                placeholder="Optional — matched if Lead Source is absent"
                defaultValue={property?.ghlFormId ?? ""}
              />
            </div>
          </section>

          <Field label="Notes">
            <Textarea name="notes" rows={2} defaultValue={property?.notes ?? ""} />
          </Field>

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
                  ? "Create property"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
