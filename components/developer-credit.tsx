import { DEVELOPER } from "@/lib/config";
import { cn } from "@/lib/utils";

// Understated developer credit. Reads from the single DEVELOPER constant so the
// name/URL are edited in one place. Used in the app footer and on the login page.
export function DeveloperCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Developed by{" "}
      <a
        href={DEVELOPER.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium hover:text-foreground hover:underline"
      >
        {DEVELOPER.name}
      </a>
    </p>
  );
}
