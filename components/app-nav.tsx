"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  LayoutDashboard,
  PhoneCall,
  Settings,
  Users,
} from "lucide-react";

import { VISIBLE_OPERATOR_GUIDES } from "@/lib/guides/operator-guides";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/leads", label: "Leads", icon: PhoneCall },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const onGuides = item.href === "/guides" && pathname.startsWith("/guides");
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>

            {/* Guides expands into its list while you're in the section, so you
                always see where you are and can jump between runbooks. */}
            {onGuides ? (
              <div className="mt-1 space-y-0.5 border-l pl-3">
                {VISIBLE_OPERATOR_GUIDES.map((g) => {
                  const href = `/guides/${g.slug}`;
                  const current = pathname === href;
                  return (
                    <Link
                      key={g.slug}
                      href={href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm transition-colors",
                        current
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {g.navLabel}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
