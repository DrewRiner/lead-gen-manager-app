"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

export function LeadsFilters({
  properties,
  clients,
}: {
  properties?: { id: string; name: string }[];
  clients?: { id: string; businessName: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function clearAll() {
    setSearch("");
    router.push(pathname);
  }

  const hasFilters = Array.from(params.keys()).some((k) => k !== "page");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search caller / message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        {properties ? (
          <FilterSelect
            value={params.get("property") ?? ALL}
            onChange={(v) => setParam("property", v)}
            placeholder="Property"
            width="w-44"
            options={[
              { value: ALL, label: "All properties" },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        ) : null}
        {clients ? (
          <FilterSelect
            value={params.get("client") ?? ALL}
            onChange={(v) => setParam("client", v)}
            placeholder="Client"
            width="w-44"
            options={[
              { value: ALL, label: "All clients" },
              ...clients.map((c) => ({ value: c.id, label: c.businessName })),
            ]}
          />
        ) : null}
        <FilterSelect
          value={params.get("type") ?? ALL}
          onChange={(v) => setParam("type", v)}
          placeholder="Type"
          options={[
            { value: ALL, label: "All types" },
            { value: "call", label: "Call" },
            { value: "form", label: "Form" },
          ]}
        />
        <FilterSelect
          value={params.get("source") ?? ALL}
          onChange={(v) => setParam("source", v)}
          placeholder="Source"
          options={[
            { value: ALL, label: "All sources" },
            { value: "organic", label: "Organic" },
            { value: "gbp", label: "GBP" },
            { value: "direct", label: "Direct" },
            { value: "other", label: "Other" },
          ]}
        />
        <FilterSelect
          value={params.get("billableStatus") ?? ALL}
          onChange={(v) => setParam("billableStatus", v)}
          placeholder="Billable"
          width="w-40"
          options={[
            { value: ALL, label: "All billable" },
            { value: "billable", label: "Billable" },
            { value: "not_billable", label: "Not billable" },
            { value: "disputed", label: "Disputed" },
            { value: "pending_review", label: "Pending review" },
            { value: "spam", label: "Spam" },
          ]}
        />
        <FilterSelect
          value={params.get("deliveryStatus") ?? ALL}
          onChange={(v) => setParam("deliveryStatus", v)}
          placeholder="Delivery"
          options={[
            { value: ALL, label: "All delivery" },
            { value: "new", label: "New" },
            { value: "delivered", label: "Delivered" },
            { value: "billed", label: "Billed" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={params.get("from") ?? ""}
            onChange={(e) => setParam("from", e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={params.get("to") ?? ""}
            onChange={(e) => setParam("to", e.target.value)}
            className="w-40"
          />
        </div>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  width = "w-36",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`sm:${width}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
