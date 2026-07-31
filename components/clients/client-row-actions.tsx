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
import { softDeleteClient } from "@/lib/actions/clients";
import { cn } from "@/lib/utils";

export function ClientRowActions({
  client,
  triggerClassName,
}: {
  client: ClientDialogValue;
  /** Override the trigger size (e.g. a larger touch target on mobile cards). */
  triggerClassName?: string;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", triggerClassName)}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
                Historical lead data is preserved; their properties become
                unassigned in lists.
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
