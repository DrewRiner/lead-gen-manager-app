import Link from "next/link";
import { Plus } from "lucide-react";

import { GuidesIndex } from "@/components/guides/guides-index";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PLATFORM } from "@/lib/config";
import { listGuides } from "@/lib/queries/guides";

export const metadata = { title: "Guides — LeadGen" };
export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const guides = await listGuides();

  return (
    <div>
      <PageHeader
        title={`${PLATFORM.name} Guides`}
        description="Help center — step-by-step playbooks for the team. Built and edited right here."
      >
        <Button asChild>
          <Link href="/guides/new">
            <Plus className="mr-2 h-4 w-4" /> New guide
          </Link>
        </Button>
      </PageHeader>

      <GuidesIndex guides={guides} />
    </div>
  );
}
