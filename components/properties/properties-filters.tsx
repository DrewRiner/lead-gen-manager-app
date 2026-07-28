"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

export function PropertiesFilters({
  niches,
  clients,
}: {
  niches: string[];
  clients: { id: string; businessName: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  // Debounce the free-text search.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        placeholder="Search name or domain…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />
      <Select
        value={params.get("status") ?? ALL}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          <SelectItem value="building">Building</SelectItem>
          <SelectItem value="optimizing">Optimizing</SelectItem>
          <SelectItem value="producing">Producing</SelectItem>
          <SelectItem value="trial">Trial</SelectItem>
          <SelectItem value="rented">Rented</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={params.get("niche") ?? ALL}
        onValueChange={(v) => setParam("niche", v)}
      >
        <SelectTrigger className="sm:w-40">
          <SelectValue placeholder="Niche" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All niches</SelectItem>
          {niches.map((n) => (
            <SelectItem key={n} value={n} className="capitalize">
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.get("client") ?? ALL}
        onValueChange={(v) => setParam("client", v)}
      >
        <SelectTrigger className="sm:w-44">
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All clients</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.businessName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
