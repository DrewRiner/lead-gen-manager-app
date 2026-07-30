"use client";

import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  RefreshCw,
  Sparkles,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useState, useTransition } from "react";

import { ActionsMenu, type ActionGroup } from "@/components/actions-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AssignClientDialog } from "@/components/properties/assign-client-dialog";
import { ChangeRateDialog } from "@/components/properties/change-rate-dialog";
import { StartTrialDialog } from "@/components/properties/start-trial-dialog";
import { unassignClient } from "@/lib/actions/assignments";
import {
  recalcEstimatedValues,
  setConnectionReady,
} from "@/lib/actions/properties";

type ActiveAssignment = React.ComponentProps<typeof ChangeRateDialog>["active"];
type Dialog = "assign" | "changeRate" | "unassign" | "trial" | "recalc" | null;

// One place for every property action beyond "Edit property". Renders the
// reusable ActionsMenu (Rental / Setup groups) and drives the dialogs from menu
// items via controlled open state. Only state-valid items are rendered.
export function PropertyActionsMenu({
  propertyId,
  clientId,
  clientName,
  clients,
  isAssigned,
  onTrial,
  activeAssignment,
  connectionReady,
  leadCount,
  today,
}: {
  propertyId: string;
  clientId: string | null;
  clientName: string | null;
  clients: { id: string; businessName: string }[];
  isAssigned: boolean;
  onTrial: boolean;
  activeAssignment: ActiveAssignment | undefined;
  connectionReady: boolean;
  leadCount: number;
  today: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [, startTransition] = useTransition();
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  function toggleReady() {
    startTransition(async () => {
      await setConnectionReady(propertyId, !connectionReady);
      router.refresh();
    });
  }

  // Rental group — depends on the current assignment state.
  const rentalItems: ActionGroup["items"] = [];
  if (isAssigned && activeAssignment) {
    rentalItems.push(
      { key: "reassign", label: "Reassign", icon: <UserPlus className="h-4 w-4" />, onSelect: () => setDialog("assign") },
      { key: "changeRate", label: "Change rate", onSelect: () => setDialog("changeRate") },
      { key: "unassign", label: "Unassign", icon: <UserMinus className="h-4 w-4" />, danger: true, onSelect: () => setDialog("unassign") },
    );
  } else if (!isAssigned && !onTrial) {
    rentalItems.push(
      { key: "assign", label: "Assign client", icon: <UserPlus className="h-4 w-4" />, onSelect: () => setDialog("assign") },
      { key: "trial", label: "Start free trial", icon: <Sparkles className="h-4 w-4" />, onSelect: () => setDialog("trial") },
    );
  }

  const groups: ActionGroup[] = [
    { label: "Rental", items: rentalItems },
    {
      label: "Setup",
      items: [
        {
          key: "ready",
          label: connectionReady ? "Unmark as ready" : "Mark as ready to receive leads",
          icon: connectionReady ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Circle className="h-4 w-4" />
          ),
          onSelect: toggleReady,
        },
        {
          key: "recalc",
          label: "Recalculate estimated values",
          icon: <RefreshCw className="h-4 w-4" />,
          onSelect: () => setDialog("recalc"),
        },
      ],
    },
  ];

  return (
    <>
      <ActionsMenu groups={groups} />

      {/* Controlled dialogs (no triggers — opened from the menu items). */}
      <AssignClientDialog
        propertyId={propertyId}
        currentClientId={clientId}
        clients={clients}
        open={dialog === "assign"}
        onOpenChange={close}
      />
      {activeAssignment ? (
        <ChangeRateDialog
          propertyId={propertyId}
          active={activeAssignment}
          defaultEffectiveDate={today}
          clientName={clientName}
          open={dialog === "changeRate"}
          onOpenChange={close}
        />
      ) : null}
      <ConfirmDialog
        title="Unassign client?"
        description="Ends the active assignment as of today and returns the property to producing. Historical revenue is preserved."
        confirmLabel="Unassign"
        destructive
        action={unassignClient.bind(null, propertyId)}
        open={dialog === "unassign"}
        onOpenChange={close}
      />
      <StartTrialDialog
        propertyId={propertyId}
        clients={clients}
        defaultStartedOn={today}
        open={dialog === "trial"}
        onOpenChange={close}
      />
      <ConfirmDialog
        title="Recalculate estimated values?"
        description={
          <>
            This re-runs the property&rsquo;s current estimated call and form
            values across all <strong>{leadCount}</strong> of its historical
            lead{leadCount === 1 ? "" : "s"}. Only billable leads receive value.
            This is the only action that changes historical estimated values, and
            it does not touch billed amounts.
          </>
        }
        confirmLabel="Recalculate"
        action={recalcEstimatedValues.bind(null, propertyId)}
        open={dialog === "recalc"}
        onOpenChange={close}
      />
    </>
  );
}
