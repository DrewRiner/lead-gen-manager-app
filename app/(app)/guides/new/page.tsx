import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { GuideEditor } from "@/components/guides/guide-editor";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New guide — LeadGen" };
export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  await requireUser();

  return (
    <div>
      <Link
        href="/guides"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Guides
      </Link>
      <PageHeader title="New guide" description="Build it block by block, then publish." />
      <GuideEditor mode="create" />
    </div>
  );
}
