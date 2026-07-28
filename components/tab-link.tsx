import Link from "next/link";

import { cn } from "@/lib/utils";

/** Server-rendered tab, driven by a ?tab= search param. Shared by the
 *  dashboard and the property detail page. */
export function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** The tab strip container. */
export function TabNav({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 flex gap-1 border-b">{children}</div>;
}
