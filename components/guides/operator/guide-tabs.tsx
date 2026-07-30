"use client";

import "./operator-guide.css";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Two-tab wrapper around a designed operator guide. Owns the `.og` paper shell
// so both tabs share one surface. "Guide" is the full designed version; "Plain
// text" is the clean, copyable/printable version of the same content. Both are
// rendered and toggled with `hidden` so Done-checkbox state survives switching.
export function GuideTabs({
  guide,
  plain,
}: {
  guide: ReactNode;
  plain: ReactNode;
}) {
  const [tab, setTab] = useState<"guide" | "plain">("guide");
  return (
    <div className="og">
      <div className="og-page">
        <Link href="/guides" className="og-back">
          <ArrowLeft size={13} /> All guides
        </Link>
        <div className="og-tabbar" role="tablist" aria-label="Guide view">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "guide"}
            className={cn("og-tab", tab === "guide" && "og-tab--active")}
            onClick={() => setTab("guide")}
          >
            Guide
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "plain"}
            className={cn("og-tab", tab === "plain" && "og-tab--active")}
            onClick={() => setTab("plain")}
          >
            Plain text
          </button>
        </div>
        <div hidden={tab !== "guide"}>{guide}</div>
        <div hidden={tab !== "plain"}>{plain}</div>
      </div>
    </div>
  );
}
