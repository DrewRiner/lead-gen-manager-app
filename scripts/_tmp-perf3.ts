import { performance } from "node:perf_hooks";
import postgres from "postgres";
const ms = (n: number) => `${n.toFixed(0)}ms`;
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
async function agg(c: ReturnType<typeof postgres>) {
  await c`select count(*)::int as total, coalesce(sum(billed_amount),0) as rev
          from leads where deleted_at is null and occurred_at >= now() - interval '30 days'`;
}
const out: string[] = [];
async function run(url: string, max: number, label: string) {
  const c = postgres(url, { prepare: false, max, connect_timeout: 8, idle_timeout: 3 });
  try {
    await agg(c);
    const single: number[] = [];
    for (let i = 0; i < 3; i++) { const s = performance.now(); await agg(c); single.push(performance.now() - s); }
    const par: number[] = [];
    for (let i = 0; i < 3; i++) { const s = performance.now(); await Promise.all(Array.from({ length: 8 }, () => agg(c))); par.push(performance.now() - s); }
    out.push(`${label.padEnd(24)} single=${ms(med(single)).padStart(6)}   8xPromise.all=${ms(med(par)).padStart(7)}`);
  } catch (e) { out.push(`${label.padEnd(24)} ERROR ${(e as Error).message}`); }
  finally { await c.end({ timeout: 2 }); }
}
async function main() {
  const base = process.env.DATABASE_URL!;
  const t = base.replace(":5432", ":6543");
  await run(base, 1, "5432 session max:1 (CUR)");
  await run(t, 1, "6543 txn max:1");
  await run(t, 8, "6543 txn max:8");
  const fs = await import("node:fs");
  fs.writeFileSync("scripts/_perf_out.txt", "single ~ 1 round-trip. 8xPromise.all ~ 8xsingle => SERIALIZED.\n\n" + out.join("\n") + "\n");
  process.exit(0);
}
main().catch((e) => { const fs = require("node:fs"); fs.writeFileSync("scripts/_perf_out.txt", "FATAL " + String(e)); process.exit(1); });
