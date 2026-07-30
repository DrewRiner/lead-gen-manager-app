import { notFound } from "next/navigation";

import { GuideEditor } from "@/components/guides/guide-editor";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getGuideBySlug } from "@/lib/queries/guides";

export const metadata = { title: "Edit guide — LeadGen" };
export const dynamic = "force-dynamic";

export default async function EditGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <div>
      <PageHeader
        backHref={`/guides/${guide.slug}`}
        backLabel="Back to guide"
        title="Edit guide"
        description="Changes save to this guide."
      />
      <GuideEditor
        mode="edit"
        guide={{
          id: guide.id,
          title: guide.title,
          category: guide.category,
          summary: guide.summary,
          status: guide.status,
          blocks: guide.blocks.map((b) => ({ type: b.type, content: b.content })),
        }}
      />
    </div>
  );
}
