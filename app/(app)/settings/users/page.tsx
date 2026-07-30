import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { asc } from "drizzle-orm";

import { PageHeader } from "@/components/page-header";
import { UsersPanel } from "@/components/settings/users-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export const metadata = { title: "Users — LeadGen" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // Server-side admin gate — members are redirected before any data loads.
  const caller = await requireAdmin();

  const users = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      role: profiles.role,
      deactivatedAt: profiles.deactivatedAt,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .orderBy(asc(profiles.createdAt));

  return (
    <div>
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Settings
      </Link>

      <PageHeader
        title="Users"
        description="Add, edit, and deactivate the internal staff who can access this app."
      />

      <Card>
        <CardHeader>
          <CardTitle>App users</CardTitle>
          <CardDescription>
            Admins manage everything, including this page. Members have full
            access except user management. Deactivating a user revokes their
            access immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <UsersPanel users={users} currentUserId={caller.id} />
        </CardContent>
      </Card>
    </div>
  );
}
