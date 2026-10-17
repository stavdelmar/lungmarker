// Bug 17 Oct: the header showed "2:02 active · 2:01 open". Active time can never exceed open time.
import { creditBoth, creditTotal, TOTAL_IDLE_SECONDS } from '@/hooks/useScanTimer';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };

// The old way: active +1 per 1-s interval tick, open measured in ms and rounded down. An interval firing after
// 997 ms already gives active 1 s vs open 0 s → active ahead (the reported "2:02 active · 2:01 open").
ok(1 > Math.floor(997 / 1000), 'old counting: active ahead after the first early tick (reproduces the bug)');
ok(creditBoth(0, 997, 0, { idleActive: 120, hidden: false }).active === 997, 'new: both clocks credit the same 997 ms');

const run = (steps, idleActive = 120) => {
  let last = 0, input = 0, tot = 0, act = 0, worst = 0;
  for (const s of steps) {
    if (s.input) input = s.at;
    const c = creditBoth(last, s.at, input, { idleActive, hidden: !!s.hidden });
    tot += c.total; act += c.active; last = s.at;
    worst = Math.max(worst, Math.floor(act / 1000) - Math.floor(tot / 1000));
  }
  return { tot: Math.floor(tot / 1000), act: Math.floor(act / 1000), worst };
};
// 1. steady work, ticks with jitter (997–1003 ms) for 2 minutes
const steady = []; for (let t = 0, i = 0; t < 122000; i++) { t += 997 + (i % 7); steady.push({ at: t, input: i % 3 === 0 }); }
const a = run(steady);
ok(a.worst <= 0 && a.act === a.tot, `steady work: active ${a.act} = open ${a.tot}, never ahead (worst +${a.worst})`);
// 2. random sessions: idle gaps, hidden tab, throttled background ticks — active never ahead of open
let worst = 0;
for (let k = 0; k < 300; k++) {
  const st = []; let t = 0;
  for (let i = 0; i < 400; i++) { t += Math.random() < 0.05 ? 20000 + Math.random() * 400000 : 900 + Math.random() * 300; st.push({ at: t, input: Math.random() < 0.3, hidden: Math.random() < 0.05 }); }
  const r = run(st, 60 + Math.floor(Math.random() * 240));
  worst = Math.max(worst, r.worst);
}
ok(worst <= 0, `300 random sessions: active never ahead of open (worst +${worst} s)`);
// 3. idle: last input at 0, 200 s later → open 200 s (under the 5-min cut-off), active 120 s
const i = creditBoth(0, 200000, 0, { idleActive: 120, hidden: false });
ok(i.total === 200000 && i.active === 120000, `idle 200 s: open 200 s, active 120 s (got ${i.total / 1000} / ${i.active / 1000})`);
ok(creditTotal(0, 600000, 0) === TOTAL_IDLE_SECONDS * 1000, 'open stops 5 min after the last input');
// 4. hidden tab: open counts, active doesn't
const h = creditBoth(0, 10000, 9000, { idleActive: 120, hidden: true });
ok(h.total === 10000 && h.active === 0, 'hidden tab: open 10 s, active 0');
// 5. idle setting above the 5-min open cut-off still can't push active over open
const big = creditBoth(0, 400000, 0, { idleActive: 600, hidden: false });
ok(big.active <= big.total, `idle setting 600 s: active ${big.active / 1000} ≤ open ${big.total / 1000}`);
console.log(fail ? `${fail} failed` : 'all pass');
