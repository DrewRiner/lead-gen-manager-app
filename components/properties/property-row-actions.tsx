"use client";

import { MoreHorizontal } from "lucide-react";

import { AssignClientDialog } from "@/components/properties/assign-client-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  PropertyDialog,
  type PropertyDialogValue,
} from "@/components/properties/property-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { unassignClient } from "@/lib/actions/assignments";
import { softDeleteProperty } from "@/lib/actions/properties";

export function PropertyRowActions({
  property,
  clients,
}: {
  property: PropertyDialogValue;
  clients: { id: string; businessName: string }[];
}) {
  const isAssigned = property.clientId != null;

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
          <PropertyDialog
            mode="edit"
            property={property}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Edit
              </DropdownMenuItem>
            }
          />
          <DropdownMenuSeparator />
          <AssignClientDialog
            propertyId={property.id}
            currentClientId={property.clientId}
            clients={clients}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                {isAssigned ? "Reassign client" : "Assign client"}
              </DropdownMenuItem>
            }
          />
          {isAssigned ? (
            <ConfirmDialog
              title="Unassign client?"
              description="Ends the active assignment as of today and marks the property unassigned. Historical revenue is preserved."
              confirmLabel="Unassign"
              action={unassignClient.bind(null, property.id)}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Unassign client
                </DropdownMenuItem>
              }
            />
          ) : null}
          <DropdownMenuSeparator />
          <ConfirmDialog
            destructive
            title="Delete property?"
            description={
              <>
                This soft-deletes <strong>{property.name}</strong>. Its
                historical lead and assignment data is preserved.
              </>
            }
            confirmLabel="Delete property"
            action={softDeleteProperty.bind(null, property.id)}
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
