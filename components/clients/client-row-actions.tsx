"use client";

import { MoreHorizontal } from "lucide-react";

import {
  ClientDialog,
  type ClientDialogValue,
} from "@/components/clients/client-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { restoreClient, softDeleteClient } from "@/lib/actions/clients";

export function ClientRowActions({
  client,
  deleted = false,
}: {
  client: ClientDialogValue;
  /** When true, the client is soft-deleted → offer Restore instead of Delete. */
  deleted?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {deleted ? (
            <ConfirmDialog
              title="Restore client?"
              description={
                <>
                  This restores <strong>{client.businessName}</strong> to your
                  active client list and pickers.
                </>
              }
              confirmLabel="Restore client"
              action={restoreClient.bind(null, client.id)}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Restore
                </DropdownMenuItem>
              }
            />
          ) : (
            <>
              <ClientDialog
                mode="edit"
                client={client}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Edit
                  </DropdownMenuItem>
                }
              />
              <ConfirmDialog
                destructive
                title="Delete client?"
                description={
                  <>
                    This soft-deletes <strong>{client.businessName}</strong>.
                    Historical lead data is preserved; a client with an active
                    assignment can&rsquo;t be deleted — unassign first.
                  </>
                }
                confirmLabel="Delete client"
                action={softDeleteClient.bind(null, client.id)}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                }
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
