"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MonthOption {
  key: string;
  label: string;
}

export function MonthSelector({
  months,
  selected,
  thisMonthKey,
  lastMonthKey,
}: {
  months: MonthOption[];
  selected: string;
  thisMonthKey: string;
  lastMonthKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setMonth(key: string) {
    const next = new URLSearchParams(params.toString());
    next.set("month", key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selected} onValueChange={setMonth}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.key} value={m.key}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={selected === thisMonthKey ? "default" : "outline"}
        size="sm"
        onClick={() => setMonth(thisMonthKey)}
      >
        This month
      </Button>
      <Button
        variant={selected === lastMonthKey ? "default" : "outline"}
        size="sm"
        onClick={() => setMonth(lastMonthKey)}
      >
        Last month
      </Button>
    </div>
  );
}
