"use client";

import dynamic from "next/dynamic";

import { ChartSkeleton } from "@/components/charts/chart-skeleton";

// Dynamic, client-only chart wrappers. recharts (~400KB) is heavy and none of
// these charts are needed for first paint, so they load in their own chunk
// after hydration with a skeleton in place. Keeps recharts out of the
// dashboard's first-load JS. Props/types flow through unchanged.

export const DailyVolumeChart = dynamic(
  () => import("@/components/charts/daily-volume-chart").then((m) => m.DailyVolumeChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-56 sm:h-72" /> },
);

export const RevenueByClientChart = dynamic(
  () =>
    import("@/components/charts/revenue-by-client-chart").then(
      (m) => m.RevenueByClientChart,
    ),
  { ssr: false, loading: () => <ChartSkeleton className="h-52" /> },
);

export const LifetimeTrendChart = dynamic(
  () => import("@/components/charts/lifetime-trend-chart").then((m) => m.LifetimeTrendChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-64 sm:h-80" /> },
);
