import { performance } from "node:perf_hooks";
import postgres from "postgres";

const ms = (n: number) => `${n.toFixed(1)}ms`;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// A representative "route query" — a leads aggregation like getRangeMetrics.
async function agg(c: ReturnType<typeof postgres>) {
  await c`
    select count(*)::int as total,
           coalesce(sum(billed_amount),0) as rev
    from leads
    where deleted_at is null
      and occurred_at >= now() - interval '30 days'`;
}

async function run(url: string, max: number, label: string) {
  const c = postgres(url, { prepare: false, max });
  await agg(c); // warm the pool
  // Single query cost
  const single: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await agg(c);
    single.push(performance.now() - s);
  }
  // 8 queries via Promise.all (what a route's Promise.all does)
  const par: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await Promise.all(Array.from({ length: 8 }, () => agg(c)));
    par.push(performance.now() - s);
  }
  // 8 queries sequential
  const seq: number[] = [];
  for (let i = 0; i < 3; i++) {
    const s = performance.now();
    for (let k = 0; k < 8; k++) await agg(c);
    seq.push(performance.now() - s);
  }
  console.log(
    `${label.padEnd(26)} single=${ms(median(single)).padStart(8)}  8×Promise.all=${ms(median(par)).padStart(8)}  8×sequential=${ms(median(seq)).padStart(9)}`,
  );
  await c.end();
}

async function main() {
  const base = process.env.DATABASE_URL!;
  const t = base.replace(":5432", ":6543");
  console.log("Representative leads aggregation. 'Promise.all' = what routes do.\n");
  console.log("(warm; single-query ≈ 1 round-trip. If Promise.all ≈ 8×single, queries are SERIALIZED.)\n");
  await run(base, 1, "5432 session, max:1 (CURRENT)");
  await run(t, 1, "6543 txn,     max:1");
  await run(t, 8, "6543 txn,     max:8");
  await run(base, 8, "5432 session, max:8");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
