import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { GuideBlockView } from "@/components/guides/guide-block-view";
import { Button } from "@/components/ui/button";
import { getGuideBySlug } from "@/lib/queries/guides";

export const dynamic = "force-dynamic";

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/guides"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Guides
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href={`/guides/${guide.slug}/edit`}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>

      <div className="mb-6 space-y-2 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {guide.category ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {guide.category}
            </span>
          ) : null}
          {guide.status === "draft" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Draft
            </span>
          ) : null}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{guide.title}</h1>
        {guide.summary ? (
          <p className="text-muted-foreground">{guide.summary}</p>
        ) : null}
      </div>

      <article className="space-y-4">
        {guide.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">This guide has no content yet.</p>
        ) : (
          guide.blocks.map((b) => (
            <GuideBlockView key={b.id} type={b.type} content={b.content} />
          ))
        )}
      </article>
    </div>
  );
}
