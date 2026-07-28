"use client";

import { MoreHorizontal } from "lucide-react";

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { softDeleteProperty } from "@/lib/actions/properties";

export function PropertyRowActions({
  property,
  clients,
}: {
  property: PropertyDialogValue;
  clients: { id: string; businessName: string }[];
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
          <PropertyDialog
            mode="edit"
            property={property}
            clients={clients}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Edit
              </DropdownMenuItem>
            }
          />
          <ConfirmDialog
            destructive
            title="Delete property?"
            description={
              <>
                This soft-deletes <strong>{property.name}</strong>. Its
                historical lead data is preserved and it stops appearing in
                lists. This can be undone in the database.
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
