import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { DeveloperCredit } from "@/components/developer-credit";
import { MobileNav } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { getProfile, requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const profile = await getProfile();
  // Defense-in-depth: a deactivated profile is bounced from every app route,
  // even mid-session. (Banning also makes requireUser's getUser() fail, so a
  // deactivated user usually never gets this far.)
  if (profile?.deactivatedAt) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/20 md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-sm font-semibold leading-tight">
            Blue Carrot Solutions
            <span className="block text-xs font-normal text-muted-foreground">
              Command Center
            </span>
          </span>
        </div>
        <div className="flex-1 py-4">
          <AppNav />
        </div>
        <div className="border-t p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-xs font-medium">{profile?.email}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {profile?.role ?? "member"}
            </p>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: hamburger opens the nav drawer. */}
        <header className="flex h-14 items-center gap-1 border-b px-2 md:hidden">
          <MobileNav email={profile?.email} role={profile?.role} />
          <span className="text-sm font-semibold">Blue Carrot Solutions</span>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
        <footer className="border-t px-4 py-4 md:px-8">
          <DeveloperCredit />
        </footer>
      </div>
    </div>
  );
}
