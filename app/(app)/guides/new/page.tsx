import { GuideEditor } from "@/components/guides/guide-editor";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "New guide — LeadGen" };
export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  await requireUser();

  return (
    <div>
      <PageHeader
        backHref="/guides"
        backLabel="Guides"
        title="New guide"
        description="Build it block by block, then publish."
      />
      <GuideEditor mode="create" />
    </div>
  );
}
