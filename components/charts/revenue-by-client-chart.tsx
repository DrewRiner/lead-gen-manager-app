"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCurrency } from "@/lib/money";
import type { ClientRevenue } from "@/lib/queries/revenue-by-client";
import { cn } from "@/lib/utils";

// Distinct categorical palette (our chart hues) + muted gray for "Other".
const PALETTE = [
  "hsl(221 83% 53%)",
  "hsl(160 60% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(190 80% 42%)",
  "hsl(340 75% 55%)",
  "hsl(24 90% 55%)",
];
const GRAY = "hsl(215 16% 65%)";
const OTHER_ID = "__other__";
const MAX_SLICES = 7; // group the smallest paid clients into "Other" beyond this
const CONCENTRATION = 0.4;

interface Slice {
  id: string;
  name: string;
  value: number;
  color: string;
}

export function RevenueByClientChart({ data }: { data: ClientRevenue[] }) {
  const router = useRouter();

  if (data.length === 0) {
    return <Empty />;
  }

  const paid = data.filter((d) => d.revenue > 0);
  const trials = data.filter((d) => d.revenue === 0);
  const total = paid.reduce((s, d) => s + d.revenue, 0);

  // Only trials active → no revenue to chart, but surface that they're occupying.
  if (total === 0) {
    return (
      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          No paid revenue in this period.
        </p>
        <Legend
          rows={trials.map((t) => ({
            id: t.clientId,
            name: t.clientName,
            value: 0,
            color: GRAY,
            pct: 0,
            trial: t.hasTrial,
          }))}
        />
      </div>
    );
  }

  // Bucket the smallest paid clients into "Other" beyond MAX_SLICES.
  let sliceClients = paid;
  let otherTotal = 0;
  if (paid.length > MAX_SLICES) {
    sliceClients = paid.slice(0, MAX_SLICES - 1);
    otherTotal = paid.slice(MAX_SLICES - 1).reduce((s, d) => s + d.revenue, 0);
  }

  const slices: Slice[] = sliceClients.map((d, i) => ({
    id: d.clientId,
    name: d.clientName,
    value: d.revenue,
    color: PALETTE[i % PALETTE.length],
  }));
  if (otherTotal > 0) {
    slices.push({ id: OTHER_ID, name: "Other", value: otherTotal, color: GRAY });
  }

  const legendRows = [
    ...slices.map((s) => ({
      id: s.id,
      name: s.name,
      value: s.value,
      color: s.color,
      pct: (s.value / total) * 100,
      trial: false,
    })),
    ...trials.map((t) => ({
      id: t.clientId,
      name: t.clientName,
      value: 0,
      color: GRAY,
      pct: 0,
      trial: t.hasTrial,
    })),
  ];

  const top = paid[0];
  const topShare = top.revenue / total;

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="h-52 w-52 shrink-0 self-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={54}
                outerRadius={84}
                paddingAngle={1}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                onClick={(entry: { id?: string }) => {
                  if (entry?.id && entry.id !== OTHER_ID) {
                    router.push(`/clients/${entry.id}`);
                  }
                }}
              >
                {slices.map((s) => (
                  <Cell
                    key={s.id}
                    fill={s.color}
                    cursor={s.id === OTHER_ID ? "default" : "pointer"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n: string) => [formatCurrency(v), n]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <Legend rows={legendRows} className="flex-1" />
      </div>

      {topShare > CONCENTRATION ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          {top.clientName} is {Math.round(topShare * 100)}% of revenue — high
          concentration.
        </p>
      ) : null}
    </div>
  );
}

function Legend({
  rows,
  className,
}: {
  rows: { id: string; name: string; value: number; color: string; pct: number; trial: boolean }[];
  className?: string;
}) {
  return (
    <ul className={cn("min-w-0 flex-1 space-y-1.5", className)}>
      {rows.map((r) => {
        const isOther = r.id === OTHER_ID;
        const inner = (
          <>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: r.color }}
              />
              <span className="truncate">{r.name}</span>
              {r.trial ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                  trial
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatCurrency(r.value)}
              <span className="ml-2 text-xs">{r.pct >= 1 || r.pct === 0 ? Math.round(r.pct) : r.pct.toFixed(1)}%</span>
            </span>
          </>
        );
        const cls = "flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm";
        return isOther ? (
          <li key={r.id} className={cls}>
            {inner}
          </li>
        ) : (
          <li key={r.id}>
            <Link href={`/clients/${r.id}`} className={cn(cls, "hover:bg-muted/60")}>
              {inner}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Empty() {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      No revenue in this period.
    </div>
  );
}
