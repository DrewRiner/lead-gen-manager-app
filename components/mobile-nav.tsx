"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/actions/auth";

// Mobile navigation drawer. Wraps the shared <AppNav> so any nav change —
// including the guides sub-list — renders here automatically. Closes itself on
// route change so a tap navigates and dismisses in one gesture.
export function MobileNav({
  email,
  role,
}: {
  email?: string | null;
  role?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <div className="flex h-16 shrink-0 items-center border-b px-6">
          <SheetTitle className="text-sm font-semibold leading-tight">
            Blue Carrot Solutions
            <span className="block text-xs font-normal text-muted-foreground">
              Command Center
            </span>
          </SheetTitle>
        </div>

        {/* 44px-min tap targets for every nav link, incl. any nested sub-list. */}
        <div className="flex-1 overflow-y-auto py-4 [&_a]:min-h-[44px]">
          <AppNav />
        </div>

        <div className="shrink-0 border-t p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-xs font-medium">{email}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {role ?? "member"}
            </p>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
