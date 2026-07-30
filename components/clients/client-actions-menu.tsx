"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { ActionsMenu } from "@/components/actions-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { softDeleteClient } from "@/lib/actions/clients";

// Client-detail header actions (beyond the primary "Edit client"). Delete is the
// only one for now; it stays in the dropdown, danger-styled and last, matching
// the app-wide header pattern. The delete is soft and guarded server-side.
export function ClientActionsMenu({
  clientId,
  businessName,
}: {
  clientId: string;
  businessName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ActionsMenu
        groups={[
          {
            items: [
              {
                key: "delete",
                label: "Delete client",
                icon: <Trash2 className="h-4 w-4" />,
                danger: true,
                onSelect: () => setOpen(true),
              },
            ],
          },
        ]}
      />
      <ConfirmDialog
        destructive
        title="Delete client?"
        description={
          <>
            This soft-deletes <strong>{businessName}</strong>. Their historical
            leads and assignment attribution are preserved. A client with an
            active assignment can&rsquo;t be deleted — unassign first.
          </>
        }
        confirmLabel="Delete client"
        action={softDeleteClient.bind(null, clientId)}
        redirectTo="/clients"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
