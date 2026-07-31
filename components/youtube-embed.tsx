import { cn } from "@/lib/utils";

// One responsive 16:9 youtube-nocookie embed, shared by /training and the
// guide pages so they can't drift. Unlisted videos, referenced by id.
export function YouTubeEmbed({
  videoId,
  title,
  className,
}: {
  videoId: string;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-muted", className)}>
      <div className="aspect-video">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title ?? "Training video"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}
