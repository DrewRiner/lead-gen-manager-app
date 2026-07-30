import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// One header for every page, so the app reads as deliberately built rather than
// assembled piecemeal. Uniform structure everywhere:
//   [optional back link]
//   Title            [actions — primary button + ActionsMenu, right-aligned]
//   subtitle / meta
//
// Conventions (see also components/actions-menu.tsx):
//   • Exactly one visible PRIMARY action as a solid Button.
//   • Everything else lives in the reusable ActionsMenu dropdown.
//   • Destructive actions go last in the menu, separated, danger-styled.
// Pass those through `children`; they render right-aligned on one row.
export function PageHeader({
  title,
  description,
  meta,
  backHref,
  backLabel = "Back",
  children,
}: {
  title: React.ReactNode;
  /** One-line subtitle under the title. */
  description?: React.ReactNode;
  /** Optional extra meta line under the description (badges, timestamps…). */
  meta?: React.ReactNode;
  /** Renders a consistent back link above the title. */
  backHref?: string;
  backLabel?: string;
  /** Actions: primary Button + ActionsMenu. Right-aligned. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
          {meta ? <div className="text-sm text-muted-foreground">{meta}</div> : null}
        </div>
        {children ? (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Consistent wrapper for a page's filter/control row, so filter bars align the
// same way on every list page (same margin + wrapping behavior).
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
  );
}
