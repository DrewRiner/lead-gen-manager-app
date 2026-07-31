import { VIDEO_GUIDES } from "@/lib/video-guides";

// Vertical, ordered list of the training videos — meant to be watched top to
// bottom, not browsed, so no grid. Each row: a responsive 16:9 embed with its
// title + description beside it (stacked on mobile). Pure Tailwind/shadcn tokens
// — this is the main-app look, NOT the warm-paper /guides design system.
export function VideoGuidesList() {
  const total = VIDEO_GUIDES.length;

  return (
    <div className="mx-auto max-w-4xl divide-y">
      {VIDEO_GUIDES.map((v, i) => (
        <article
          key={v.id}
          className="grid gap-4 py-8 first:pt-0 md:grid-cols-2 md:gap-6"
        >
          <div className="overflow-hidden rounded-lg border bg-muted">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                title={v.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Video {i + 1} of {total}
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {v.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {v.description}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
