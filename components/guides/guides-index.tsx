"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { GuideListItem } from "@/lib/queries/guides";

const UNCATEGORIZED = "Uncategorized";

export function GuidesIndex({ guides }: { guides: GuideListItem[] }) {
  const [q, setQ] = useState("");

  const { grouped, drafts, categories } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (g: GuideListItem) =>
      !needle ||
      g.title.toLowerCase().includes(needle) ||
      (g.summary ?? "").toLowerCase().includes(needle);

    const filtered = guides.filter(match);
    const published = filtered.filter((g) => g.status === "published");
    const drafts = filtered.filter((g) => g.status === "draft");

    const grouped = new Map<string, GuideListItem[]>();
    for (const g of published) {
      const cat = g.category?.trim() || UNCATEGORIZED;
      const list = grouped.get(cat) ?? [];
      list.push(g);
      grouped.set(cat, list);
    }
    const categories = [...grouped.keys()].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
    return { grouped, drafts, categories };
  }, [guides, q]);

  const nothing = grouped.size === 0 && drafts.length === 0;

  return (
    <div className="space-y-8">
      <Input
        placeholder="Search guides…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="sm:max-w-sm"
      />

      {nothing ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {guides.length === 0
            ? "No guides yet. Create the first one."
            : "No guides match your search."}
        </p>
      ) : null}

      {categories.map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {cat}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {grouped.get(cat)!.map((g) => (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="font-medium">{g.title}</div>
                {g.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {g.summary}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ))}

      {drafts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Drafts
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {drafts.map((g) => (
              <div
                key={g.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{g.title}</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      Draft
                    </span>
                  </div>
                  {g.summary ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {g.summary}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/guides/${g.slug}/edit`}
                  className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
