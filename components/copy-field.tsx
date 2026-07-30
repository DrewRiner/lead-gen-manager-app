"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

// A read-only value shown in a mono box with a copy button. Used for webhook
// URLs (property setup help, Settings → Webhooks style).
export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border bg-muted/50 px-2 py-1.5 text-xs">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
