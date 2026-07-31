"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DailyVolumePoint {
  day: string; // YYYY-MM-DD
  label: string; // e.g. "Jul 3"
  calls: number;
  forms: number;
}

export function DailyVolumeChart({ data }: { data: DailyVolumePoint[] }) {
  return (
    <div className="h-56 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            className="stroke-muted"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Bar
            dataKey="calls"
            stackId="v"
            name="Calls"
            fill="hsl(221 83% 53%)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="forms"
            stackId="v"
            name="Forms"
            fill="hsl(160 60% 45%)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
