/* =====================================================================
   LAYER 2: LOGIC
   Pure rules. Every function takes plain values and returns plain values.
   Nothing here reads the page, the clock or the global app state.
   Functions marked "Changes ... in place" edit the object passed in and
   return it; nothing else is touched.
   ===================================================================== */

/* ---------- 2.1 Derived lookups (read-only, built once from the data) ---------- */

// Returns {exerciseId: {plan, day, item}} for every exercise in both plans,
// plus the synthetic powerbuilding warm-up checklists (pb-dN-warmup).
function buildExerciseIndex(programme){
  const out = {};
  programme.plans.hd.days.forEach(d => d.groups.forEach(g => g.items.forEach(item => {
    out[item.id] = {plan: "hd", day: d.n, item: item};
  })));
  programme.plans.pb.days.forEach(d => {
    out[warmupId(d.n)] = {plan: "pb", day: d.n, item: warmupItem(programme.plans.pb, d)};
    d.items.forEach(item => { out[item.id] = {plan: "pb", day: d.n, item: item}; });
  });
  return out;
}
const EXERCISES = buildExerciseIndex(PROGRAMME);
const PLAN_IDS = ["hd", "pb"];

// Takes a day number. Returns the id used for that powerbuilding day's warm-up checklist.
function warmupId(dayN){ return "pb-d" + dayN + "-warmup"; }

// Takes the powerbuilding plan and one of its days. Returns the day's warm-up as a checklist item.
// Rule: the four warm-up steps from the plan, with the day's roll areas and moves filled in.
function warmupItem(pb, day){
  return {
    id: warmupId(day.n), name: "Warm-up (10 minutes)", kind: "warmup", log: "check", equip: "Bike, foam roller, band",
    sets: "10 min", setCount: 4, left: "Easy", rest: "", notes: "", swap: "",
    checklist: [
      pb.warmup.steps[0],
      "Foam roller, 3 to 5 minutes: " + day.roll + ".",
      "Warm-up moves, 8 to 10 reps each: " + day.moves.join("; ") + ".",
      pb.warmup.steps[3]
    ]
  };
}

/* ---------- 2.2 Dates and formatting ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function pad2(n){ return (n < 10 ? "0" : "") + n; }
// Takes a Date. Returns "YYYY-MM-DD" in local time.
function toISO(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
// Takes "YYYY-MM-DD". Returns a local Date, or null when the text isn't a real date.
function parseISO(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}
function addDays(iso, n){ const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
// Takes a date. Returns the Monday of its week (weeks run Monday to Sunday).
function mondayOf(iso){ const d = parseISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }
function daysBetween(a, b){ return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function laterOf(a, b){ return a > b ? a : b; }
function weekdayName(iso){ const d = parseISO(iso); return d ? WEEKDAYS[d.getDay()] : ""; }
// "5 October 2026"
function fmtDate(iso){ const d = parseISO(iso); return d ? d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() : "an unknown date"; }
// "Monday 19 October 2026"
function fmtDayDate(iso){ return weekdayName(iso) + " " + fmtDate(iso); }
// Takes a Monday. Returns "5 to 11 October 2026", across months and years as needed.
function fmtRange(start){
  const end = addDays(start, 6), a = parseISO(start), b = parseISO(end);
  if (a.getFullYear() !== b.getFullYear()) return fmtDate(start) + " to " + fmtDate(end);
  if (a.getMonth() !== b.getMonth()) return a.getDate() + " " + MONTHS[a.getMonth()] + " to " + b.getDate() + " " + MONTHS[b.getMonth()] + " " + b.getFullYear();
  return a.getDate() + " to " + b.getDate() + " " + MONTHS[b.getMonth()] + " " + b.getFullYear();
}
function fmtNum(n){ return String(Math.round(Number(n) * 100) / 100); }
// Takes a load and "kg" or "plates". Returns "62.5 kg" or "3 plates".
function fmtLoad(n, unit){
  if (unit === "plates") return fmtNum(n) + (Number(n) === 1 ? " plate" : " plates");
  return fmtNum(n) + " kg";
}
function listWords(a){ return a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
function weekWord(n){ return n === 1 ? "one week" : n === 2 ? "two weeks" : n + " weeks"; }
function keyOf(name){ return String(name || "").trim().toLowerCase(); }
function otherPlan(plan){ return plan === "hd" ? "pb" : "hd"; }

/* ---------- 2.3 The block calendar ---------- */

// The cycle is {start, first, lengths}. Blocks alternate between the two plans, starting with cycle.first
// on cycle.start. lengths[i] is block i's length in weeks; a missing entry means CONFIG.blockWeeks.
// A length of 0 skips that block (used when you switch plans in the first week of a block).

// Takes the cycle and a block index. Returns the block's length in weeks.
function blockLength(cycle, b){
  const L = cycle.lengths, n = Array.isArray(L) && L[b] != null ? Number(L[b]) : CONFIG.blockWeeks;
  return n >= 0 && n <= CONFIG.maxBlockWeeks ? n : CONFIG.blockWeeks;
}
// Takes the cycle and a block index. Returns the block's plan id.
function blockPlan(cycle, b){ return b % 2 === 0 ? cycle.first : otherPlan(cycle.first); }
// Takes the cycle and a block index. Returns {at, pbWeeks}: weeks before the block, and how many were powerbuilding.
function blockOffset(cycle, b){
  let at = 0, pbWeeks = 0;
  for (let i = 0; i < b; i++){ const len = blockLength(cycle, i); at += len; if (blockPlan(cycle, i) === "pb") pbWeeks += len; }
  return {at: at, pbWeeks: pbWeeks};
}
// Takes the cycle and a week number counted from the start. Returns {b, at, len, pbWeeks} for the block holding it.
function blockAtWeek(cycle, weekIndex){
  let b = 0, at = 0, pbWeeks = 0;
  for (;;){
    const len = blockLength(cycle, b);
    if (weekIndex < at + len || b > 5000) return {b: b, at: at, len: len, pbWeeks: pbWeeks};
    if (blockPlan(cycle, b) === "pb") pbWeeks += len;
    at += len; b++;
  }
}

// Takes the cycle and any date.
// Returns where that date sits: {before, weekStart, weekIndex, blockIndex, blockStart, blockWeeks, plan,
//   blockWeek (1 to blockWeeks), weekLetter ("A" or "B"), pbWeek, fortnight (powerbuilding only: 1, 2 or 3),
//   heavyWeek, testWeek}.
// Rules: Heavy Duty weeks are all the same, numbered within the block. Powerbuilding weeks count on across
//   every powerbuilding block, so a longer block moves on through the programme: weeks pair into A and B,
//   pairs count blocks 1, 2 and 3, then repeat. Block 3's Week A is the heavy week and its Week B is test week.
function weekInfo(cycle, iso){
  const start = mondayOf(cycle.start), week = mondayOf(iso);
  const before = daysBetween(start, week) < 0;
  const weekIndex = before ? 0 : Math.floor(daysBetween(start, week) / 7);
  const k = blockAtWeek(cycle, weekIndex);
  const plan = blockPlan(cycle, k.b), blockWeek = weekIndex - k.at + 1;
  const info = {before: before, weekStart: before ? start : week, weekIndex: weekIndex, blockIndex: k.b, blockStart: addDays(start, 7 * k.at),
    blockWeeks: k.len, plan: plan, blockWeek: blockWeek, weekLetter: blockWeek % 2 === 1 ? "A" : "B", pbWeek: null,
    fortnight: null, heavyWeek: false, testWeek: false};
  if (plan === "pb"){
    const n = k.pbWeeks + blockWeek - 1;
    info.pbWeek = n;
    info.weekLetter = n % 2 === 0 ? "A" : "B";
    info.fortnight = (Math.floor(n / 2) % PROGRAMME.plans.pb.fortnights.length) + 1;
    info.heavyWeek = info.fortnight === 3 && info.weekLetter === "A";
    info.testWeek = info.fortnight === 3 && info.weekLetter === "B";
  }
  return info;
}

// Takes the cycle and a date. Returns {date, plan}: the Monday the plan next changes, and the plan it changes to.
function nextSwap(cycle, iso){
  const w = weekInfo(cycle, iso);
  if (w.before) return {date: mondayOf(cycle.start), plan: cycle.first};
  let d = addDays(w.blockStart, 7 * w.blockWeeks);
  for (let i = 0; i < 200; i++){
    const x = weekInfo(cycle, d);
    if (x.plan !== w.plan) return {date: d, plan: x.plan};
    d = addDays(x.blockStart, 7 * Math.max(1, x.blockWeeks));
  }
  return {date: d, plan: otherPlan(w.plan)};
}

// Takes the cycle, a plan id and a date. Returns the first Monday on or after that date scheduled for the plan.
function nextWeekForPlan(cycle, plan, fromISO){
  let w = laterOf(mondayOf(fromISO), mondayOf(cycle.start));
  for (let i = 0; i < CONFIG.maxBlockWeeks * 4 + 8; i++){
    const x = weekInfo(cycle, w);
    if (x.plan === plan) return w;
    w = addDays(x.blockStart, 7 * Math.max(1, x.blockWeeks));
  }
  return w;
}

// Takes the cycle and a block index. Returns which run of its plan the block is: 1 for the first Heavy Duty
// block, 2 for the second, and so on. Skipped (0-week) blocks don't count.
function planRun(cycle, b){
  const plan = blockPlan(cycle, b);
  let n = 0;
  for (let i = 0; i <= b; i++) if (blockPlan(cycle, i) === plan && blockLength(cycle, i) > 0) n++;
  return Math.max(1, n);
}
// Takes the cycle, the first block index and how many blocks. Returns those blocks for the calendar:
// [{index, plan, start, weeks, list: [weekInfo for each week]}]. Blocks of 0 weeks are left out.
function calendarBlocks(cycle, fromIndex, count){
  const out = [], start = mondayOf(cycle.start);
  for (let b = Math.max(0, fromIndex); out.length < count && b < fromIndex + count * 3 + 4; b++){
    const len = blockLength(cycle, b);
    if (!len) continue;
    const at = blockOffset(cycle, b).at, first = addDays(start, 7 * at), list = [];
    for (let i = 0; i < len; i++) list.push(weekInfo(cycle, addDays(first, 7 * i)));
    out.push({index: b, plan: blockPlan(cycle, b), start: first, weeks: len, list: list});
  }
  return out;
}

// Takes the cycle, a block index and today. Returns what may change on that block:
// {locked, step, min, max, why}. Rules: past blocks are fixed. Both plans move a week at a time; a powerbuilding
// run that ends on Week A picks up at Week B next time. The block you're in can't end before this week.
function blockLimits(cycle, b, today){
  const plan = blockPlan(cycle, b), now = weekInfo(cycle, today);
  const out = {locked: false, step: CONFIG.blockStep[plan], min: CONFIG.minBlockWeeks[plan], max: CONFIG.maxBlockWeeks, why: ""};
  if (!now.before && b < now.blockIndex){ out.locked = true; out.why = "This block is in the past."; return out; }
  if (!now.before && b === now.blockIndex && now.blockWeek > out.min){ out.min = now.blockWeek; out.why = "You're in week " + now.blockWeek + " of this block, so it can't be shorter."; }
  return out;
}

// Takes the cycle, a block index and a length in weeks. Returns a new cycle with that block's length set.
function withBlockLength(cycle, b, weeks){
  const L = Array.isArray(cycle.lengths) ? cycle.lengths.slice() : [];
  for (let i = 0; i <= b; i++) if (L[i] == null) L[i] = CONFIG.blockWeeks;
  L[b] = weeks;
  return {start: cycle.start, first: cycle.first, lengths: L};
}

// Takes the cycle and today. Returns a new cycle where the other plan starts this week.
// Rule: weeks already done stay where they are, so labels and powerbuilding progress don't jump.
function switchCycleNow(cycle, today){
  const now = weekInfo(cycle, today);
  if (now.before) return {start: mondayOf(today), first: otherPlan(cycle.first), lengths: []};
  return withBlockLength(cycle, now.blockIndex, now.blockWeek - 1);
}

// Takes the cycle and today. Returns a new cycle with every block after the current one back to the default length.
function resetUpcomingBlocks(cycle, today){
  const now = weekInfo(cycle, today), L = Array.isArray(cycle.lengths) ? cycle.lengths.slice(0, now.blockIndex + 1) : [];
  return {start: cycle.start, first: cycle.first, lengths: L};
}
// Takes the cycle and today. Returns true when a block after the current one has a non-default length.
function hasUpcomingChanges(cycle, today){
  const now = weekInfo(cycle, today), L = Array.isArray(cycle.lengths) ? cycle.lengths : [];
  for (let i = now.blockIndex + 1; i < L.length; i++) if (L[i] != null && Number(L[i]) !== CONFIG.blockWeeks) return true;
  return false;
}

// Takes the cycle, a plan id and two dates. Returns the whole weeks between them, not counting weeks
// scheduled for the other plan. Rule: time spent on the other plan doesn't count as a break.
function planWeeksBetween(cycle, plan, fromISO, toISO){
  const total = Math.max(0, Math.floor(daysBetween(fromISO, toISO) / 7));
  let other = 0, w = addDays(mondayOf(fromISO), 7);
  while (daysBetween(w, toISO) >= 7){
    if (weekInfo(cycle, w).plan !== plan) other++;
    w = addDays(w, 7);
  }
  return Math.max(0, total - other);
}

// Takes a date. Returns its place in the week: 1 (Monday) to 7 (Sunday).
function dayOfWeek(iso){ return daysBetween(mondayOf(iso), iso) + 1; }

/* ---------- 2.4 Reading the plan text ---------- */

// Takes plan text like "2W + 1". Returns plain words: "2 warm-ups + 1 main set".
function plainSets(text){
  return String(text || "")
    .replace(/(\d)W \+ (\d)/, (m, w, k) => w + (w === "1" ? " warm-up" : " warm-ups") + " + " + k + (k === "1" ? " main set" : " main sets"))
    .replace(/^1$/, "1 main set");
}
// Takes a row label from the data. Returns the words shown on screen.
function plainRowLabel(label){
  return String(label)
    .replace(/^Working( \d+)?$/, (m, n) => "Main set" + (n || ""))
    .replace(/^(\d) shy of failure$/, (m, n) => "Stop " + n + (n === "1" ? " rep" : " reps") + " short")
    .replace(/^Max reps$/, "As many as you can");
}
// Heavy Duty: takes an item. Returns the main-set rep target, e.g. "10–12", or null.
function workingTarget(item){
  if (item.repMin != null) return item.repMin === item.repMax ? String(item.repMin) : item.repMin + "–" + item.repMax;
  const reps = item.reps || "";
  const part = reps.indexOf("→") >= 0 ? reps.split("→").pop() : reps;
  const t = part.replace(/@ 100%/g, "").replace(/each/g, "").trim();
  return /\d/.test(t) ? t : null;
}
// Takes an item. Returns {min, max} reps for its main sets, or null when the plan gives no numbers.
function repRange(item){
  if (item.repMin != null) return {min: item.repMin, max: item.repMax};
  const t = workingTarget(item); if (!t) return null;
  const nums = t.match(/\d+/g).map(Number);
  return {min: nums[0], max: nums[nums.length - 1]};
}
// Heavy Duty: takes an item. Returns the percentage for each prescribed set, e.g. [50, 70, 100].
function planPercents(item){
  return String(item.reps || "").split(/,|→/).map(p => { const m = p.match(/@\s*(\d+)%/); return m ? Number(m[1]) : null; });
}
// Heavy Duty: takes a sets text. Returns default row labels. Rule: "2W + 1" gives two warm-ups and one main set.
function parseRows(sets){
  const m = String(sets).match(/^(\d)W \+ (\d)$/);
  if (m){
    const w = +m[1], k = +m[2], out = [];
    for (let i = 0; i < w; i++) out.push(w > 1 ? "Warm-up " + (i + 1) : "Warm-up");
    for (let j = 0; j < k; j++) out.push(k > 1 ? "Working " + (j + 1) : "Working");
    return out;
  }
  if (sets === "1") return ["Working"];
  if (sets === "1 per leg") return ["Left leg", "Right leg"];
  const n = parseInt(sets, 10) || 1, rows = [];
  for (let i = 0; i < n; i++) rows.push("Set " + (i + 1));
  return rows;
}
// Takes reps-left text like "2–3", "1, last set to failure" or "Can still talk". Returns {min, max} or null.
function parseLeft(text){
  const m = String(text || "").match(/^(?:About )?(\d)(?:\s*[–-]\s*(\d))?/i);
  return m ? {min: +m[1], max: m[2] ? +m[2] : +m[1]} : null;
}
// Takes reps-left text with week variants, e.g. "3 (Wk A), 2 (Wk B)", and "A" or "B". Returns that week's text.
function leftForWeek(text, letter){
  const m = String(text).match(/^(.+?) \(Wk A\), (.+?) \(Wk B\)$/);
  return m ? (letter === "A" ? m[1] : m[2]) : text;
}

/* ---------- 2.5 Building a session ---------- */

// Takes a Heavy Duty item and the chosen variation id. Returns the variation object, or null.
// Rule: the chosen one, else the first.
function variantFor(planId, item, variantId){
  if (!item.variants) return null;
  const list = PROGRAMME.plans[planId].variants[item.variants];
  return list.filter(v => v.id === variantId)[0] || list[0];
}

// Takes a plan id, a day number, the week (from weekInfo) and {exerciseId: variationId}.
// Returns the session to show: {plan, n, title, time, intro, notes[], rest, groups[{title, pair, items[]}]}.
// Each item: {id, plan, day, name, pair, kind, log, equip, setsText, leftText, rest, notes, swap, tag,
//   optional, counted, skipped, variants, variant, rows[{label, role, reps, left, pct}], repMin, repMax,
//   backoffPct, lift, checklist}.
// Rules: Heavy Duty is the same every week. Powerbuilding changes by fortnight and Week A or B:
//   main lifts follow the fortnight table, the three secondary lifts lose a rep from fortnight 2 and drop
//   to two sets in fortnight 3, easy bike gains 5 minutes in fortnight 2, sprints stop in fortnight 3,
//   and test week replaces Days 1 to 3 with test singles, Day 4 with stretching and bike, Day 5 with rest.
function buildSession(planId, dayN, week, variantChoice){
  return planId === "hd" ? buildHdSession(dayN, variantChoice) : buildPbSession(dayN, week, variantChoice);
}

function buildHdSession(dayN, variantChoice){
  const plan = PROGRAMME.plans.hd, day = plan.days.filter(d => d.n === dayN)[0];
  const groups = day.groups.map(g => ({title: g.title, pair: null, items: g.items.map(item => {
    const v = variantFor("hd", item, variantChoice[item.id]);
    const labels = (v && v.rows) || item.rows || parseRows(item.sets);
    const pcts = planPercents(item);
    return {
      id: item.id, plan: "hd", day: dayN, name: item.name, pair: null, kind: "hd", log: "hd", equip: item.equip,
      setsText: plainSets(item.sets), repsText: item.reps, leftText: "", rest: item.rest, notes: item.notes, swap: "",
      tag: item.tag || "", optional: !!item.optional, counted: !item.optional, skipped: false,
      variants: item.variants ? plan.variants[item.variants] : null, variant: v ? v.id : null, unitHint: v && v.unit ? v.unit : null,
      rows: labels.map((label, i) => ({label: label, role: /^Warm-up/.test(label) ? "warm" : "work", pct: pcts[i] != null ? pcts[i] : null})),
      repMin: null, repMax: null, reps: item.reps, sourceSets: item.sets
    };
  })}));
  return {plan: "hd", n: dayN, title: day.title, time: "", intro: "", notes: [], rest: false, groups: groups};
}

function buildPbSession(dayN, week, variantChoice){
  const pb = PROGRAMME.plans.pb, day = pb.days.filter(d => d.n === dayN)[0];
  const f = pb.fortnights[(week.fortnight || 1) - 1], letter = week.weekLetter || "A";
  const session = {plan: "pb", n: dayN, title: day.title, time: day.time, intro: day.intro, notes: [], rest: false, groups: []};
  if (f.changes) session.notes.push("This fortnight: " + f.changes + ".");
  if (week.testWeek){
    if (dayN === pb.testWeek.restDay){ session.rest = true; session.notes = ["Test week: rest today."]; return session; }
    session.notes = ["Test week. " + pb.testWeek.steps.join(" ")];
    if (dayN === pb.testWeek.lightDay) session.notes = [pb.testWeek.lightDayNote];
  }
  const items = [pbItem(warmupItem(pb, day), dayN, week, f, letter, null)].concat(day.items.map(item => pbItem(item, dayN, week, f, letter, variantChoice[item.id])));
  if (week.testWeek){
    items.forEach(it => {
      const isTestLift = pb.testWeek.days[String(dayN)] && it.lift === pb.testWeek.days[String(dayN)];
      const keepLight = dayN === pb.testWeek.lightDay && pb.testWeek.lightDayIds.indexOf(it.id) >= 0;
      if (isTestLift){
        it.rows = pb.testWeek.rows.map(r => ({label: r.label, role: "test", reps: "1", left: r.left}));
        it.setsText = "Test singles"; it.leftText = "3, then 2, then 1 left";
        it.notes = "Spotter or safety pins for the optional extra try.";
      } else if (!keepLight && it.kind !== "warmup"){
        it.optional = true; it.counted = false;
        if (dayN === pb.testWeek.lightDay){ it.skipped = true; it.notes = "Not this week."; }
        else it.notes = "Optional. Two light accessories, then go home.";
      }
    });
  }
  // Group consecutive pairs (A1 + A2) into one block
  let current = null;
  items.forEach(it => {
    const letterOf = it.pair ? it.pair.charAt(0) : null;
    if (letterOf && current && current.pair === letterOf) current.items.push(it);
    else { current = {title: null, pair: letterOf, items: [it]}; session.groups.push(current); }
  });
  return session;
}

// Takes a powerbuilding item and the week. Returns the session item for this week.
function pbItem(item, dayN, week, f, letter, variantId){
  const pb = PROGRAMME.plans.pb;
  const v = variantFor("pb", item, variantId);
  const out = {
    id: item.id, plan: "pb", day: dayN, name: item.name, pair: item.pair || null, kind: item.kind, log: item.log,
    equip: item.equip, setsText: item.sets || "", leftText: item.left || "", rest: item.rest || "", notes: item.notes || "",
    swap: item.swap || "", tag: "", optional: item.kind === "warmup", counted: item.kind !== "warmup", skipped: false,
    variants: item.variants ? pb.variants[item.variants] : null, variant: v ? v.id : null, unitHint: null,
    rows: [], repMin: item.repMin != null ? item.repMin : null, repMax: item.repMax != null ? item.repMax : null,
    backoffPct: null, lift: item.lift || null, checklist: item.checklist || null, rule: item.rule || null, swapNote: item.swapNote || ""
  };
  if (item.kind === "main"){
    const top = f.top[letter] === "test" ? f.top.A : f.top[letter];
    const boSets = item.lift === "deadlift" ? pb.deadliftBackoffSets : f.backoff.sets;
    out.backoffPct = f.backoff.pct;
    out.repMin = top.reps; out.repMax = top.reps;
    out.setsText = "1 × " + top.reps + " top set, then " + boSets + " × " + f.backoff.reps + " back-offs";
    out.leftText = top.left + " left on the top set, about 3 on back-offs";
    out.rest = item.top.rest + " after the top set, " + item.backoff.rest + " after back-offs";
    out.notes = item.top.notes + " Back-offs: " + f.backoff.pct + "% lighter than the top set" + (item.lift === "deadlift" ? "; reset between reps." : ".");
    out.rows = [{label: "Top set", role: "top", reps: String(top.reps), left: top.left}];
    for (let i = 0; i < boSets; i++) out.rows.push({label: "Back-off " + (i + 1), role: "backoff", reps: String(f.backoff.reps), left: "About 3"});
    return out;
  }
  let sets = item.setCount || 1;
  const sp = pb.secondaryPattern;
  if (sp.ids.indexOf(item.id) >= 0){
    const delta = sp.repsDelta[String(f.n)] || 0;
    if (delta){ out.repMin += delta; out.repMax += delta; }
    if (sp.sets[String(f.n)]) sets = sp.sets[String(f.n)];
    out.setsText = sets + " × " + (out.repMin === out.repMax ? out.repMin : out.repMin + "–" + out.repMax);
    if (f.n > 1) out.notes = (out.notes ? out.notes + " " : "") + "Slightly harder than the first fortnight.";
  }
  if (item.leftByWeek) out.leftText = item.leftByWeek[letter];
  if (item.log === "time" && f.cardioAddMin){
    out.repMin += f.cardioAddMin; out.repMax += f.cardioAddMin;
    out.setsText = (out.repMin === out.repMax ? out.repMin : out.repMin + "–" + out.repMax) + " min";
  }
  if (f.skipIds && f.skipIds.indexOf(item.id) >= 0){ out.skipped = true; out.counted = false; out.optional = true; out.notes = "Not this fortnight."; }
  if (item.log === "check") out.rows = item.checklist.map(c => ({label: c, role: "check"}));
  else if (item.log === "time") out.rows = [{label: "Ride", role: "time"}];
  else if (item.log === "rounds") out.rows = [{label: "Sprint rounds", role: "rounds"}];
  else {
    // "1, last set to failure": 1 left on every set except the last, which goes to failure
    const fail = /^(.+), last set to failure$/.exec(out.leftText);
    for (let i = 0; i < sets; i++) out.rows.push({label: "Set " + (i + 1), role: "set", reps: out.repMin === out.repMax ? String(out.repMin) : out.repMin + "–" + out.repMax,
      left: fail ? (i === sets - 1 ? "0" : fail[1]) : out.leftText});
  }
  return out;
}

// Takes reps-left text from the plan. Returns it as a short phrase: "2 left", "about 3 left",
// "1 left, last set to failure", "to failure", or the text unchanged ("Can still talk").
// For carries (log "carry") the number reads as an effort level instead: "effort: hard".
function leftPhrase(text, log){
  const t = String(text || "");
  if (log === "carry" && /^\d$/.test(t)){
    const lvl = CONFIG.carryEffortScale.filter(x => String(x.left) === t)[0];
    return lvl ? "effort: " + lvl.name.toLowerCase() : t;
  }
  let m = /^(.+), last set to failure$/.exec(t);
  if (m) return m[1] + " left, last set to failure";
  if (t === "0") return "to failure";
  m = /^About (\d)$/i.exec(t);
  if (m) return "about " + m[1] + " left";
  if (/^\d(\s*[–-]\s*\d)?$/.test(t)) return t + " left";
  return t;
}

// Takes the slot and the week's sessions. Returns {done, total}: training days fully done (not missed days).
function weekDaysDone(slot, sessions){
  const train = sessions.filter(x => !x.rest);
  return {done: train.filter(x => dayIsDone(slot, x) && !(slot.missedDays || {})[x.n]).length, total: train.length};
}

// Takes a slot and the current Monday. Moves an untouched slot forward to this week, so a plan with
// nothing logged never asks for "Start new week". Changes slot in place.
function alignEmptySlot(slot, weekStart){
  const touched = Object.keys(slot.entries || {}).some(id => { const e = slot.entries[id]; return e && ((e.sets || []).some(isLogged) || e.replaced || (e.missed && e.missed.on)); });
  if (!touched && slot.weekStart < weekStart){ slot.weekStart = weekStart; slot.missedDays = {}; }
  return slot;
}

// Takes a session. Returns its items in order, flattened.
function sessionItems(session){ return [].concat.apply([], session.groups.map(g => g.items)); }

/* ---------- 2.6 Entries, completion and progress ---------- */
function emptySet(){ return {reps: "", kg: ""}; }
function isLogged(s){ return !!s && Number(s.reps) > 0; }
function isMissed(e){ return !!(e && e.missed && e.missed.on && !e.missed.madeUp); }
function isMadeUp(e){ return !!(e && e.missed && e.missed.on && e.missed.madeUp); }
// Takes an entry. Returns true when at least one set (or replacement set) is logged and it isn't missed.
function isComplete(e){
  if (!e || isMissed(e)) return false;
  return (e.sets || []).some(isLogged) || !!(e.replaced && e.repl && e.repl.sets.some(isLogged));
}
function isAccounted(e){ return isComplete(e) || isMissed(e); }

// Takes a slot and a session item. Returns the item's entry, creating an empty one if needed.
// Changes slot.entries in place. Rule: an untouched entry follows the item's current rows.
function ensureEntry(slot, item){
  let e = slot.entries[item.id];
  if (!e){
    e = {sets: item.rows.map(emptySet), replaced: false, repl: {name: "", reason: "", sets: [emptySet()], date: null}, doneAt: null};
    slot.entries[item.id] = e;
  }
  if (!e.repl) e.repl = {name: "", reason: "", sets: [emptySet()], date: null};
  if (!e.missed) e.missed = {on: false, reason: "", date: null};
  if (!e.sets.some(isLogged) && e.sets.length !== item.rows.length) e.sets = item.rows.map(emptySet);
  if (e.replaced && !e.repl.sets.some(isLogged) && e.repl.sets.length !== item.rows.length) e.repl.sets = item.rows.map(emptySet);
  return e;
}

// Takes a slot and a session. Returns {done, missed, accounted, total} for the counted items.
function dayProgress(slot, session){
  const counted = sessionItems(session).filter(it => it.counted);
  const done = counted.filter(it => isComplete(slot.entries[it.id])).length;
  const missed = counted.filter(it => isMissed(slot.entries[it.id])).length;
  return {done: done, missed: missed, accounted: done + missed, total: counted.length};
}
// Takes a slot and a session. Returns true when every counted item is done or missed.
function dayIsDone(slot, session){ const p = dayProgress(slot, session); return p.total > 0 && p.accounted === p.total; }

// Takes a slot and a session. Returns the first set still to log: {item, kind, i} or null.
// Optional skipId leaves one exercise out (the one just closed).
// Rule: finish the working sets of an exercise already started, then the first exercise not done.
function nextSet(slot, session, skipId){
  const items = sessionItems(session).filter(it => it.counted && it.id !== skipId);
  for (let k = 0; k < items.length; k++){
    const it = items[k], e = slot.entries[it.id];
    if (!e || isMissed(e)) continue;
    const kind = e.replaced ? "repl" : "main", sets = e.replaced ? e.repl.sets : e.sets;
    if (!sets.some(isLogged)) continue;
    const i = sets.findIndex((s, j) => isWorkingRow(it, j) && !isLogged(s));
    if (i >= 0) return {item: it, kind: kind, i: i};
  }
  for (let k = 0; k < items.length; k++){
    const it = items[k], e = slot.entries[it.id];
    if (isAccounted(e)) continue;
    if (e && e.replaced){ const ri = e.repl.sets.findIndex(s => !isLogged(s)); return {item: it, kind: "repl", i: ri < 0 ? 0 : ri}; }
    const i = e ? e.sets.findIndex(s => !isLogged(s)) : 0;
    return {item: it, kind: "main", i: i < 0 ? 0 : i};
  }
  return null;
}

// Takes sets. Returns the heaviest logged set {kg, reps}, more reps breaking ties, or null.
function bestSet(sets){
  let best = null;
  (sets || []).filter(isLogged).forEach(s => {
    const kg = Number(s.kg) || 0, reps = Number(s.reps);
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = {kg: kg, reps: reps};
  });
  return best;
}
// Takes an item and a row index. Returns true when the row counts as a working set (not a warm-up or checklist line).
function isWorkingRow(item, i){
  const r = item.rows[i];
  if (!r) return true;
  return r.role === "work" || r.role === "top" || r.role === "backoff" || r.role === "set" || r.role === "test";
}

/* ---------- 2.7 Units ---------- */
// Takes an item. Returns "kg" or "plates". Rule: machines and cables log plates, except plate-loaded machines.
function defaultUnit(item){
  const name = keyOf(item.name);
  if (CONFIG.kgMachineWords.some(w => name.indexOf(w) >= 0) || /barbell/i.test(item.equip)) return "kg";
  return /^(machine|cable)/i.test(item.equip) ? "plates" : "kg";
}
function unitKey(item){ return item.variants ? item.id + ":" + item.variant : item.id; }
// Takes the slot's unit choices and an item. Returns the unit in use.
function unitOf(units, item){ return (units && units[unitKey(item)]) || item.unitHint || defaultUnit(item); }
function hasWeight(item){ return item.log === "hd" || item.log === "lift" || item.log === "bw" || item.log === "carry"; }

/* ---------- 2.8 Rounding ---------- */
// Takes kg. Returns it rounded to the step for that weight (1 kg under 20 kg, else 2.5 kg).
function roundKg(kg){
  const step = kg < CONFIG.smallLoadKg ? CONFIG.smallStepKg : CONFIG.kgStep;
  return Math.max(step, Math.round(kg / step) * step);
}
function roundTo(n, unit){ return unit === "plates" ? Math.max(1, Math.round(n)) : roundKg(n); }
function loadStep(n, unit){ return unit === "plates" ? CONFIG.plateStep : (n < CONFIG.smallLoadKg ? CONFIG.smallStepKg : CONFIG.kgStep); }
// Takes a load. Returns about 90% of it, rounded for coming back after a break.
function returnLoad(kg, unit){
  if (unit === "plates") return Math.max(1, Math.round(kg * CONFIG.returnPercent));
  const step = kg < 20 ? CONFIG.roundKgLight : CONFIG.roundKg;
  return Math.max(step, Math.round(kg * CONFIG.returnPercent / step) * step);
}

/* ---------- 2.9 Last time and "beat last time" ---------- */

// Takes the slot and a session item. Returns last week's raw entry for the item, or null.
function rawLastEntry(slot, item){ return slot.lastWeek && slot.lastWeek.entries ? slot.lastWeek.entries[item.id] || null : null; }
function varKey(item){ return item.id + "|" + (item.variants ? item.variant : "-"); }

// Takes the slot, a session item, today and the cycle. Returns the entry to compare against, or null:
//   {sets, unit, variant, replaced, missed, replacement, fromHistory, histDate, otherVariant, gapWeeks}.
// Rules: same plan only (each plan has its own slot). Last week's entry if it is the same variation and
//   was logged; otherwise the last time this variation was done. gapWeeks counts only this plan's weeks.
function lastEntryFor(slot, item, today, cycle){
  const lw = rawLastEntry(slot, item);
  let out = lw;
  if (lw && item.variants){
    const then = lw.variant || item.variants[0].id;
    if (then !== item.variant) out = Object.assign({}, lw, {sets: [], otherVariant: then});
  }
  const usable = out && (out.sets || []).some(isLogged) && !out.replaced && !(out.missed && out.missed.on && !out.missed.madeUp);
  if (!usable){
    const h = (slot.varHistory || {})[varKey(item)];
    if (h && (h.sets || []).some(isLogged)){
      return Object.assign({}, out || {}, {sets: h.sets, unit: h.unit, fromHistory: true, histDate: h.date,
        gapWeeks: planWeeksBetween(cycle, item.plan, h.date, today)});
    }
  }
  return out;
}
// Takes a set and an optional unit. Returns a copy that carries its unit.
function withUnit(set, unit){ return set ? Object.assign({}, set, {unit: set.unit || unit}) : set; }
// Takes last time's set and the unit in use. Returns it without its load when the units differ.
function sameUnit(last, unit){ return !last || !last.unit || last.unit === unit ? last : Object.assign({}, last, {kg: ""}); }
// Takes this set and last time's same set. Returns {reps, kg}: true where this set beats last time.
function compareToLast(set, last){
  const out = {reps: false, kg: false};
  if (!last || !isLogged(set) || !isLogged(last)) return out;
  out.reps = Number(set.reps) > Number(last.reps);
  out.kg = (Number(set.kg) || 0) > (Number(last.kg) || 0);
  return out;
}
// Takes a set. Returns how it reads: "8", or "8 + 2 RP" with rest-pause or forced reps.
function setText(s){
  if (!s || s.reps === "" || s.reps == null) return "";
  const tag = CONFIG.setEndTags[s.end];
  return tag && Number(s.extra) > 0 ? s.reps + " + " + s.extra + " " + tag : String(s.reps);
}
// Takes a set and the unit. Returns "60 kg × 8, 2 left" style text.
function perfText(s, unit){
  if (!s || !isLogged(s)) return "";
  const load = Number(s.kg) > 0 ? fmtLoad(s.kg, unit || s.unit || "kg") + " × " : "";
  const left = s.left !== undefined && s.left !== "" ? ", " + s.left + " left" : "";
  return load + setText(s) + (load ? "" : " reps") + left;
}

// Heavy Duty. Takes the slot and an exercise id. Returns this week's result on its partner day
// {day, kg, reps, unit} or null. Rule: only pairs in CONFIG.hdWeekPairs (same exercise, same place in
// the session, Days 1 and 5); only main sets count. It is a baseline to hold, not a progression target.
function weekPartner(slot, itemId){
  const pair = CONFIG.hdWeekPairs.filter(p => p.indexOf(itemId) >= 0)[0];
  if (!pair) return null;
  const otherId = pair[0] === itemId ? pair[1] : pair[0], meta = EXERCISES[otherId], e = slot.entries[otherId];
  if (!meta || !e || e.replaced || isMissed(e)) return null;
  const rows = meta.item.rows || parseRows(meta.item.sets);
  const best = bestSet(e.sets.filter((s, i) => !/^Warm-up/.test(rows[i] || "")));
  if (!best) return null;
  const unit = (slot.units && slot.units[otherId]) || defaultUnit(meta.item);
  return {day: meta.day, kg: best.kg, reps: best.reps, unit: unit};
}

/* ---------- 2.10 Next targets ---------- */

// Heavy Duty. Takes an item, a row index, last week's same set, the unit, the below-range streak and the
// weeks away. Returns {text, kg}. Rules (clean reps only): top of range → add the small step;
// inside range → same weight, one more rep; rest-pause or forced reps → same weight, one more clean rep;
// stopped short → repeat; below range two weeks running → drop about 7.5%; 3+ weeks away → about 90%.
function nextTargetHd(item, i, last, unit, belowStreak, gapWeeks){
  const none = {text: "", kg: null};
  if (!isWorkingRow(item, i) || i >= item.rows.length || !last || !isLogged(last)) return none;
  const range = repRange(item); if (!range) return none;
  const r = Number(last.reps) || 0, kg = Number(last.kg) || 0;
  const assisted = (last.end === "rp" || last.end === "forced") && Number(last.extra) > 0;
  if (kg === 0) return {text: "Aim for " + (r + 1) + " clean reps.", kg: null, reps: r + 1};
  if (gapWeeks != null && gapWeeks >= CONFIG.longGapWeeks){
    const down = returnLoad(kg, unit);
    return {text: "About " + fmtLoad(down, unit) + " × " + range.min + "+. That's 90% after a break. Rebuild over two sessions.", kg: down, reps: range.min};
  }
  if (r >= range.max){ const step = loadStep(kg, unit); return {text: "Add " + fmtLoad(step, unit) + ": " + fmtLoad(kg + step, unit) + " × " + range.min + "+ clean.", kg: kg + step, reps: range.min}; }
  if (last.end === "short") return {text: "Repeat " + fmtLoad(kg, unit) + " if it feels fine. Aim for " + range.min + "+ clean.", kg: kg, reps: range.min};
  if (assisted) return {text: fmtLoad(kg, unit) + " × " + (r + 1) + " clean, before any " + (last.end === "rp" ? "pauses." : "forced reps."), kg: kg, reps: r + 1};
  if (r >= range.min) return {text: fmtLoad(kg, unit) + " × " + (r + 1) + " clean.", kg: kg, reps: r + 1};
  if (belowStreak >= CONFIG.belowStreakToDrop){
    const down = unit === "plates" ? Math.max(1, Math.min(kg - 1, Math.round(kg * CONFIG.dropPercent))) : roundKg(kg * CONFIG.dropPercent);
    return {text: "Two weeks below " + range.min + " reps. Drop to " + fmtLoad(down, unit) + " and rebuild.", kg: down, reps: range.min};
  }
  return {text: "Stay at " + fmtLoad(kg, unit) + " until you reach " + range.min + " clean reps.", kg: kg, reps: range.min};
}

// Powerbuilding top set. Takes the lift id, last top set, the reps left planned for it, this week's planned
// reps and the unit. Returns {text, kg}. Rules: at least 1 more left than planned → add 5 kg (bench 2.5 kg);
// as planned → same weight; at least 1 fewer → same weight into the next fortnight.
function nextTopSet(lift, last, plannedLeft, reps, unit){
  if (!last || !isLogged(last) || !(Number(last.kg) > 0)) return {text: "", kg: null};
  const kg = Number(last.kg), planned = parseLeft(plannedLeft);
  const add = unit === "plates" ? 1 : PROGRAMME.plans.pb.mainLifts[lift].easyAddKg;
  if (last.left === "" || last.left == null || !planned) return {text: fmtLoad(kg, unit) + " × " + reps + ". Note your reps left.", kg: kg, reps: Number(reps)};
  const left = Number(last.left);
  if (left >= planned.max + 1) return {text: "Felt easy last time. Add " + fmtLoad(add, unit) + ": " + fmtLoad(kg + add, unit) + " × " + reps + ".", kg: kg + add, reps: Number(reps)};
  if (left <= planned.min - 1) return {text: "Last time was a grind. Keep " + fmtLoad(kg, unit) + " × " + reps + ".", kg: kg, reps: Number(reps)};
  return {text: "Same weight: " + fmtLoad(kg, unit) + " × " + reps + ". Week B is harder on its own.", kg: kg, reps: Number(reps)};
}

// Powerbuilding top set, second opinion. Takes the plan rule's target, this week's row, last top set and the unit.
// Returns the target with a note added when last week's reps left point to a clearly different load.
// Rule: the plan rule stays the target. When the load that last top set predicts for this week's reps and reps
//   left differs by CONFIG.pbCoaching.predictGapPct or more, say so, and say which way to lean: lower when
//   warm-ups feel slow, higher only when they move fast. Technique comes first: a set that changes shape
//   to make the reps doesn't count as easy.
function topSetCheck(t, row, last, unit){
  if (!t.kg || !last || !isLogged(last) || last.left === "" || last.left == null) return t;
  const em = estMax(last.kg, last.reps, last.left), pl = parseLeft(row.left);
  if (!em || !pl) return t;
  const pred = loadForReps(em, row.reps, (pl.min + pl.max) / 2, unit);
  if (Math.abs(pred - t.kg) / t.kg * 100 < CONFIG.pbCoaching.predictGapPct) return t;
  const lean = pred < t.kg ? " If the warm-ups feel slow, use that." : " Only go up to it if the warm-ups move fast and look the same as always.";
  return Object.assign({}, t, {text: t.text + " Your last top set points to about " + fmtLoad(pred, unit) + " for " + row.reps + " with " + row.left + " left." + lean, predicted: pred});
}

// Powerbuilding test week. Takes the item, a row index, the row args and last time's sets (in today's unit).
// Returns {text, kg, reps} for each single, or the guidance for the optional extra try.
// Rules: the freshest estimate wins, so a single already logged today (with its reps left) re-sets the rest
//   of the singles; otherwise last time's best set is used. Each single is the load that estimate gives for
//   1 rep with the planned reps left, rounded down. The extra try is only for a final single that moved well
//   with unchanged technique: peaking is not the goal, a clean single is the result that counts.
function testTarget(item, i, a, lastSets){
  const none = {text: "", kg: null}, row = item.rows[i] || {};
  const done = a.entry ? a.entry.sets.slice(0, i).map((s, k) => ({s: s, row: item.rows[k]})).filter(x => x.row && x.row.role === "test" && isLogged(x.s) && x.s.left !== "" && x.s.left != null) : [];
  let em = 0, from = "";
  if (done.length){ const s = done[done.length - 1].s; em = estMax(s.kg, s.reps, s.left); from = "Today's last single"; }
  if (!em && lastSets){ em = bestEstMax(lastSets); from = "Your last top set"; }
  if (row.left === ""){
    const fin = a.entry && a.entry.sets[i - 1];
    if (!fin || !isLogged(fin) || !(Number(fin.kg) > 0)) return {text: "Only after a clean final single. Skip it if anything felt different.", kg: null};
    const add = a.unit === "plates" ? 1 : PROGRAMME.plans.pb.mainLifts[item.lift].easyAddKg;
    return {text: "Only if the final single moved well and looked like every other rep. Try " + fmtLoad(Number(fin.kg) + add, a.unit) + ". Skip it if anything changed: a clean single is the result that counts.", kg: Number(fin.kg) + add, reps: 1};
  }
  if (!em) return none;
  const kg = loadForReps(em, 1, Number(row.left) || 0, a.unit);
  return {text: "About " + fmtLoad(kg, a.unit) + ". " + from + " points to a max near " + fmtLoad(Math.round(em * 2) / 2, a.unit) + "." +
    (row.left === "1" ? " Same depth, pause and lockout as every other rep. Stop if your technique changes." : ""), kg: kg, reps: 1};
}

// Powerbuilding back-off. Takes today's top-set load, the percentage lighter and the unit. Returns {text, kg}.
function backoffTarget(topKg, pct, unit){
  if (!(topKg > 0)) return {text: "Log your top set first. Back-offs are " + pct + "% lighter.", kg: null};
  const kg = roundTo(topKg * (1 - pct / 100), unit);
  return {text: "Use about " + fmtLoad(kg, unit) + ": " + pct + "% lighter than your top set.", kg: kg};
}

// Powerbuilding accessory. Takes the item, a row index, last time's sets and the unit. Returns {text, kg}.
// Rules: every set at the top of the range with the planned reps left → add the smallest step;
// otherwise same weight, one more rep. Nordic: one more rep a week up to 6. Carry: +10 kg when all
// sets felt like 3 left. Bike and stretching have no targets.
function nextAccessory(item, i, lastSets, unit){
  const none = {text: "", kg: null};
  if (!lastSets || !lastSets.some(isLogged) || item.log === "time" || item.log === "rounds" || item.log === "check") return none;
  const pb = PROGRAMME.plans.pb, last = lastSets[i] && isLogged(lastSets[i]) ? lastSets[i] : bestSet(lastSets);
  const kg = Number(last.kg) || 0, reps = Number(last.reps) || 0;
  const logged = lastSets.filter(isLogged), planned = parseLeft(item.leftText);
  if (item.rule === "nordic") return {text: "Aim for " + Math.min(pb.nordicRule.maxReps, reps + pb.nordicRule.addRepsPerWeek) + " reps.", kg: null};
  if (item.rule === "carry" || item.log === "carry"){
    const easy = logged.length >= item.rows.length && logged.every(s => s.left !== "" && s.left != null && Number(s.left) >= pb.carryRule.whenLeft);
    if (item.rule === "carry" && easy && kg > 0) return {text: "All sets felt like 3 left. Add " + pb.carryRule.addKg + " kg: " + fmtLoad(kg + pb.carryRule.addKg, unit) + ".", kg: kg + pb.carryRule.addKg};
    return kg > 0 ? {text: "Same weight: " + fmtLoad(kg, unit) + ".", kg: kg} : none;
  }
  const allTop = logged.length >= item.rows.length && logged.every(s => Number(s.reps) >= item.repMax &&
    (!planned || s.left === "" || s.left == null || Number(s.left) >= planned.min));
  if (allTop && kg > 0){ const step = loadStep(kg, unit); return {text: "Top of the range last time. Add " + fmtLoad(step, unit) + ": " + fmtLoad(kg + step, unit) + " × " + item.repMin + "+.", kg: kg + step}; }
  if (allTop) return {text: "Top of the range last time. Add a little weight.", kg: null};
  const aim = Math.min(item.repMax, reps + 1);
  return kg > 0 ? {text: fmtLoad(kg, unit) + " × " + aim + ".", kg: kg, reps: aim} : {text: "Aim for " + aim + " reps.", kg: null, reps: aim};
}

// Takes kg, reps done and reps left. Returns the estimated max for one rep, rounded to 0.5 kg.
// Rule: weight × (1 + (reps done + reps left) ÷ 30).
function estimatedMax(kg, reps, left){
  const e = estMax(kg, reps, left);
  return e ? Math.round(e * 2) / 2 : null;
}

// Heavy Duty warm-ups. Takes the percentage, the main-set load and the unit. Returns the warm-up load.
function warmupLoad(pct, workingKg, unit){ return roundTo(workingKg * pct / 100, unit); }

/* ---------- 2.11 Finding the top set ---------- */

// Takes the Heavy Duty slot, an exercise id and a variation id. Returns the latest main-set load logged
// for it in kg, or null. Looks at this week, then last week, then the variation history, then history by name.
function hdWorkingKg(hdSlot, exId, variantId){
  const meta = EXERCISES[exId]; if (!meta) return null;
  const item = meta.item;
  const rows = item.rows || parseRows(item.sets);
  const workIdx = rows.map((r, i) => /^Warm-up/.test(r) ? -1 : i).filter(i => i >= 0);
  const fromSets = sets => { const b = bestSet((sets || []).filter((s, i) => workIdx.indexOf(i) >= 0)); return b && b.kg > 0 ? b.kg : null; };
  const okVariant = e => !item.variants || !variantId || (e && (e.variant || "barbell") === variantId);
  const cur = hdSlot.entries && hdSlot.entries[exId];
  if (cur && okVariant(cur) && fromSets(cur.sets)) return fromSets(cur.sets);
  const lw = hdSlot.lastWeek && hdSlot.lastWeek.entries ? hdSlot.lastWeek.entries[exId] : null;
  if (lw && okVariant(lw) && fromSets(lw.sets)) return fromSets(lw.sets);
  const vh = (hdSlot.varHistory || {})[exId + "|" + (item.variants ? (variantId || "barbell") : "-")];
  if (vh && fromSets(vh.sets)) return fromSets(vh.sets);
  const h = (hdSlot.history || {})[keyOf(item.name)];
  return h && h.kg > 0 ? h.kg : null;
}

// Takes the lift id, the chosen variation and the Heavy Duty slot.
// Returns {kg, source, note}: the first guess for a top set of 5, rounded to 2.5 kg, or kg null.
// Rules: squat = back squat × 1.05; bench = incline bench × 1.00; sumo deadlift = sumo × 0.95;
// conventional deadlift or no Heavy Duty data = no guess.
function topSetGuess(lift, variantId, hdSlot){
  const m = PROGRAMME.plans.pb.mainLifts[lift];
  if (m.noGuessVariants && m.noGuessVariants.indexOf(variantId) >= 0) return {kg: null, source: "", note: "No guess for this stance. Start from " + m.conventionalStartKg + " kg and work up."};
  const base = hdWorkingKg(hdSlot, m.hdSource, m.hdSourceVariant || null);
  if (!base) return {kg: null, source: "", note: "No Heavy Duty numbers yet. Start from the empty bar and work up."};
  return {kg: Math.round(base * m.hdFactor / CONFIG.kgStep) * CONFIG.kgStep, source: m.hdNote + ": " + fmtLoad(base, "kg") + ".", note: m.guessNote + "."};
}

// Takes a guess in kg and the lift id. Returns the five warm-up ladder sets with loads:
// [{set, weight, kg, reps, rest}]. Rule: empty bar (deadlift 40%), 50%, 70%, 85%, then the guess.
function topSetLadder(guessKg, lift){
  return PROGRAMME.plans.pb.topSetLadder.map(s => {
    let kg = null;
    if (guessKg > 0){
      if (s.pct == null) kg = lift === "deadlift" ? roundKg(guessKg * s.deadliftPct / 100) : CONFIG.emptyBarKg;
      else kg = Math.max(CONFIG.emptyBarKg, roundKg(guessKg * s.pct / 100));
    }
    return {set: s.set, weight: s.weight, kg: kg, reps: s.reps, rest: s.rest};
  });
}

// Takes the reps left on the guess set, the guess, the lift id and the try number.
// Returns {verdict, message, nextGuess, done}. Rules from the plan's outcome table; three tries at most.
function topSetOutcome(left, guessKg, lift, tryNumber){
  const pb = PROGRAMME.plans.pb, m = pb.mainLifts[lift], n = Number(left);
  const last = tryNumber >= pb.topSetMaxTries;
  if (n >= 4){
    const next = guessKg + m.tooLightKg;
    return last ? {verdict: "light", message: "Too light, but that was try " + tryNumber + ". Use your best and fix it next session.", nextGuess: guessKg, done: true}
      : {verdict: "light", message: "Too light. Add " + m.tooLightKg + " kg and do 5 again: " + fmtLoad(next, "kg") + ".", nextGuess: next, done: false};
  }
  if (n === 3) return {verdict: "spot", message: "That's your top set. Go to the back-offs.", nextGuess: guessKg, done: true};
  if (n === 2) return {verdict: "close", message: "Close enough. Count it as your top set. It's already your Week B weight.", nextGuess: guessKg, done: true};
  return {verdict: "heavy", message: "Too heavy. Stop. Back-offs 10% lighter, and start lighter next time.", nextGuess: guessKg, done: true};
}

/* ---------- 2.12 Advice for swapped or missed exercises ---------- */

// Takes the exercise name, the reason key, its history {kg, reps, unit, date} or null, the planned reps,
// the replacement's name and the weeks away. Returns one line of next-session advice.
// Rules: injury → start lighter; no history → moderate weight, log a new baseline;
// 3+ weeks away → about 90% and rebuild over two sessions; otherwise match last time.
function replacementAdvice(name, reason, hist, planned, replacementName, weeksAway){
  const perf = h => h.kg > 0 ? fmtLoad(h.kg, h.unit || "kg") + " × " + h.reps : h.reps + " reps";
  if (reason === "injury"){
    return hist ? "Start " + name + " lighter than your last " + perf(hist) + " next time. Build up only if it feels fine."
      : "Start " + name + " light next time. Build up only if it feels fine. Log it as your new baseline.";
  }
  if (!hist) return "Back to " + name + " next time with a weight you can manage for " + (planned ? planned + " reps" : "the planned reps") + "." + (replacementName ? " Your " + replacementName + " numbers don't carry over." : "") + " Log it as your new baseline.";
  const weeks = Math.max(1, weeksAway || 0);
  if (weeks >= CONFIG.longGapWeeks){
    const start = hist.kg > 0 ? "at about " + fmtLoad(returnLoad(hist.kg, hist.unit || "kg"), hist.unit || "kg") : "at about 90% of your last " + perf(hist);
    return "Back to " + name + " next time " + start + ". You've missed " + weekWord(weeks) + ", so rebuild over two sessions.";
  }
  return "Back to " + name + " next time at your last " + perf(hist) + ". Match that first, then add a rep per set.";
}

// Takes a name. Returns the muscles it loads, from CONFIG.muscleRules.
function musclesOf(name){
  const rule = CONFIG.muscleRules.filter(r => new RegExp(r[0], "i").test(name))[0];
  return rule ? rule[1] : [];
}
// Takes the made-up item, today's session items, items trained yesterday and tomorrow's session items.
// Returns a recovery warning, or "" when no muscles overlap.
function recoveryNote(itemName, todayItems, yesterdayItems, tomorrowItems, tomorrowDayN){
  const mine = musclesOf(itemName); if (!mine.length) return "";
  const overlap = list => { const s = []; list.forEach(n => musclesOf(n).forEach(m => { if (mine.indexOf(m) >= 0 && s.indexOf(m) < 0) s.push(m); })); return s; };
  const parts = [], t = overlap(todayItems), y = overlap(yesterdayItems), n = overlap(tomorrowItems);
  if (t.length) parts.push(listWords(t) + " also get worked today");
  if (y.length) parts.push(listWords(y) + " were trained yesterday");
  if (n.length && tomorrowDayN) parts.push(listWords(n) + " get trained again tomorrow on Day " + tomorrowDayN);
  if (!parts.length) return "";
  const first = parts.join(", and ");
  return first.charAt(0).toUpperCase() + first.slice(1) + ". Expect fewer reps. They still count.";
}

/* ---------- 2.13 Missed whole days ---------- */

// Takes the slot, the session, a reason key and the day's date. Marks every unlogged counted item missed.
// Changes slot in place.
function markDayMissed(slot, session, reason, dateISO){
  slot.missedDays = slot.missedDays || {};
  const exIds = [];
  sessionItems(session).filter(it => it.counted).forEach(it => {
    const e = ensureEntry(slot, it);
    if (isComplete(e) || e.replaced || (e.missed && e.missed.on)) return;
    e.missed = {on: true, reason: CONFIG.dayToExerciseReason[reason] || "other", date: dateISO, madeUp: null, viaDay: true};
    exIds.push(it.id);
  });
  slot.missedDays[session.n] = {date: dateISO, reason: reason, exIds: exIds};
  return slot;
}
// Takes the slot and a day number. Clears the missed day and its items. Changes slot in place.
function undoDayMissed(slot, dayN){
  const md = (slot.missedDays || {})[dayN]; if (!md) return slot;
  (md.exIds || []).forEach(id => { const e = slot.entries[id]; if (e && e.missed && e.missed.viaDay) e.missed = {on: false, reason: "", date: null}; });
  delete slot.missedDays[dayN];
  return slot;
}
// Takes the slot, a day number and that day's session. Returns {total, made[{item, date}], pending[items]}.
function dayMakeupStatus(slot, dayN, session){
  const md = (slot.missedDays || {})[dayN];
  if (!md || !session) return {total: 0, made: [], pending: []};
  const ids = md.exIds || [], made = [], pending = [];
  sessionItems(session).forEach(it => {
    if (ids.indexOf(it.id) < 0) return;
    const e = slot.entries[it.id];
    if (isMadeUp(e) && (e.sets.some(isLogged) || (e.replaced && e.repl.sets.some(isLogged)))) made.push({item: it, date: e.missed.madeUp.date});
    else pending.push(it);
  });
  return {total: ids.length, made: made, pending: pending};
}
// Takes the slot, a day number and its session. Returns the line the export carries, e.g. "Day 2: missed Tuesday, made up 3 of 8 during the week".
function dayNote(slot, dayN, session){
  const md = (slot.missedDays || {})[dayN]; if (!md) return "";
  const st = dayMakeupStatus(slot, dayN, session), when = weekdayName(md.date);
  return st.made.length ? "Day " + dayN + ": missed " + when + ", made up " + st.made.length + " of " + st.total + " during the week"
    : "Day " + dayN + ": missed " + when + ", nothing made up";
}
// Takes the slot, the week's sessions and today. Returns the first past training day with nothing logged
// that hasn't been answered, or null. Rule: only inside the slot's own week.
function unansweredDay(slot, sessions, today){
  const rel = daysBetween(slot.weekStart, today);
  if (rel < 1 || rel > 6) return null;
  const dismissed = (slot.ui && slot.ui.dismissedMiss) || {};
  return sessions.filter(s => !s.rest && s.n <= rel && !(slot.missedDays || {})[s.n] && !dismissed[s.n] &&
    !sessionItems(s).filter(it => it.counted).some(it => { const e = slot.entries[it.id]; return e && ((e.sets || []).some(isLogged) || e.replaced || (e.missed && e.missed.on)); }))[0] || null;
}

/* ---------- 2.14 Swaps and skips log ---------- */
// Takes the slot and a session. Returns this week's swaps, skips, make-ups and missed day as log lines.
function currentVariations(slot, session, today){
  const list = [];
  sessionItems(session).forEach(it => {
    const e = slot.entries[it.id];
    if (!e) return;
    if (e.replaced) list.push({type: "replaced", day: session.n, original: it.name, replacement: (e.repl.name || "").trim(), reason: e.repl.reason, date: e.repl.date || today, current: true});
    if (e.missed && e.missed.viaDay) return;
    if (isMadeUp(e)) list.push({type: "madeup", day: session.n, original: it.name, replacement: "", reason: e.missed.reason, date: e.missed.madeUp.date, madeDay: e.missed.madeUp.day, current: true});
    if (isMissed(e)) list.push({type: "missed", day: session.n, original: it.name, replacement: "", reason: e.missed.reason, date: e.missed.date || today, current: true});
  });
  const md = (slot.missedDays || {})[session.n];
  if (md) list.push({type: "missedday", day: session.n, original: "Day " + session.n, replacement: "", reason: md.reason, date: md.date, note: dayNote(slot, session.n, session), current: true});
  return list;
}
function variationKey(v){ return [v.type || "replaced", v.date, v.day, keyOf(v.original), keyOf(v.replacement)].join("|"); }
function dedupeVariations(list){
  const seen = {}, out = [];
  list.forEach(v => { const k = variationKey(v); if (!seen[k]){ seen[k] = true; out.push(v); } });
  return out;
}

/* ---------- 2.15 Input checks ---------- */
// Takes a field name ("reps", "extra", "left" or "kg"), the raw text and the unit.
// Returns {value, error}: the cleaned value and a plain message saying how to fix the input.
function sanitize(f, raw, unit){
  raw = String(raw == null ? "" : raw);
  let error = "";
  if (f === "reps" || f === "extra" || f === "left"){
    let v = raw.replace(/[^\d]/g, "");
    if (v !== raw) error = "Use whole numbers only, like 8.";
    const max = f === "left" ? CONFIG.maxRepsLeft : CONFIG.maxReps;
    if (v !== "" && Number(v) > max){ v = String(max); error = "The most you can enter is " + max + "."; }
    return {value: v.replace(/^0+(?=\d)/, ""), error: error};
  }
  let v = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  if (v !== raw.replace(",", ".")) error = "Use numbers only, like 62.5.";
  const max = unit === "plates" ? CONFIG.maxPlates : CONFIG.maxKg;
  if (v !== "" && Number(v) > max){ v = String(max); error = "The most you can enter is " + fmtLoad(max, unit) + "."; }
  return {value: v, error: error};
}
// Takes a start date as typed. Returns {value (a Monday), error, note}.
function checkStartDate(raw){
  if (!parseISO(raw)) return {value: "", error: "Choose a real date, like 5 October 2026.", note: ""};
  const mon = mondayOf(raw);
  return {value: mon, error: "", note: mon === raw ? "" : "Weeks start on Monday, so the plan starts " + fmtDayDate(mon) + "."};
}

/* ---------- 2.16 Export and import ---------- */
const str = v => (v == null ? "" : String(v)).slice(0, 80);
// Takes sets from a file. Returns clean sets with only known fields and safe values.
function cleanSets(sets){
  return Array.isArray(sets) && sets.length ? sets.slice(0, 20).map(s => {
    const out = {reps: sanitize("reps", str(s && s.reps)).value, kg: sanitize("kg", str(s && s.kg)).value};
    if (s && CONFIG.setEnds[s.end]) out.end = s.end;
    if (s && s.extra) out.extra = sanitize("extra", str(s.extra)).value;
    if (s && s.left !== undefined && s.left !== "") out.left = sanitize("left", str(s.left)).value;
    return out;
  }) : [];
}
function migrateId(id){ return CONFIG.movedIds[id] || id; }
function isCalf(name){ return /calf raise/i.test(name || ""); }

// Takes the slot, the plan id and the week's sessions. Returns {exerciseId: {name, date, kg, reps, unit}}:
// the latest best set per exercise name, this week included.
function mergedHistory(slot, sessions, unitFor){
  const h = JSON.parse(JSON.stringify(slot.history || {}));
  sessions.forEach(s => sessionItems(s).forEach(it => {
    const e = slot.entries[it.id];
    if (!e || e.replaced || isMissed(e)) return;
    const best = bestSet(e.sets); if (!best) return;
    const k = keyOf(it.name), date = e.doneAt || slot.weekStart;
    if (!h[k] || (h[k].date || "") <= date) h[k] = {name: it.name, date: date, kg: best.kg, reps: best.reps, unit: unitFor(it)};
  }));
  return h;
}
// Heavy Duty: weeks each exercise's main sets stayed below the rep range, counting this week.
function exportStreaks(slot, sessions){
  const out = Object.assign({}, slot.loadedStreaks || {});
  sessions.forEach(s => sessionItems(s).forEach(it => {
    const e = slot.entries[it.id], range = repRange(it);
    if (!e || !range || e.replaced || isMissed(e)) return;
    const work = e.sets.filter((st, i) => isWorkingRow(it, i) && isLogged(st));
    if (!work.length) return;
    out[it.id] = work.every(st => Number(st.reps) < range.min) ? (out[it.id] || 0) + 1 : 0;
  }));
  return out;
}
// The latest session of every exercise variation, carried from week to week.
function mergedVarHistory(slot, sessions, unitFor){
  const h = JSON.parse(JSON.stringify(slot.varHistory || {}));
  sessions.forEach(s => sessionItems(s).forEach(it => {
    const e = slot.entries[it.id];
    if (!e || e.replaced || isMissed(e) || !e.sets.some(isLogged)) return;
    const k = varKey(it), date = (isMadeUp(e) && e.missed.madeUp.date) || e.doneAt || slot.weekStart;
    if (!h[k] || (h[k].date || "") <= date) h[k] = {name: it.name, variant: it.variants ? it.variant : null, date: date, unit: unitFor(it), sets: e.sets.map(x => Object.assign({}, x))};
  }));
  return h;
}

// Takes the slot, its plan id, the week's sessions, the other plan's id and slot, and the time now.
// Returns the export file object. Format: the version 1 week file, plus "plan" at the top and on each
// entry, and the other plan's slot under backup.otherPlan so Restore can bring both back.
function buildExport(slot, planId, sessions, otherSlotData, nowISO){
  const unitFor = it => unitOf(slot.units, it);
  const entries = {};
  sessions.forEach(s => sessionItems(s).forEach(it => {
    const e = slot.entries[it.id]; if (!e) return;
    entries[it.id] = {
      plan: planId, day: s.n, exercise: it.name, rows: e.sets.map((x, i) => it.rows[i] ? it.rows[i].label : "Extra set " + (i - it.rows.length + 1)),
      sets: e.sets, unit: unitFor(it), variant: it.variants ? it.variant : undefined, doneAt: e.doneAt, replaced: e.replaced,
      replacement: e.replaced ? {name: e.repl.name, reason: e.repl.reason, date: e.repl.date, unit: e.repl.unit || "kg", measure: cleanMeasure(e.repl.measure), sets: e.repl.sets} : null,
      missed: e.missed && e.missed.on ? {on: true, reason: e.missed.reason, date: e.missed.date, madeUp: e.missed.madeUp || null, viaDay: !!e.missed.viaDay} : null
    };
  }));
  const current = [].concat.apply([], sessions.map(s => currentVariations(slot, s, slot.weekStart))).map(v => { const c = Object.assign({}, v); delete c.current; return c; });
  const missedDays = Object.keys(slot.missedDays || {}).map(Number).sort().map(n => {
    const md = slot.missedDays[n], s = sessions.filter(x => x.n === n)[0], st = dayMakeupStatus(slot, n, s);
    return {day: n, title: s ? s.title : "", date: md.date, reason: md.reason, total: st.total, madeUp: st.made.map(x => ({name: x.item.name, date: x.date})), note: dayNote(slot, n, s)};
  });
  return {
    app: CONFIG.appId, version: CONFIG.dataVersion, plan: planId, exportedAt: nowISO,
    weekStart: slot.weekStart, weekEnd: addDays(slot.weekStart, 6), entries: entries,
    streaks: exportStreaks(slot, sessions), history: mergedHistory(slot, sessions, unitFor), varHistory: mergedVarHistory(slot, sessions, unitFor),
    backup: {lastWeek: slot.lastWeek, history: slot.history || {}, varHistory: slot.varHistory || {}, loadedStreaks: slot.loadedStreaks || {},
      pastVariations: slot.pastVariations || [], missedDays: slot.missedDays || {}, units: slot.units || {}, otherPlan: otherSlotData || null,
      savedSwaps: slot.savedSwaps || {}, savedExtras: slot.savedExtras || {}},
    extras: slot.extras || {},
    variations: dedupeVariations((slot.pastVariations || []).concat(current)),
    missedDays: missedDays
  };
}
// Takes a slot. Returns a copy holding only training data (no app settings, theme or the other plan),
// for the other plan's backup inside an export file.
function slotForExport(slot){
  const out = {};
  ["weekStart", "entries", "units", "lastWeek", "history", "varHistory", "loadedStreaks", "pastVariations", "missedDays", "extras", "savedSwaps", "savedExtras"].forEach(k => { if (slot[k] !== undefined) out[k] = JSON.parse(JSON.stringify(slot[k])); });
  return out;
}
// Takes a plan id and a Monday. Returns the export file name.
function exportFilename(planId, weekStart){ return CONFIG.exportPrefix[planId] + "-" + weekStart + "-to-" + addDays(weekStart, 6) + ".json"; }

// Takes the text of an export file. Returns {data, plan}. Throws an Error with a plain message when it
// can't be read. Rule: files without "plan" were made before this rebuild and are Heavy Duty.
function readExportFile(text){
  let data;
  try { data = JSON.parse(text); }
  catch (e){ throw new Error("That text can't be read. Paste the whole exported file."); }
  if (!data || data.app !== CONFIG.appId || typeof data.entries !== "object" || data.entries === null)
    throw new Error("This isn't a week from this app. Use a file made with Export week.");
  if (data.version != null && CONFIG.readableVersions.indexOf(Number(data.version)) < 0)
    throw new Error("This file comes from a newer app. Update the app, then try again.");
  const plan = data.plan === "pb" ? "pb" : "hd";
  return {data: data, plan: plan};
}

// Takes an exported entry and its id. Returns a clean "last week" entry, or null for unknown ids.
function cleanLastEntry(id, x){
  const meta = EXERCISES[id]; if (!meta) return null;
  const m = x.missed, r = x.replacement, item = meta.item;
  const variants = item.variants ? PROGRAMME.plans[meta.plan].variants[item.variants] : null;
  return {
    sets: cleanSets(x.sets), unit: x.unit === "plates" || x.unit === "kg" ? x.unit : null,
    rows: Array.isArray(x.rows) ? x.rows.slice(0, 20).map(str) : undefined,
    variant: variants && variants.some(v => v.id === x.variant) ? x.variant : undefined, doneAt: str(x.doneAt) || null, replaced: !!x.replaced,
    replacement: x.replaced && r ? {name: str(r.name), reason: CONFIG.reasons[r.reason] ? r.reason : "", date: str(r.date) || null, unit: r.unit === "plates" ? "plates" : "kg", measure: cleanMeasure(r.measure), sets: cleanSets(r.sets)} : null,
    missed: m && m.on ? {on: true, reason: CONFIG.missedReasons[m.reason] ? m.reason : "", date: str(m.date) || null,
      madeUp: m.madeUp && Number(m.madeUp.day) >= 1 && Number(m.madeUp.day) <= 7 ? {day: Number(m.madeUp.day), date: str(m.madeUp.date) || null} : null} : null
  };
}

// Takes a slot, its plan id and an export's data. Loads the file as "last week": targets, history,
// streaks and the swaps log. Changes slot in place. Rule: only exercises from the same plan are read.
function loadAsLastWeek(slot, planId, data){
  const entries = {};
  Object.keys(data.entries).forEach(rawId => {
    const id = migrateId(rawId);
    if (!EXERCISES[id] || EXERCISES[id].plan !== planId || entries[id]) return;
    const e = cleanLastEntry(id, data.entries[rawId] || {});
    if (e) entries[id] = e;
  });
  const lwMissedDays = {};
  (Array.isArray(data.missedDays) ? data.missedDays : []).slice(0, 7).forEach(m => {
    const n = Number(m && m.day);
    if (n >= 1 && n <= CONFIG.trainingDays && m.note) lwMissedDays[n] = {note: str(m.note).slice(0, 160), reason: CONFIG.dayMissReasons[m.reason] ? m.reason : "", date: str(m.date)};
  });
  slot.lastWeek = {weekStart: parseISO(str(data.weekStart)) ? mondayOf(str(data.weekStart)) : null, exportedAt: str(data.exportedAt), entries: entries, missedDays: lwMissedDays, extras: cleanExtras(data.extras)};
  harvestSaved(slot, entries, slot.lastWeek.extras, slot.lastWeek.weekStart || "");
  slot.loadedStreaks = {};
  if (data.streaks && typeof data.streaks === "object") Object.keys(data.streaks).forEach(rawId => {
    const id = migrateId(rawId);
    if (EXERCISES[id] && EXERCISES[id].plan === planId) slot.loadedStreaks[id] = Math.min(52, Math.max(0, parseInt(data.streaks[rawId], 10) || 0));
  });
  slot.history = slot.history || {};
  if (data.history && typeof data.history === "object") Object.keys(data.history).forEach(k => {
    const h = data.history[k] || {};
    const c = {name: str(h.name), date: str(h.date), kg: Number(h.kg) || 0, reps: Number(h.reps) || 0, unit: h.unit === "plates" ? "plates" : "kg"};
    if (!c.date || !(c.reps > 0)) return;
    if (!slot.history[k] || (slot.history[k].date || "") < c.date) slot.history[k] = c;
  });
  if (Array.isArray(data.variations)){
    const incoming = data.variations.slice(0, 500).map(v => {
      const type = ["missed", "madeup", "missedday"].indexOf(v.type) >= 0 ? v.type : "replaced";
      const reasons = type === "replaced" ? CONFIG.reasons : type === "missedday" ? CONFIG.dayMissReasons : CONFIG.missedReasons;
      let day = Number(v.day) || 0;
      if (planId === "hd" && day === 2 && isCalf(v.original)) day = 3;
      const out = {type: type, day: day, original: str(v.original), replacement: str(v.replacement), reason: reasons[v.reason] ? v.reason : "", date: str(v.date)};
      if (type === "madeup") out.madeDay = Number(v.madeDay) || 0;
      if (type === "missedday") out.note = str(v.note).slice(0, 160);
      return out;
    }).filter(v => v.day >= 1 && v.day <= CONFIG.trainingDays && v.original);
    slot.pastVariations = dedupeVariations((slot.pastVariations || []).concat(incoming));
  }
  if (data.varHistory && typeof data.varHistory === "object"){
    slot.varHistory = slot.varHistory || {};
    Object.keys(data.varHistory).slice(0, 400).forEach(rawKey => {
      const parts = String(rawKey).split("|"), id = migrateId(parts[0]), variant = parts[1], meta = EXERCISES[id];
      if (!meta || meta.plan !== planId) return;
      const variants = meta.item.variants ? PROGRAMME.plans[planId].variants[meta.item.variants] : null;
      if (variants ? !variants.some(v => v.id === variant) : variant !== "-") return;
      const h = data.varHistory[rawKey] || {};
      const c = {name: str(h.name), variant: variants ? variant : null, date: str(h.date), unit: h.unit === "plates" ? "plates" : "kg", sets: cleanSets(h.sets)};
      if (!parseISO(c.date) || !c.sets.some(isLogged)) return;
      const k = id + "|" + variant;
      if (!slot.varHistory[k] || (slot.varHistory[k].date || "") < c.date) slot.varHistory[k] = c;
    });
  }
  return slot;
}

// Takes a slot, its plan id, its sessions, the cycle and today. Starts the next week for that plan:
// the finished week becomes last week's targets, then the log clears. Changes slot in place.
// Rule: the new week is the plan's next scheduled week, so weeks on the other plan are skipped.
function startNewWeek(slot, planId, sessions, cycle, today, nowISO){
  const finished = buildExport(slot, planId, sessions, null, nowISO);
  slot.entries = {};
  slot.missedDays = {};
  slot.extras = {};
  slot.ui = slot.ui || {};
  slot.ui.dismissedMiss = {};
  slot.weekStart = nextWeekForPlan(cycle, planId, laterOf(addDays(slot.weekStart, 7), mondayOf(today)));
  loadAsLastWeek(slot, planId, finished);
  applyRegularSwaps(slot);
  return slot;
}

// Takes a slot. Clears everything loaded from last week. Changes slot in place.
function clearLoadedWeek(slot){
  slot.lastWeek = null; slot.history = {}; slot.varHistory = {}; slot.loadedStreaks = {}; slot.pastVariations = [];
  return slot;
}

// Takes an exported entry and its id. Returns a clean entry for this week, or null.
function cleanEntry(id, x){
  const meta = EXERCISES[id]; if (!meta || !x) return null;
  const r = x.repl || x.replacement || null, m = x.missed || null, item = meta.item;
  const variants = item.variants ? PROGRAMME.plans[meta.plan].variants[item.variants] : null;
  const e = {
    sets: cleanSets(x.sets), replaced: !!x.replaced,
    repl: {name: str(r && r.name), reason: r && CONFIG.reasons[r.reason] ? r.reason : "", date: str(r && r.date) || null, sets: r && cleanSets(r.sets).length ? cleanSets(r.sets) : [emptySet()]},
    doneAt: parseISO(str(x.doneAt)) ? str(x.doneAt) : null,
    missed: m && m.on ? {on: true, reason: CONFIG.missedReasons[m.reason] ? m.reason : "", date: str(m.date) || null,
      madeUp: m.madeUp && Number(m.madeUp.day) >= 1 && Number(m.madeUp.day) <= 7 ? {day: Number(m.madeUp.day), date: str(m.madeUp.date) || null} : null, viaDay: !!m.viaDay} : {on: false, reason: "", date: null}
  };
  if (r && (r.unit === "plates" || r.unit === "kg")) e.repl.unit = r.unit;
  if (r && cleanMeasure(r.measure) !== "reps") e.repl.measure = cleanMeasure(r.measure);
  if (variants && variants.some(v => v.id === x.variant)) e.variant = x.variant;
  return e;
}

// Takes the text of an export. Returns everything needed to restore it:
// {plan, data, weekStart, entries, units, logged, other}. Throws an Error with a plain message.
function parseBackup(text){
  const read = readExportFile(text), data = read.data, plan = read.plan;
  const weekStart = parseISO(str(data.weekStart)) ? mondayOf(str(data.weekStart)) : null;
  if (!weekStart) throw new Error("This backup has no week date, so it can't be restored.");
  const entries = {}, units = {};
  let logged = 0;
  Object.keys(data.entries).forEach(rawId => {
    const id = migrateId(rawId), meta = EXERCISES[id];
    if (!meta || meta.plan !== plan) return;
    const e = cleanEntry(id, data.entries[rawId]); if (!e) return;
    entries[id] = e;
    if (e.sets.some(isLogged) || (e.replaced && e.repl.sets.some(isLogged))) logged++;
    const u = data.entries[rawId].unit;
    if (u === "plates" || u === "kg"){
      const list = meta.item.variants ? PROGRAMME.plans[plan].variants[meta.item.variants] : null;
      units[list ? id + ":" + (e.variant || list[0].id) : id] = u;
    }
  });
  const b = data.backup && typeof data.backup === "object" ? data.backup : null;
  const other = b && b.otherPlan && b.otherPlan.plan === otherPlan(plan) && b.otherPlan.slot && typeof b.otherPlan.slot === "object" ? b.otherPlan : null;
  return {plan: plan, data: data, weekStart: weekStart, entries: entries, units: units, logged: logged, other: other};
}

const objOr = (v, d) => v && typeof v === "object" && !Array.isArray(v) ? v : d;

// Takes a slot and a parsed backup. Puts the backup's week back exactly as logged. Changes slot in place.
// Rule: newer files carry the full working state; older files rebuild what they can.
function applyBackup(slot, p){
  const b = objOr(p.data.backup, null);
  slot.weekStart = p.weekStart;
  slot.entries = p.entries;
  slot.units = Object.assign({}, objOr(b && b.units, {}), p.units);
  slot.ui = slot.ui || {};
  slot.ui.dismissedMiss = {};
  slot.extras = cleanExtras(p.data.extras);
  if (b){
    slot.savedSwaps = objOr(b.savedSwaps, slot.savedSwaps || {});
    slot.savedExtras = objOr(b.savedExtras, slot.savedExtras || {});
    slot.lastWeek = objOr(b.lastWeek, null);
    slot.history = objOr(b.history, {});
    slot.varHistory = objOr(b.varHistory, {});
    slot.loadedStreaks = objOr(b.loadedStreaks, {});
    slot.pastVariations = Array.isArray(b.pastVariations) ? b.pastVariations.slice(0, 500) : [];
    const md = objOr(b.missedDays, {});
    slot.missedDays = {};
    Object.keys(md).forEach(k => {
      const n = Number(k);
      if (n >= 1 && n <= CONFIG.trainingDays && md[k]) slot.missedDays[n] = {date: str(md[k].date), reason: CONFIG.dayMissReasons[md[k].reason] ? md[k].reason : "other",
        exIds: Array.isArray(md[k].exIds) ? md[k].exIds.filter(id => EXERCISES[id]) : []};
    });
  } else {
    slot.lastWeek = null;
    slot.history = objOr(p.data.history, {});
    slot.varHistory = objOr(p.data.varHistory, {});
    slot.loadedStreaks = {};
    slot.pastVariations = (Array.isArray(p.data.variations) ? p.data.variations : []).filter(v => v && str(v.date) && str(v.date) < p.weekStart).slice(0, 500);
    slot.missedDays = {};
    (Array.isArray(p.data.missedDays) ? p.data.missedDays : []).forEach(m => {
      const n = Number(m && m.day); if (!(n >= 1 && n <= CONFIG.trainingDays)) return;
      const exIds = Object.keys(p.entries).filter(id => EXERCISES[id].day === n && p.entries[id].missed.on);
      exIds.forEach(id => { p.entries[id].missed.viaDay = true; });
      slot.missedDays[n] = {date: str(m.date), reason: CONFIG.dayMissReasons[m.reason] ? m.reason : "other", exIds: exIds};
    });
  }
  return slot;
}

/* ---------- 2.17 Targets for any row ---------- */

// Takes the cycle and the date a powerbuilding session was done. Returns the top-set reps left planned that week.
function plannedTopLeft(cycle, iso){
  if (!iso || !parseISO(iso)) return "";
  const w = weekInfo(cycle, iso);
  if (w.plan !== "pb") return "";
  const f = PROGRAMME.plans.pb.fortnights[w.fortnight - 1], top = f.top[w.weekLetter] === "test" ? f.top.A : f.top[w.weekLetter];
  return top.left;
}

// Takes an item. Returns the index of its first working row (0 when there is none).
function firstWorkRow(item){
  for (let i = 0; i < item.rows.length; i++) if (isWorkingRow(item, i)) return i;
  return 0;
}

// Takes an item, a row index and {entry, last, unit, streak, cycle}. Returns {text, kg}: what to aim
// for on that row today. Dispatches to the Heavy Duty, top-set, back-off or accessory rule.
function rowTarget(item, i, a){
  const lastSets = a.last && a.last.sets ? a.last.sets.map(s => sameUnit(withUnit(s, a.last.unit), a.unit)) : null;
  const lastSet = lastSets ? lastSets[i] : null;
  const row = item.rows[i] || {};
  if (item.plan === "hd"){
    const own = nextTargetHd(item, i, lastSet, a.unit, a.streak || 0, a.last && a.last.fromHistory ? a.last.gapWeeks : null);
    const p = a.partner;
    // Same exercise earlier this week (Legs A → Legs B): start from that result. Main set only, same unit only.
    if (p && p.day < item.day && i === firstWorkRow(item) && Number(p.kg) > 0 && p.unit === a.unit && Number(p.reps) > 0)
      return {text: "Same as your Day " + p.day + (p.weekday ? " (" + p.weekday + ")" : "") + " this week: " + fmtLoad(p.kg, a.unit) + " × " + p.reps + " clean.",
        kg: Number(p.kg), reps: Number(p.reps), from: "partner"};
    return own;
  }
  if (row.role === "top"){
    const lastDate = a.last ? (a.last.fromHistory ? a.last.histDate : a.lastWeekStart) : null;
    return topSetCheck(nextTopSet(item.lift, lastSet, plannedTopLeft(a.cycle, lastDate), row.reps, a.unit), row, lastSet, a.unit);
  }
  if (row.role === "test") return testTarget(item, i, a, lastSets);
  if (row.role === "backoff"){
    const todayTop = a.entry && a.entry.sets[0] ? Number(a.entry.sets[0].kg) : 0;
    const topKg = todayTop > 0 ? todayTop : rowTarget(item, 0, a).kg;
    return Object.assign(backoffTarget(topKg, item.backoffPct, a.unit), {reps: Number(row.reps) || null});
  }
  if (row.role === "test" || row.role === "check" || row.role === "warm") return {text: "", kg: null};
  return nextAccessory(item, i, lastSets, a.unit);
}

// Heavy Duty. Takes an item, a row index and the same args as rowTarget. Returns the warm-up line data:
// {pct, kg, workingKg, from, source} or {pct, pending: true}, or null for rows without a warm-up percentage.
// Rules: the main-set load is this week's entry, else today's target, else last week's load.
// The warm-up share is the one you actually used last time (last warm-up ÷ last main set, same unit),
// so your own choices carry forward; with no history, or a share outside CONFIG.warmupShareRange,
// it is the plan's percentage. Same main-set weight as last time → exactly last time's warm-up weight.
function hdWarmup(item, i, a){
  const row = item.rows[i];
  if (!row || row.role !== "warm" || !row.pct || row.pct >= 100) return null;
  const w = firstWorkRow(item);
  const lastSets = a.last && a.last.sets ? a.last.sets.map(s => sameUnit(withUnit(s, a.last.unit), a.unit)) : null;
  const lastWarm = lastSets && lastSets[i] && Number(lastSets[i].kg) > 0 ? Number(lastSets[i].kg) : 0;
  const lastWork = lastSets && lastSets[w] && Number(lastSets[w].kg) > 0 ? Number(lastSets[w].kg) : 0;
  const now = a.entry && a.entry.sets[w] ? Number(a.entry.sets[w].kg) : 0;
  let workingKg = 0, from = "";
  if (now > 0){ workingKg = now; from = "this week"; }
  else {
    const t = rowTarget(item, w, a);
    if (t.kg){ workingKg = t.kg; from = "today's target"; }
    else if (lastWork){ workingKg = lastWork; from = "last time"; }
  }
  if (!workingKg){
    if (lastWarm) return {pct: row.pct, kg: lastWarm, workingKg: 0, from: "", source: "last-only"};
    return {pct: row.pct, pending: true};
  }
  const share = lastWarm && lastWork ? lastWarm / lastWork : 0;
  const range = CONFIG.warmupShareRange;
  if (share >= range[0] && share <= range[1]){
    if (workingKg === lastWork) return {pct: Math.round(share * 100), kg: lastWarm, workingKg: workingKg, from: from, source: "same"};
    return {pct: Math.round(share * 100), kg: roundTo(workingKg * share, a.unit), workingKg: workingKg, from: from, source: "yours", planPct: row.pct};
  }
  return {pct: row.pct, kg: warmupLoad(row.pct, workingKg, a.unit), workingKg: workingKg, from: from, source: "plan"};
}

/* ---------- 2.18 Logging a set quickly ---------- */

// Takes the plan's rest text and the row's role. Returns seconds to rest after that set, or null.
// Rules: "None" → no rest (the first half of a pair); a range uses its lower end; "4 min after the
// top set, 3 min after back-offs" picks the part for the role; warm-ups and checklists → null,
// because the plan gives them no rest time.
function restSeconds(text, role){
  if (role === "warm" || role === "check" || role === "time" || role === "rounds") return null;
  let t = String(text || "");
  if (/after the top set/.test(t)){ const parts = t.split(","); t = role === "top" ? parts[0] : (parts[1] || parts[0]); }
  if (/^\s*none/i.test(t)) return null;
  const m = t.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*(s|min)\b/);
  if (!m) return null;
  return m[2] === "min" ? Number(m[1]) * 60 : Number(m[1]);
}

// Takes an item and a row index. Returns the planned reps for that row as a number, or null.
// Rules: Heavy Duty reads the row's part of the prescription ("15 @ 50%" → 15, "10–12 @ 100%" → 10);
// powerbuilding reads the row's reps ("10–12" → 10).
function planRowReps(item, i){
  const row = item.rows[i] || {};
  if (item.plan === "pb"){ const m = String(row.reps || "").match(/\d+/); return m ? Number(m[0]) : null; }
  const parts = String(item.repsText || "").split(/,|→/);
  const m = String(parts[i] || "").match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// Takes the set as typed, the suggested load (warm-up weight or target), last time's same set, the
// planned reps and the target's reps. Returns {reps, kg}: what "Log set" saves. Rules: anything typed
// wins; an empty weight takes the suggested load, else last time's; empty reps take the target's reps,
// else last time's, else the planned reps.
function suggestedSet(set, suggestKg, lastSet, planReps, targetReps){
  const lastOk = lastSet && isLogged(lastSet);
  const reps = set.reps !== "" && set.reps != null ? set.reps : (targetReps ? String(targetReps) : (lastOk ? String(lastSet.reps) : (planReps ? String(planReps) : "")));
  let kg = set.kg;
  if (kg === "" || kg == null) kg = suggestKg ? fmtNum(suggestKg) : (lastOk && Number(lastSet.kg) > 0 ? fmtNum(lastSet.kg) : "");
  return {reps: reps, kg: kg};
}

// Takes an item, a row index and rowTarget's args. Returns {kg, from} for showing a weight even when no
// target rule applies, or null. Order: the target, then last time's same set, then last time's heaviest
// working set, then the latest history for this exercise name (same unit only).
function bestKnownLoad(item, i, a, history){
  const t = rowTarget(item, i, a);
  if (t.kg) return {kg: t.kg, from: "target"};
  const sets = a.last && a.last.sets ? a.last.sets.map(x => sameUnit(withUnit(x, a.last.unit), a.unit)) : [];
  if (sets[i] && Number(sets[i].kg) > 0) return {kg: Number(sets[i].kg), from: "last"};
  const best = bestSet(sets.filter((x, k) => isWorkingRow(item, k)));
  if (best && best.kg > 0) return {kg: best.kg, from: "last"};
  const h = history ? history[keyOf(item.name)] : null;
  if (h && h.kg > 0 && (h.unit || "kg") === a.unit) return {kg: h.kg, from: "history"};
  return null;
}

// Takes an item and its entry (or null). Returns {done, total}: logged sets out of the planned sets,
// counting working sets only when the exercise has warm-ups.
function setsProgress(item, entry){
  const idx = item.rows.map((r, i) => i).filter(i => isWorkingRow(item, i) || item.rows[i].role === "check");
  const sets = entry ? entry.sets : [];
  return {done: idx.filter(i => isLogged(sets[i])).length, total: idx.length};
}

// Takes an item and its entry. Returns the index of the first set not yet logged, or -1 when all are.
function firstOpenRow(item, entry){
  const sets = entry ? entry.sets : item.rows.map(emptySet);
  for (let i = 0; i < sets.length; i++) if (!isLogged(sets[i])) return i;
  return -1;
}

/* ---------- 2.19 Saved swaps and extra exercises ---------- */

// Takes extras from a file or state. Returns clean extras: {dayN: [{id, name, unit, sets, doneAt}]}.
function cleanExtras(x){
  const out = {};
  if (!x || typeof x !== "object") return out;
  Object.keys(x).forEach(k => {
    const n = Number(k);
    if (!(n >= 1 && n <= CONFIG.trainingDays) || !Array.isArray(x[k])) return;
    out[n] = x[k].slice(0, CONFIG.maxExtrasPerDay).map((e, i) => ({
      id: str(e && e.id) || "x" + n + "-" + i, name: str(e && e.name).slice(0, 60), unit: e && e.unit === "plates" ? "plates" : "kg",
      sets: cleanSets(e && e.sets).length ? cleanSets(e.sets) : [emptySet()], doneAt: parseISO(str(e && e.doneAt)) ? str(e.doneAt) : null
    })).filter(e => e.name || e.sets.some(isLogged));
  });
  return out;
}

// Takes the saved list for one exercise or day and a new record {name, unit, sets, date}. Returns the list
// with that name moved to the front (newest first), keeping a regular flag already set, at most CONFIG.maxSaved.
function rememberNamed(list, rec){
  const k = keyOf(rec.name), old = (list || []).filter(x => keyOf(x.name) === k)[0];
  const merged = Object.assign({}, rec, {regular: !!(old && old.regular)});
  return [merged].concat((list || []).filter(x => keyOf(x.name) !== k)).slice(0, CONFIG.maxSaved);
}

// Takes a slot, a week's entries, that week's extras and the week's date. Remembers every named swap with
// logged sets (per exercise, so per day) and every extra exercise (per day). Changes slot in place.
// Rule: only the plan's own slot is touched, so Heavy Duty and Powerbuilding keep separate lists.
function harvestSaved(slot, entries, extras, date){
  slot.savedSwaps = slot.savedSwaps || {}; slot.savedExtras = slot.savedExtras || {};
  Object.keys(entries || {}).forEach(id => {
    const e = entries[id], r = e && (e.replacement || (e.replaced ? e.repl : null));
    if (!e || !e.replaced || !r || !str(r.name).trim()) return;
    const sets = cleanSets(r.sets);
    if (!sets.some(isLogged)) return;
    slot.savedSwaps[id] = rememberNamed(slot.savedSwaps[id], {name: str(r.name).trim(), unit: r.unit === "plates" ? "plates" : "kg", measure: cleanMeasure(r.measure), sets: sets, date: str(r.date) || date});
  });
  Object.keys(extras || {}).forEach(d => (extras[d] || []).forEach(x => {
    if (!x.name || !x.sets.some(isLogged)) return;
    slot.savedExtras[d] = rememberNamed(slot.savedExtras[d], {name: x.name, unit: x.unit, sets: x.sets, date: x.doneAt || date});
  }));
  return slot;
}

// Takes a slot. For each exercise with a regular swap, starts this week's entry already swapped.
// Changes slot in place. Rule: only entries with nothing logged yet are touched.
function applyRegularSwaps(slot){
  Object.keys(slot.savedSwaps || {}).forEach(id => {
    const reg = (slot.savedSwaps[id] || []).filter(x => x.regular)[0];
    if (!reg || !EXERCISES[id]) return;
    const e = slot.entries[id];
    if (e && ((e.sets || []).some(isLogged) || e.replaced)) return;
    slot.entries[id] = {sets: [], replaced: true, doneAt: null, missed: {on: false, reason: "", date: null},
      repl: {name: reg.name, reason: "other", date: slot.weekStart, unit: reg.unit, measure: cleanMeasure(reg.measure), sets: reg.sets.map(emptySet)}};
  });
  return slot;
}

// Takes a slot, an exercise id, the swap {name, unit, setCount}, on or off and today's date.
// Turns "do this instead every week" on or off for that swap. Changes slot in place.
// Rules: one regular swap per exercise; a new name is saved with empty sets, so it has no targets
// until a week with it logged is finished.
function setRegularSwap(slot, id, swap, on, today){
  slot.savedSwaps = slot.savedSwaps || {};
  let list = (slot.savedSwaps[id] || []).map(x => Object.assign({}, x, {regular: false}));
  const k = keyOf(swap.name);
  if (!k) return slot;
  if (!list.some(x => keyOf(x.name) === k)){
    const n = Math.max(1, swap.setCount || 1), sets = [];
    for (let i = 0; i < n; i++) sets.push(emptySet());
    list = [{name: String(swap.name).trim().slice(0, 60), unit: swap.unit === "plates" ? "plates" : "kg", measure: cleanMeasure(swap.measure), sets: sets, date: today, regular: false}].concat(list).slice(0, CONFIG.maxSaved);
  }
  list.forEach(x => { if (keyOf(x.name) === k) x.regular = !!on; });
  slot.savedSwaps[id] = list;
  return slot;
}

// Takes a slot, an exercise id and a swap name. Removes that saved swap. Changes slot in place.
function forgetSwap(slot, id, name){
  const k = keyOf(name);
  slot.savedSwaps[id] = (slot.savedSwaps[id] || []).filter(x => keyOf(x.name) !== k);
  if (!slot.savedSwaps[id].length) delete slot.savedSwaps[id];
  return slot;
}

// Takes the slot's saved list for an exercise and a swap name. Returns that saved record, or null.
function savedSwapFor(list, name){ return (list || []).filter(x => keyOf(x.name) === keyOf(name))[0] || null; }

// Takes a swap name. Returns "time" when it's a hold measured in seconds (plank, hang, wall sit), else "reps".
// Takes a swap name. Returns "time" for a hold measured in seconds (plank, hang, wall sit), "distance" for a
// carry or walk measured in metres, else "reps". Holds are checked first: "hold still 30 s" is a hold.
function measureFor(name){
  const n = String(name || "");
  if (new RegExp(CONFIG.holdWords.join("|"), "i").test(n)) return "time";
  if (new RegExp(CONFIG.carryWords.join("|"), "i").test(n)) return "distance";
  return "reps";
}
// Takes any value. Returns "time", "distance" or "reps".
function cleanMeasure(m){ return m === "time" || m === "distance" ? m : "reps"; }

// Takes the plan's swap text, e.g. "plank, 3 × 30–45 s". Returns the exercise name only: "Plank".
function planSwapName(text){
  const n = String(text || "").split(/,\s*(?=\d)/)[0].trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Takes an exercise entry, its session item, a saved swap (or null) and today's date. Turns the swap on
// with one set row per planned row, so the swap is logged exactly like the exercise it replaces.
// Changes e in place. Rule: sets already logged on the swap are kept.
function startSwap(e, item, rec, today){
  e.replaced = true;
  e.missed = {on: false, reason: "", date: null};
  e.repl = Object.assign({name: "", reason: "", date: null, unit: "kg", sets: []}, e.repl || {});
  if (!e.repl.date) e.repl.date = today;
  if (rec){ e.repl.name = rec.name; e.repl.unit = rec.unit; e.repl.measure = rec.measure ? cleanMeasure(rec.measure) : measureFor(rec.name); }
  else if (!e.repl.measure && item.log === "carry") e.repl.measure = "distance";   // a carry swapped for another carry
  if (!(e.repl.sets || []).some(isLogged)) e.repl.sets = item.rows.map(emptySet);
  return e;
}

// Takes an item, a row index, the saved sets from last time, the unit and "reps" or "time".
// Returns {text, kg, reps}: the target for a swapped exercise's set, using the replaced exercise's
// rep range and the plan's rules. Rules: Heavy Duty targets only its main set (from your heaviest swap
// set); Powerbuilding targets every working set; holds add CONFIG.holdStepSeconds at the same weight.
function swapTarget(item, i, savedSets, unit, measure){
  const none = {text: "", kg: null};
  if (!savedSets || !savedSets.some(isLogged) || !isWorkingRow(item, i)) return none;
  const logged = savedSets.filter(isLogged);
  if (measure === "distance"){
    const last = isLogged(savedSets[i]) ? savedSets[i] : logged.reduce((m, x) => Number(x.reps) > Number(m.reps) ? x : m);
    const kg = Number(last.kg) || 0, m = Number(last.reps);
    return {text: "Walk " + m + " m" + (kg > 0 ? " with " + fmtLoad(kg, unit) + "." : "."), kg: kg > 0 ? kg : null, reps: m};
  }
  if (measure === "time"){
    const last = isLogged(savedSets[i]) ? savedSets[i] : logged.reduce((m, x) => Number(x.reps) > Number(m.reps) ? x : m);
    const kg = Number(last.kg) || 0, secs = Number(last.reps) + CONFIG.holdStepSeconds;
    return {text: "Hold " + secs + " s" + (kg > 0 ? " with " + fmtLoad(kg, unit) + " added." : "."), kg: kg > 0 ? kg : null, reps: secs};
  }
  const range = repRange(item) || {min: 6, max: 8};
  if (item.plan === "hd"){
    if (item.rows[i] && item.rows[i].role !== "work") return none;
    const top = bestSet(savedSets);
    const pseudo = {plan: "hd", rows: [{role: "work"}], repMin: range.min, repMax: range.max};
    return nextTargetHd(pseudo, 0, Object.assign({unit: unit}, logged.filter(x => Number(x.kg || 0) === top.kg && Number(x.reps) === top.reps)[0]), unit, 0, null);
  }
  const pseudo = {plan: "pb", rows: item.rows.map(() => ({role: "work"})), repMin: range.min, repMax: range.max, leftText: item.leftText || "", log: "lift", rule: null};
  return nextAccessory(pseudo, Math.min(i, savedSets.length - 1), savedSets, unit);
}

// Heavy Duty swaps. Takes an item, a warm-up row index, the saved sets, the unit and the measure.
// Returns {kg, pct, workKg} from the plan's percentage of the swap's main-set target, or null.
function swapWarmup(item, i, savedSets, unit, measure){
  const row = item.rows[i];
  if (item.plan !== "hd" || cleanMeasure(measure) !== "reps" || !row || row.role !== "warm" || !row.pct) return null;
  const w = item.rows.findIndex(r => r.role === "work"), t = w >= 0 ? swapTarget(item, w, savedSets, unit, measure) : null;
  return t && t.kg ? {kg: warmupLoad(row.pct, t.kg, unit), pct: row.pct, workKg: t.kg} : null;
}

// Takes a set, the unit and "reps" or "time". Returns "60 kg × 10", "12 reps" or "45 s, 10 kg added".
function swapSetText(s, unit, measure){
  if (!s || !isLogged(s)) return "";
  if (measure === "time") return s.reps + " s" + (Number(s.kg) > 0 ? ", " + fmtLoad(s.kg, unit) + " added" : "");
  if (measure === "distance") return (Number(s.kg) > 0 ? fmtLoad(s.kg, unit) + " for " : "") + s.reps + " m";
  return perfText(s, unit);
}

// Takes a name, a unit and a set count. Returns a new extra exercise for a day.
function newExtra(name, unit, setCount, idSeed){
  const n = Math.max(1, Math.min(CONFIG.maxSetsPerExtra, setCount || 1)), sets = [];
  for (let i = 0; i < n; i++) sets.push(emptySet());
  return {id: "x-" + idSeed, name: String(name || "").slice(0, 60), unit: unit === "plates" ? "plates" : "kg", sets: sets, doneAt: null};
}

/* ---------- 2.20 History and progress ---------- */

// Takes an archive {hd: [exports], pb: [exports]}, a plan id, an export and the most weeks to keep.
// Returns a new archive with that week added (replacing the same week if present), newest first.
function archiveAdd(archive, planId, exp, max){
  const out = {hd: (archive && archive.hd) || [], pb: (archive && archive.pb) || []};
  if (!exp || !exp.weekStart) return out;
  const slim = {weekStart: exp.weekStart, entries: exp.entries || {}, extras: cleanExtras(exp.extras)};
  out[planId] = [slim].concat(out[planId].filter(w => w.weekStart !== exp.weekStart))
    .sort((a, b) => (b.weekStart || "").localeCompare(a.weekStart || "")).slice(0, max);
  return out;
}

// Takes week entries {id: entry} in export or state shape, that week's extras and a plan id.
// Returns the week laid out by day: [{day, title, items:[{id, name, unit, sets:[{label, set, working}],
// swap:{name, unit, sets}|null, missed, madeUp}], extras:[{name, unit, sets}]}]. Unknown ids are ignored.
function weekView(entries, extras, planId){
  const plan = PROGRAMME.plans[planId], days = [];
  plan.days.forEach(d => {
    const items = [];
    Object.keys(entries || {}).forEach(id => {
      const meta = EXERCISES[id];
      if (!meta || meta.plan !== planId || meta.day !== d.n || meta.item.kind === "warmup") return;
      const e = entries[id] || {}, item = meta.item;
      const labels = planId === "hd" ? (item.rows || parseRows(item.sets)) : null;
      const sets = (e.sets || []).map((st, i) => {
        const label = e.rows && e.rows[i] ? e.rows[i] : (labels && labels[i]) || "Set " + (i + 1);
        return {label: label, set: st, working: !/^Warm-up/.test(label) && !/warm-up/i.test(item.name)};
      }).filter(x => isLogged(x.set));
      const r = e.replacement || (e.replaced ? e.repl : null);
      const swap = e.replaced && r && (r.sets || []).some(isLogged) ? {name: str(r.name) || "Unnamed swap", unit: r.unit || "kg", measure: cleanMeasure(r.measure), sets: (r.sets || []).filter(isLogged)} : null;
      const missed = !!(e.missed && e.missed.on && !e.missed.madeUp);
      if (!sets.length && !swap && !missed) return;
      items.push({id: id, name: item.name, unit: e.unit || "kg", sets: sets, swap: swap, missed: missed, madeUp: !!(e.missed && e.missed.madeUp), order: Object.keys(EXERCISES).indexOf(id)});
    });
    items.sort((a, b) => a.order - b.order);
    const ex = ((extras || {})[d.n] || []).filter(x => x.sets.some(isLogged)).map(x => ({name: x.name, unit: x.unit, sets: x.sets.filter(isLogged)}));
    if (items.length || ex.length) days.push({day: d.n, title: d.title, items: items, extras: ex});
  });
  return days;
}

// Takes the slot, plan id, this week's sessions, the archive and the time now.
// Returns every week there is to show, newest first: [{weekStart, source ("this"|"last"|"archive"), view}].
// Rule: one entry per week; this week from the live log, then the archive, then last week if not archived.
function historyWeeks(slot, planId, sessions, archive, nowISO){
  const out = [], seen = {};
  const push = (ws, source, view) => { if (!ws || seen[ws] || !view.length) return; seen[ws] = true; out.push({weekStart: ws, source: source, view: view}); };
  const cur = buildExport(slot, planId, sessions, null, nowISO);
  push(cur.weekStart, "this", weekView(cur.entries, cur.extras, planId));
  ((archive && archive[planId]) || []).forEach(w => push(w.weekStart, "archive", weekView(w.entries, cleanExtras(w.extras), planId)));
  if (slot.lastWeek && slot.lastWeek.weekStart) push(slot.lastWeek.weekStart, "last", weekView(slot.lastWeek.entries, slot.lastWeek.extras, planId));
  return out.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

// Takes the weeks from historyWeeks and an exercise id. Returns its progress, oldest first:
// [{weekStart, kind ("planned"|"swap"), name, kg, reps, unit}] using the heaviest working set each week.
// Rule: swaps are listed under their own name, never mixed into the planned exercise's numbers.
// Takes a load, reps done and reps left (blank when not logged). Returns the estimated one-rep max, or 0.
// Rule: Epley with reps left counted, the reps-in-reserve way a top set is read:
//   load × (1 + (reps + left) ÷ 30). A single with nothing left is its own max.
//   Heavy Duty sets go to failure, so they have nothing left and this is plain Epley.
//   Less exact above about 12 reps, so the app calls it an estimate.
function estMax(kg, reps, left){
  kg = Number(kg) || 0; reps = Number(reps) || 0;
  const l = left === "" || left == null ? 0 : Math.max(0, Number(left) || 0);
  if (kg <= 0 || reps <= 0) return 0;
  const total = reps + l;
  return total <= 1 ? kg : Math.round(kg * (1 + total / PROGRAMME.plans.pb.estimatedMax.divisor) * 10) / 10;
}
// Takes sets. Returns the highest estimated max among the logged ones.
function bestEstMax(sets){ return (sets || []).filter(isLogged).reduce((m, s) => Math.max(m, estMax(s.kg, s.reps, s.left)), 0); }
// Takes an estimated max, reps, reps left and the unit. Returns the load that should give those reps with
// that many left, rounded down so the prediction errs light.
function loadForReps(em, reps, left, unit){
  const x = em / (1 + (Number(reps) + Number(left)) / PROGRAMME.plans.pb.estimatedMax.divisor);
  return unit === "plates" ? Math.max(1, Math.floor(x)) : Math.max(CONFIG.kgStep, Math.floor(x / CONFIG.kgStep) * CONFIG.kgStep);
}

// Takes history weeks and an exercise id. Returns one row per week, oldest first:
// {weekStart, kind ("planned" or "swap"), name, kg, reps, unit, est, measure}. kg and reps are the heaviest
// set; est is the best estimated max from any working set that week, so a lighter set with many more reps can count.
function exerciseProgress(weeks, id){
  const out = [];
  weeks.slice().reverse().forEach(w => w.view.forEach(d => d.items.forEach(it => {
    if (it.id !== id) return;
    const b = bestSet(it.sets.filter(x => x.working).map(x => x.set));
    if (b) out.push({weekStart: w.weekStart, kind: "planned", name: it.name, kg: b.kg, reps: b.reps, unit: it.unit, est: bestEstMax(it.sets.filter(x => x.working).map(x => x.set))});
    if (it.swap){ const sb = bestSet(it.swap.sets); if (sb) out.push({weekStart: w.weekStart, kind: "swap", name: it.swap.name, kg: sb.kg, reps: sb.reps, unit: it.swap.unit, measure: it.swap.measure, est: it.swap.measure ? 0 : bestEstMax(it.swap.sets)}); }
  })));
  return out;
}

/* ---------- 2.21 App state shape ---------- */

// Takes a Monday. Returns an empty slot: one plan's weekly log and memory.
function freshSlot(weekStart){
  return {weekStart: weekStart, entries: {}, units: {}, lastWeek: null, history: {}, varHistory: {}, loadedStreaks: {}, pastVariations: [], missedDays: {},
    extras: {}, savedSwaps: {}, savedExtras: {}, ui: {dismissedMiss: {}}};
}
// Takes the whole state and a plan id. Returns that plan's slot.
// Rule: Heavy Duty lives at the top level, exactly where version 1 kept it; powerbuilding lives in state.pb.
function slotOf(state, plan){ return plan === "pb" ? state.pb : state; }

// Takes whatever was stored (or null) and today. Returns a complete, current state.
// Rules: version 1 data loads unchanged; moved calf ids are renamed; missing parts are added.
function normaliseState(raw, today){
  const base = Object.assign(freshSlot(laterOf(CONFIG.defaultCycleStart, mondayOf(today))), {
    ui: {tab: "train", day: 1, varOpen: false, dismissedMiss: {}, helpSeen: false, planView: null, openEx: null, finder: {}},
    cycle: null, pb: null
  });
  const s = raw && typeof raw === "object" && typeof raw.entries === "object" ? raw : {};
  const st = Object.assign(base, s, {ui: Object.assign(base.ui, s.ui || {})});
  Object.keys(CONFIG.movedIds).forEach(oldId => {
    const newId = CONFIG.movedIds[oldId];
    if (st.entries[oldId] && !st.entries[newId]) st.entries[newId] = st.entries[oldId];
    delete st.entries[oldId];
    if (st.lastWeek && st.lastWeek.entries && st.lastWeek.entries[oldId]){
      if (!st.lastWeek.entries[newId]) st.lastWeek.entries[newId] = st.lastWeek.entries[oldId];
      delete st.lastWeek.entries[oldId];
    }
  });
  (st.pastVariations || []).forEach(v => { if (v.day === 2 && isCalf(v.original)) v.day = 3; });
  st.weekStart = mondayOf(parseISO(st.weekStart) ? st.weekStart : today);
  ["units", "history", "varHistory", "loadedStreaks", "missedDays", "extras", "savedSwaps", "savedExtras"].forEach(k => { if (!objOr(st[k], null)) st[k] = {}; });
  if (!Array.isArray(st.pastVariations)) st.pastVariations = [];
  if (st.cycle && !(parseISO(st.cycle.start) && PLAN_IDS.indexOf(st.cycle.first) >= 0)) st.cycle = null;
  // Block lengths: whole weeks from 0 to the maximum; anything else falls back to the default length
  if (st.cycle) st.cycle.lengths = Array.isArray(st.cycle.lengths) ? st.cycle.lengths.slice(0, 2000).map(n => {
    const v = parseInt(n, 10); return v >= 0 && v <= CONFIG.maxBlockWeeks ? v : CONFIG.blockWeeks; }) : [];
  if (st.pb && typeof st.pb === "object"){
    st.pb = Object.assign(freshSlot(st.pb.weekStart || mondayOf(today)), st.pb);
    st.pb.ui = Object.assign({dismissedMiss: {}}, st.pb.ui || {});
  }
  return st;
}
// Takes the state and today. Adds the powerbuilding slot once the cycle is known. Changes state in place.
function ensurePbSlot(state, today){
  if (!state.pb && state.cycle) state.pb = freshSlot(nextWeekForPlan(state.cycle, "pb", today));
  return state;
}
