/* =====================================================================
   LAYER 2b: STORAGE
   All saving and loading goes through these four functions. Swap their
   bodies for backend calls and nothing else needs to change.
   ===================================================================== */

// Returns true when this browser can save.
function storageAvailable(){
  try { window.localStorage.setItem(CONFIG.storageKey + "-test", "1"); window.localStorage.removeItem(CONFIG.storageKey + "-test"); return true; }
  catch (e){ return false; }
}
// Returns the saved state object, or null when nothing is saved or it can't be read.
function storageLoad(){
  try { const raw = window.localStorage.getItem(CONFIG.storageKey); return raw ? JSON.parse(raw) : null; }
  catch (e){ return null; }
}
// Takes the whole state. Saves it. Returns true on success.
function storageSave(state){
  try { window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); return true; }
  catch (e){ return false; }
}
// Theme choice: its own key, never part of the training data or the export file.
// Returns {palette, mode, contrast} or null.
function themeLoad(){
  try { const raw = window.localStorage.getItem(CONFIG.themeStorageKey); return raw ? JSON.parse(raw) : null; }
  catch (e){ return null; }
}
// Takes {palette, mode, contrast}. Saves it. Returns true on success.
function themeSave(t){
  try { window.localStorage.setItem(CONFIG.themeStorageKey, JSON.stringify(t)); return true; }
  catch (e){ return false; }
}
// History archive: its own key, the last CONFIG.archiveWeeks finished weeks per plan.
// Returns {hd: [weeks], pb: [weeks]}, empty lists when nothing is saved.
function archiveLoad(){
  try { const raw = window.localStorage.getItem(CONFIG.archiveStorageKey), a = raw ? JSON.parse(raw) : null;
    return {hd: a && Array.isArray(a.hd) ? a.hd : [], pb: a && Array.isArray(a.pb) ? a.pb : []}; }
  catch (e){ return {hd: [], pb: []}; }
}
// Takes the archive. Saves it. Returns true on success.
function archiveSave(a){
  try { window.localStorage.setItem(CONFIG.archiveStorageKey, JSON.stringify(a)); return true; }
  catch (e){ return false; }
}
// Takes the export object and a file name. Hands the file to the user. Returns a promise of
// "saved", "cancelled", "busy" or "fallback" (the caller then shows the text to copy).
function storageDownload(obj, filename){
  const json = JSON.stringify(obj, null, 2);
  const viewer = window.claude && typeof window.claude.use === "function" ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
  return viewer.then(dl => {
    if (dl) return dl.save({filename: filename, data: json}).then(() => "saved", err => {
      const code = err && err.code;
      return code === "declined" ? "cancelled" : code === "rate_limited" ? "busy" : "fallback";
    });
    if (dl === null) return "fallback";
    try {
      const url = URL.createObjectURL(new Blob([json], {type: "application/json"}));
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return "saved";
    } catch (e){ return "fallback"; }
  });
}

/* =====================================================================
   LAYER 3: DISPLAY
   Reads the state, asks the logic layer for every number and rule, and
   draws the page. Event handlers change the state through logic
   functions, save, then redraw.
   ===================================================================== */

/* ---------- 3.1 Page helpers ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
const esc = s => String(s != null ? s : "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
function todayISO(){ return toISO(new Date()); }
const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// A word the user can tap for a one-line explanation
function term(key, label){ return '<button type="button" class="term" data-term="' + key + '">' + esc(label) + "</button>"; }
const PLAN_NAMES = {hd: PROGRAMME.plans.hd.name, pb: PROGRAMME.plans.pb.name};

/* ---------- 3.2 State, saving and context ---------- */
let storageOK = storageAvailable();
let state = normaliseState(storageLoad(), todayISO());
if (state.ui.tab !== "plan") state.ui.tab = "train";
ensurePbSlot(state, todayISO());

let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (!storageSave(state)){ storageOK = false; renderStorageWarning(); } }, CONFIG.saveDelayMs);
}
function cycleOf(){ return state.cycle || {start: CONFIG.defaultCycleStart, first: CONFIG.defaultFirstPlan}; }
// {exerciseId: variationId}: this week's pick, else last week's
function variantChoice(slot){
  const out = {};
  Object.keys(EXERCISES).forEach(id => {
    const e = slot.entries[id], lw = slot.lastWeek && slot.lastWeek.entries ? slot.lastWeek.entries[id] : null;
    const v = (e && e.variant) || (lw && lw.variant);
    if (v) out[id] = v;
  });
  return out;
}
function sessionsFor(plan, slot, cycle){
  const w = weekInfo(cycle, slot.weekStart), vc = variantChoice(slot), out = [];
  for (let n = 1; n <= CONFIG.trainingDays; n++) out.push(buildSession(plan, n, w, vc));
  return out;
}
// Everything a render needs, worked out once
function ctx(){
  const today = todayISO(), cycle = cycleOf(), now = weekInfo(cycle, today);
  const plan = now.plan, slot = slotOf(state, plan) || state;
  return {today: today, cycle: cycle, now: now, plan: plan, slot: slot, slotWeek: weekInfo(cycle, slot.weekStart), sessions: sessionsFor(plan, slot, cycle)};
}
function sessionOf(c, n){ return c.sessions.filter(s => s.n === n)[0]; }
function itemOf(c, id){
  for (let k = 0; k < c.sessions.length; k++){ const hit = sessionItems(c.sessions[k]).filter(it => it.id === id)[0]; if (hit) return hit; }
  return null;
}
// Heavy Duty. Takes the view context and an item. Returns this week's result on the item's partner day with
// its weekday name, or null (Powerbuilding has no partner days: its targets come from the programme).
function partnerFor(c, item){
  if (item.plan !== "hd") return null;
  const wp = weekPartner(c.slot, item.id);
  return wp ? Object.assign({}, wp, {weekday: weekdayName(addDays(c.slot.weekStart, wp.day - 1))}) : null;
}
function rowArgs(c, item){
  return {entry: c.slot.entries[item.id], last: lastEntryFor(c.slot, item, c.today, c.cycle), unit: unitOf(c.slot.units, item),
    streak: (c.slot.loadedStreaks || {})[item.id] || 0, cycle: c.cycle, lastWeekStart: c.slot.lastWeek ? c.slot.lastWeek.weekStart : null,
    partner: partnerFor(c, item)};
}
// Training day number for today in this slot's week, or 0
function todaysDay(c){ return c.slot.weekStart === c.now.weekStart && !c.now.before && dayOfWeek(c.today) <= CONFIG.trainingDays ? dayOfWeek(c.today) : 0; }
function weekLabel(plan, w){
  if (w.before) return "Starts " + fmtDayDate(w.weekStart);
  if (plan === "hd") return "Week " + w.blockWeek + " of " + w.blockWeeks;
  if (w.testWeek) return "Test week";
  return PROGRAMME.plans.pb.weekLabels[w.weekLetter === "A" ? 0 : 1] + (w.heavyWeek ? ", heavy week" : "") + " · block " + w.fortnight + " of 3";
}

/* ---------- 3.3 Header, notices, setup and help ---------- */
function renderHeader(c){
  const td = parseISO(c.today);
  $("#header-date").textContent = td ? weekdayName(c.today) + " " + td.getDate() + " " + MONTHS[td.getMonth()] : "";
  if (!state.cycle){ $("#header-plan").textContent = "Training Tracker"; $("#header-week").textContent = "Set up your plans to begin."; $("#header-swap").textContent = ""; return; }
  $("#header-plan").textContent = PLAN_NAMES[c.plan];
  $("#header-week").innerHTML = term(c.plan === "pb" ? "weekab" : "block", weekLabel(c.plan, c.now));
  const sw = nextSwap(c.cycle, c.today);
  $("#header-swap").innerHTML = esc("Swaps to " + PLAN_NAMES[sw.plan] + " on " + fmtDayDate(sw.date) + ". ") +
    '<button type="button" class="link-button" data-go-calendar>Change in calendar</button>';
}
function renderStorageWarning(){ $("#storage-warning").hidden = storageOK; }
function renderSetup(){
  const show = !state.cycle;
  $("#setup-panel").hidden = !show;
  if (!show) return;
  if (!$("#setup-start").value) $("#setup-start").value = CONFIG.defaultCycleStart;
  const first = $$('input[name="setup-first"]');
  if (!first.some(i => i.checked)) first.forEach(i => { i.checked = i.value === CONFIG.defaultFirstPlan; });
}
function renderHelp(){ $("#help-panel").hidden = !state.cycle || !!state.ui.helpSeen; }

/* ---------- 3.4 Train view ---------- */
function ringSVG(frac, size, label){
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, off = circ * (1 - Math.max(0, Math.min(1, frac)));
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring__track"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring__fill" stroke-dasharray="' + circ.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' +
    '<text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring__text">' + esc(label) + "</text></svg>";
}
function renderTrain(c){
  const day = sessionOf(c, state.ui.day) || c.sessions[0];
  state.ui.day = day.n;
  renderWeekStatus(c);
  renderWeekBanner(c);
  renderDayTabs(c);
  renderSessionHead(c, day);
  renderProgress(c, day);
  renderUpNext(c, day);
  renderCatchup(c, day);
  $("#exercise-list").innerHTML = sessionListHTML(c, day);
  renderExtras(c, day);
  renderSwapsLog(c, day);
  renderFab(c);
}
function renderWeekStatus(c){
  const lw = c.slot.lastWeek;
  $("#week-status").innerHTML = "This log: <strong>" + esc(fmtRange(c.slot.weekStart)) + "</strong>. " +
    (lw ? "Targets from " + esc(lw.weekStart ? fmtRange(lw.weekStart) : "a loaded week") + '. <button type="button" class="link-button" id="button-clear-loaded">Clear loaded week</button>'
      : "Load last week to see targets.");
  const w = weekDaysDone(c.slot, c.sessions);
  $("#week-ring").innerHTML = ringSVG(w.total ? w.done / w.total : 0, 40, w.done + "/" + w.total) + "<span>days done</span>";
}
function renderWeekBanner(c){
  let html = "";
  if (c.now.before) html = '<div class="notice"><p>Your plan starts ' + esc(fmtDayDate(c.now.weekStart)) + ". You can look around and log early if you like.</p></div>";
  else if (c.slot.weekStart < c.now.weekStart) html = '<div class="notice notice--warn"><p>This log is for ' + esc(fmtRange(c.slot.weekStart)) + ". Start a new week to log this week.</p>" +
    '<div class="button-row"><button type="button" class="button button--primary" data-open-new-week>Start new week</button><button type="button" class="button" data-export>Export this week first</button></div></div>';
  else if (c.slot.weekStart > c.now.weekStart) html = '<div class="notice"><p>This log starts ' + esc(fmtDayDate(c.slot.weekStart)) + ".</p></div>";
  $("#week-banner").innerHTML = html;
}
function renderDayTabs(c){
  const t = todaysDay(c);
  $("#day-tabs").innerHTML = c.sessions.map(s => {
    const sel = s.n === state.ui.day, p = dayProgress(c.slot, s);
    return '<button type="button" role="tab" class="day-tab' + (s.n === t ? " is-today" : "") + '" id="tab-day-' + s.n + '" aria-selected="' + sel + '" aria-controls="exercise-list" tabindex="' + (sel ? 0 : -1) + '" data-day="' + s.n + '">' +
      '<span class="day-tab__name">' + esc(weekdayName(addDays(c.slot.weekStart, s.n - 1)).slice(0, 3)) + '</span><span class="day-tab__num">' + s.n + "</span>" +
      '<span class="day-tab__dots" aria-hidden="true">' + (s.rest ? "" : Array.from({length: Math.min(p.total, 6)}, (_, k) => '<span class="day-tab__dot' + (k < p.done ? " is-on" : k < p.done + p.missed ? " is-missed" : "") + '"></span>').join("")) + "</span>" +
      '<span class="visually-hidden">Day ' + s.n + (s.n === t ? ", today" : "") + ", " + '<span class="day-tab__count">' + (s.rest ? "Rest" : p.done + " of " + p.total) + "</span> done</span></button>";
  }).join("");
  $("#exercise-list").setAttribute("aria-labelledby", "tab-day-" + state.ui.day);
}
function renderSessionHead(c, day){
  const lwDay = c.slot.lastWeek && c.slot.lastWeek.missedDays ? c.slot.lastWeek.missedDays[day.n] : null;
  const notes = day.notes.map(n => '<p class="small">' + esc(n) + "</p>").join("");
  $("#session-head").innerHTML = '<h2 class="session-head__title">Day ' + day.n + ": " + esc(day.title) + (todaysDay(c) === day.n ? " (today)" : "") + "</h2>" +
    (day.time ? '<p class="small muted">Takes ' + esc(day.time) + ", warm-up included.</p>" : "") +
    (day.intro ? '<p class="small">' + term("pair", "Pairs") + ": " + esc(day.intro.replace(/^Exercises run in pairs: /, "")) + "</p>" : "") + notes +
    (lwDay ? '<p class="small muted">Last week: ' + esc(lwDay.note.replace(/^Day \d+: /, "")) + ".</p>" : "");
}
// Summary card: a ring for today's exercises and three colour-coded counts (sets, exercises, week)
function renderSummary(c, day){
  const p = dayProgress(c.slot, day), w = weekDaysDone(c.slot, c.sessions);
  let sets = 0, setsDone = 0;
  if (!day.rest) sessionItems(day).filter(it => it.counted && it.kind !== "warmup").forEach(it => {
    const e = c.slot.entries[it.id];
    if (isMissed(e)) return;
    const sp = e && e.replaced ? {done: e.repl.sets.filter(isLogged).length, total: e.repl.sets.length} : setsProgress(it, e);
    sets += sp.total; setsDone += sp.done;
  });
  const frac = p.total ? p.accounted / p.total : 0;
  $("#summary-ring").innerHTML = ringSVG(frac, 104, day.rest ? "Rest" : Math.round(frac * 100) + "%");
  const row = (n, label, val, total, unit) => '<div class="mrow"><div class="mrow__top"><span class="metric-label metric-' + n + '">' + label + '</span><span class="metric-value metric-' + n + '">' + val + '<span class="metric-unit">' + esc(unit) + "</span></span></div>" +
    '<div class="mbar mbar--' + n + '" aria-hidden="true"><span style="width:' + (total ? Math.round(val / total * 100) : 0) + '%"></span></div></div>';
  $("#summary-metrics").innerHTML = day.rest ? '<p class="small muted">Rest day. Nothing to log.</p>' :
    row(1, "Sets", setsDone, sets, "/" + sets) + row(3, "Exercises", p.accounted, p.total, "/" + p.total) + row(2, "Week", w.done, w.total, "/" + w.total + " days");
}
function renderProgress(c, day){
  renderSummary(c, day);
  const p = dayProgress(c.slot, day);
  $("#progress-fill").style.width = (p.total ? Math.round(p.accounted / p.total * 100) : 0) + "%";
  const rail = $("#progress-rail");
  rail.setAttribute("aria-valuemax", p.total); rail.setAttribute("aria-valuenow", p.done);
  $("#progress-text").textContent = day.rest ? "Rest day." : p.done + " of " + p.total + " exercises done" + (p.missed ? ", " + p.missed + " missed" : "") + ".";
}
function renderUpNext(c, day){
  const box = $("#up-next");
  if (day.rest){ box.className = "up-next"; box.innerHTML = '<div class="up-next__body"><p class="up-next__kicker">Rest</p><p class="up-next__title">No training today. Recover well.</p></div>'; return; }
  const p = dayProgress(c.slot, day), n = nextSet(c.slot, day), md = (c.slot.missedDays || {})[day.n];
  const ring = ringSVG(p.total ? p.accounted / p.total : 0, 56, (p.total ? Math.round(p.accounted / p.total * 100) : 0) + "%");
  if (md){
    const st = dayMakeupStatus(c.slot, day.n, day);
    box.className = "up-next up-next--missed";
    box.innerHTML = ringSVG(st.total ? st.made.length / st.total : 0, 56, st.made.length + "/" + st.total) + '<div class="up-next__body"><p class="up-next__kicker">Day ' + day.n + " missed</p>" +
      '<p class="up-next__title">Made up so far: ' + st.made.length + " of " + st.total + ".</p>" +
      '<p class="small muted">' + esc(CONFIG.dayMissReasons[md.reason] || "") + ". " + esc(fmtDayDate(md.date)) + ".</p>" +
      '<div class="button-row"><button type="button" class="button button--primary" data-open-makeup="' + day.n + '">Log make-ups</button>' +
      '<button type="button" class="link-button" data-undo-missday="' + day.n + '">Undo missed day</button></div></div>';
  } else if (!n){
    const next = sessionOf(c, day.n + 1);
    box.className = "up-next";
    box.innerHTML = '<div class="up-next__body"><p class="up-next__kicker">Day ' + day.n + ' done</p><p class="up-next__title">Every exercise is logged or accounted for.</p>' +
      (next && !next.rest ? '<button type="button" class="button button--primary" data-goto-day="' + next.n + '">Open Day ' + next.n + ": " + esc(next.title) + "</button>" : '<button type="button" class="button button--primary" data-export>Export this week</button>') + "</div>";
  } else {
    const a = rowArgs(c, n.item), ev = ensureEntryView(c, n.item);
    const t = n.kind === "main" ? rowTarget(n.item, n.i, Object.assign(a, {entry: ev})) : replGuide(c, n.item, ev, n.i, ev.repl.unit || "kg").t;
    const label = plainRowLabel((n.item.rows[n.i] || {label: "Extra set"}).label);
    box.className = "up-next";
    box.innerHTML = '<div class="up-next__body"><p class="up-next__kicker">Up next</p><p class="up-next__title">' + esc(n.kind === "repl" && ev.repl.name.trim() ? ev.repl.name.trim() : n.item.name) + "</p>" +
      '<p class="small">' + esc(label) + (t.text ? ". " + esc(t.text) : "") + "</p>" +
      '<div class="button-row"><button type="button" class="button button--primary" data-next-set>Log this set</button>' +
      '<button type="button" class="link-button" data-miss-day="' + day.n + '">Missed this day?</button></div></div>';
  }
}
// Entry as stored, without creating one (display must not change state while drawing)
function ensureEntryView(c, item){
  const e = c.slot.entries[item.id];
  if (!e) return {sets: item.rows.map(emptySet), replaced: false, repl: {name: "", reason: "", sets: [emptySet()]}, missed: {on: false}};
  if (e.replaced && e.repl && !e.repl.sets.some(isLogged) && e.repl.sets.length !== item.rows.length) e.repl.sets = item.rows.map(emptySet);
  return e;
}
// For a swapped exercise: last time's saved swap with this name, its target and Heavy Duty warm-up for row i
function replGuide(c, item, e, i, unit){
  const rec = e.repl.name.trim() ? savedSwapFor((c.slot.savedSwaps || {})[item.id], e.repl.name) : null;
  const ok = rec && rec.unit === unit && (rec.measure || "reps") === (e.repl.measure || "reps");
  return {rec: rec, t: ok ? swapTarget(item, i, rec.sets, unit, e.repl.measure) : {text: "", kg: null}, w: ok ? swapWarmup(item, i, rec.sets, unit, e.repl.measure) : null};
}

function renderCatchup(c, day){
  const others = c.sessions.filter(s => s.n !== day.n);
  const pending = [], madeHere = [];
  others.forEach(s => sessionItems(s).forEach(it => {
    const e = c.slot.entries[it.id];
    if (isMissed(e) && !e.missed.viaDay) pending.push({item: it, session: s, e: e});
    if (isMadeUp(e) && e.missed.madeUp.day === day.n) madeHere.push(it);
  }));
  if (!pending.length && !madeHere.length){ $("#catchup").innerHTML = ""; return; }
  $("#catchup").innerHTML = '<section class="catchup" aria-labelledby="catchup-title"><h2 id="catchup-title">Catch up</h2>' +
    '<p class="small">' + (pending.length ? "Missed this week. Log one here if you fit it in today." : "Made up in this session.") + "</p>" +
    pending.map(x => '<div class="catchup__item"><div><strong>' + esc(x.item.name) + '</strong><br><span class="small muted">Day ' + x.session.n + ", " + esc(x.session.title) +
      (CONFIG.missedReasons[x.e.missed.reason] ? ". " + esc(CONFIG.missedReasons[x.e.missed.reason]) : "") + '</span></div><button type="button" class="button button--primary" data-makeup="' + x.item.id + '">Log it today<span class="visually-hidden">: ' + esc(x.item.name) + "</span></button></div>").join("") +
    (madeHere.length ? '<div class="exercise-list">' + madeHere.map(it => exerciseHTML(c, it)).join("") + "</div>" : "") + "</section>";
}

// Takes a context and an item. Returns its superset partner's id (the other half of Pair A, B...), or null.
function pairPartnerId(c, item){
  if (!item || !item.pair) return null;
  for (const s of c.sessions) for (const g of (s.groups || [])){
    if (g.pair && g.items.length > 1 && g.items.some(x => x.id === item.id)){ const o = g.items.filter(x => x.id !== item.id)[0]; return o ? o.id : null; }
  }
  return null;
}
// An exercise shows open when it is the open one, or when its superset partner is: a pair opens as one sheet
function isOpenView(c, item){ return state.ui.openEx === item.id || (!!state.ui.openEx && pairPartnerId(c, item) === state.ui.openEx); }
function sessionListHTML(c, day){
  if (day.rest) return '<p class="muted">Rest day. Nothing to log.</p>';
  return day.groups.map(g => {
    const inner = g.items.map(it => exerciseHTML(c, it)).join("");
    const pairOpen = g.pair && g.items.length > 1 && g.items.some(it => it.id === state.ui.openEx);
    if (g.pair && g.items.length > 1) return '<div class="pair-group' + (pairOpen ? " is-open" : "") + '"' + (pairOpen ? ' role="group" aria-label="Pair ' + esc(g.pair) + ": " + esc(g.items.map(i => i.name).join(" and ")) + '"' : "") + '><p class="pair-group__label">' + term("pair", "Pair " + g.pair) + ": do " + esc(g.items.map(i => i.pair).join(" then ")) + ", then rest." + (pairOpen ? " Log each set side by side." : "") + "</p>" + (pairOpen ? '<div class="pair-group__cols">' + inner + "</div>" : inner) + "</div>";
    return (g.title ? '<h3 class="group-title">' + esc(g.title) + "</h3>" : "") + inner;
  }).join("");
}

// One-line target for the collapsed row: sets × reps, reps left, weight
function summaryText(c, item){
  const parts = [];
  if (item.plan === "hd"){
    const wt = workingTarget(item);
    parts.push(item.setsText + (wt ? " × " + wt : ""));
  } else {
    parts.push(item.setsText);
    if (item.kind === "main" && item.rows[0].role === "top") parts.push(leftPhrase(item.rows[0].left) + " on the top set");
    else if (item.leftText && item.kind !== "warmup" && item.kind !== "main") parts.push(leftPhrase(item.leftText, item.log));
  }
  const e = c.slot.entries[item.id];
  if (isComplete(e)){
    const best = bestSet(e.replaced ? e.repl.sets : e.sets);
    if (best && e.replaced) parts.push((e.repl.name.trim() ? e.repl.name.trim() + ", " : "") + "logged " + swapSetText(best, e.repl.unit || "kg", e.repl.measure));
    else if (best) parts.push("logged " + histSetText(EXERCISES[item.id], best, unitOf(c.slot.units, item)));
    return parts.join(" · ");
  }
  if (e && e.replaced && e.repl && e.repl.name.trim()){ parts.push("swapping for " + e.repl.name.trim()); return parts.join(" · "); }
  if (hasWeight(item)){
    const a = rowArgs(c, item), w = firstWorkRow(item), k = bestKnownLoad(item, w, Object.assign(a, {entry: ensureEntryView(c, item)}), c.slot.history);
    if (k) parts.push((k.from === "target" ? "" : "last ") + fmtLoad(k.kg, a.unit));
    else if (item.log !== "bw" && !(item.kind === "main" && item.lift)) parts.push("no weight logged yet");
    else if (item.kind === "main" && item.lift){ const g = topSetGuess(item.lift, item.variant, state); if (g.kg) parts.push("about " + fmtLoad(g.kg, "kg")); }
  }
  return parts.join(" · ");
}

function exerciseHTML(c, item){
  const e = c.slot.entries[item.id], open = isOpenView(c, item);
  const done = isComplete(e), missed = isMissed(e), madeUp = isMadeUp(e);
  const cls = "exercise" + (open ? " is-open" : "") + (done ? " is-done" : "") + (missed ? " is-missed" : "") + (item.skipped ? " is-skipped" : "");
  const status = done ? "✓" : missed ? "–" : (item.pair || "");
  const tags = (item.optional && item.kind !== "warmup" ? '<span class="exercise__tag">Optional</span>' : "") + (missed ? '<span class="exercise__tag">Missed</span>' : "") +
    (madeUp ? '<span class="exercise__tag">Made up</span>' : "") + (e && e.replaced ? '<span class="exercise__tag">Swapped</span>' : "") + (item.skipped ? '<span class="exercise__tag">Skip</span>' : "");
  return '<article class="' + cls + '" id="ex-' + item.id + '" data-id="' + item.id + '">' +
    '<button type="button" class="exercise__summary" aria-expanded="' + open + '" aria-controls="ex-' + item.id + '-panel">' +
    '<span class="exercise__status" aria-hidden="true">' + esc(status) + "</span>" +
    '<span class="exercise__main"><span class="exercise__name">' + esc(item.name) + tags + "</span>" +
    '<span class="exercise__target">' + esc(item.skipped ? "Not this week." : summaryText(c, item)) + "</span>" +
    (item.skipped || item.kind === "warmup" || missed ? "" : (function(){ const p = e && e.replaced ? {done: e.repl.sets.filter(isLogged).length, total: e.repl.sets.length} : setsProgress(item, e); return p.total ? '<span class="exercise__count">' + p.done + "/" + p.total + " sets</span>" : ""; })()) +
    '<span class="visually-hidden">' + (done ? "Done." : missed ? "Missed." : "Not done yet.") + "</span></span>" +
    '<span class="exercise__chevron" aria-hidden="true"></span></button>' +
    '<div class="exercise__panel" id="ex-' + item.id + '-panel"' + (open ? "" : " hidden") + ">" + (open ? panelHTML(c, item) : "") + "</div></article>";
}

function panelHTML(c, item){
  const e = ensureEntryView(c, item), a = rowArgs(c, item), lw = a.last, missed = isMissed(e), madeUp = isMadeUp(e);
  const unit = a.unit;
  let html = '<div class="exercise__details">';
  if (item.plan === "hd") html += "<p>Plan: " + esc(hdPlanText(item)) + "</p>";
  else if (item.kind !== "warmup") html += "<p>" + esc(item.setsText) + (item.leftText ? " · " + (item.log === "carry" ? term("carryeffort", "Effort") + ": " + esc(leftPhrase(item.leftText, item.log).replace(/^effort: /, "")) : term("repsleft", "Reps left") + ": " + esc(leftPhrase(item.leftText, item.log))) : "") + "</p>";
  html += "<p>" + esc(item.equip) + (item.rest ? " · Rest " + esc(item.rest) : "") + "</p>";
  if (item.notes) html += "<p>" + esc(item.notes) + "</p>";
  html += "</div>";
  html += lastNoteHTML(lw, item);
  if (madeUp) html += makeupNoteHTML(c, item, e);
  const swapped = !madeUp && item.kind !== "warmup" && e.replaced && !missed;
  if (swapped) html += swapPanelHTML(c, item, e, lw);
  if (!missed && !swapped && item.variants) html += variantHTML(item, lw);
  if (!missed && !swapped && hasWeight(item)) html += unitToggleHTML(item, "main", unit);
  if (!missed && !swapped && item.kind === "main" && !item.rows.some(r => r.role === "test")) html += finderHTML(c, item);
  if (!missed && !swapped){
    if (item.plan === "pb" && item.log === "carry") html += '<p class="small muted">After each carry, pick ' + term("carryeffort", "how hard it was") + ".</p>";
    else if (item.plan === "pb" && hasWeight(item)) html += '<p class="small muted">After each set, pick how many ' + term("repsleft", "reps you had left") + ".</p>";
    html += '<div class="set-rows" data-kind="main">' + e.sets.map((s, i) => setRowHTML(c, item, "main", i, s, a)).join("") + "</div>";
    if (item.log !== "check" && item.log !== "time" && item.log !== "rounds") html += setActionsHTML("main", e.sets.length, item.name);
  }
  if (!madeUp && item.kind !== "warmup" && !e.replaced && !missed && !e.sets.some(isLogged)){
    const sv = ((c.slot.savedSwaps || {})[item.id] || [])[0];
    if (sv) html += '<p class="remind">Last time you did <strong>' + esc(sv.name) + "</strong> instead" + (sv.date && parseISO(sv.date) ? ", " + esc(fmtDate(sv.date)) : "") +
      '. <button type="button" class="link-button" data-act="swap-again">Swap again</button></p>';
  }
  if (!madeUp && item.kind !== "warmup"){
    html += '<div class="exercise__actions">' +
      '<button type="button" class="button" data-act="toggle-swap" aria-pressed="' + !!e.replaced + '">' + (e.replaced ? "Back to " + esc(item.name) : "Swap exercise") + "</button>" +
      '<button type="button" class="button" data-act="toggle-missed" aria-pressed="' + missed + '">Skip exercise</button></div>';
    if (missed) html += missedPanelHTML(c, item, e);
  }
  html += '<button type="button" class="button button--primary button--full" data-act="close">Save and close</button>';
  return html;
}
function hdPlanText(item){
  const parts = String(item.repsText).split(/,|→/).map(p => p.trim());
  return item.setsText + ". " + parts.map((p, i) => {
    const m = p.match(/^(.*?)\s*@\s*(\d+)%$/);
    if (!m) return p;
    return (i < parts.length - 1 ? "Warm-up " + (i + 1) + ": " + m[1] + " reps at " + m[2] + "%" : "Main set: " + m[1] + " reps");
  }).join(". ") + ".";
}
function lastNoteHTML(lw, item){
  if (!lw) return "";
  if (lw.missed && lw.missed.on && lw.missed.madeUp) return '<p class="small muted">Last week: missed on the day, made up on Day ' + esc(lw.missed.madeUp.day) + ".</p>";
  if (lw.missed && lw.missed.on) return '<p class="small muted">Last week: missed (' + esc((CONFIG.missedReasons[lw.missed.reason] || "no reason given").toLowerCase()) + ").</p>";
  if (lw.replaced && lw.replacement) return '<p class="small muted">Last week: swapped for ' + esc(lw.replacement.name || "an unnamed exercise") + ".</p>";
  if (lw.otherVariant){ const v = item.variants.filter(x => x.id === lw.otherVariant)[0]; return '<p class="small muted">Last week you did ' + esc(v ? v.label.toLowerCase() : "another version") + ", so this one has no targets yet.</p>"; }
  if (lw.fromHistory) return '<p class="small muted">Targets from your last session of this, ' + esc(fmtDate(lw.histDate)) + ".</p>";
  return "";
}
function variantHTML(item, lw){
  return '<div class="field"><label class="field__label" for="' + item.id + '-variant">Version</label>' +
    '<select class="select-input" id="' + item.id + '-variant" data-variant>' + item.variants.map(v => '<option value="' + v.id + '"' + (v.id === item.variant ? " selected" : "") + ">" + esc(v.label) + "</option>").join("") + "</select></div>";
}
function unitToggleHTML(item, kind, unit){
  const b = (u, t) => '<button type="button" class="button" data-act="unit" data-kind="' + kind + '" data-unit="' + u + '" aria-pressed="' + (unit === u) + '">' + t + "</button>";
  return '<div class="field"><span class="field__label" id="unit-' + item.id + "-" + kind + '">Log weight in kg or ' + term("plates", "plates") + '</span><div class="segmented" role="group" aria-labelledby="unit-' + item.id + "-" + kind + '">' + b("kg", "kg") + b("plates", "Plates") + "</div></div>";
}
function setActionsHTML(kind, count, name){
  const what = "set";
  return '<div class="button-row"><button type="button" class="button" data-act="add" data-kind="' + kind + '">Add ' + what + '<span class="visually-hidden"> to ' + esc(name) + "</span></button>" +
    '<button type="button" class="button" data-act="remove" data-kind="' + kind + '"' + (count <= 1 ? " disabled" : "") + ">Remove last " + what + '<span class="visually-hidden"> from ' + esc(name) + "</span></button></div>";
}

// One set: label, target, warm-up weight, inputs, last time
function setRowHTML(c, item, kind, i, s, a){
  const base = item.id + "-" + kind + "-" + i;
  const row = item.rows[i] || {label: "Extra set " + (i - item.rows.length + 1), role: "set"};
  const e = a.entry || ensureEntryView(c, item);
  const unit = kind === "repl" ? (e.repl.unit || "kg") : a.unit;
  let last = null;
  if (kind === "main" && a.last && a.last.sets) last = sameUnit(withUnit(a.last.sets[i], a.last.unit), unit);
  if (kind === "repl" && a.last && a.last.replaced && a.last.replacement && keyOf(a.last.replacement.name) === keyOf(e.repl.name) && e.repl.name.trim()) last = sameUnit(withUnit((a.last.replacement.sets || [])[i], a.last.replacement.unit || "kg"), unit);
  const measure = kind === "repl" ? (e.repl.measure || "reps") : null;
  const rg = kind === "repl" ? replGuide(c, item, e, i, unit) : null, savedRec = rg ? rg.rec : null;
  if (kind === "repl" && !last && savedRec && (savedRec.measure || "reps") === measure) last = sameUnit(withUnit(savedRec.sets[i], savedRec.unit), unit);
  const beat = compareToLast(s, last);
  const warm = row.role === "warm";
  if (row.role === "check"){
    return '<div class="set-row" data-kind="' + kind + '" data-i="' + i + '"><label class="check-row"><input type="checkbox" data-check' + (isLogged(s) ? " checked" : "") + "><span>" + esc(row.label) + "</span></label></div>";
  }
  const t = kind === "main" ? rowTarget(item, i, Object.assign({}, a, {entry: e})) : rg.t;
  const w = kind === "main" && item.plan === "hd" ? hdWarmup(item, i, Object.assign({}, a, {entry: e})) : (rg && rg.w ? Object.assign({source: "swap"}, rg.w) : null);
  const known = kind === "main" && !(w && w.kg) && !t.kg && isWorkingRow(item, i) ? bestKnownLoad(item, i, Object.assign({}, a, {entry: e}), c.slot.history) : null;
  const sug = suggestedSet(s, w && w.kg ? w.kg : (t.kg || (known ? known.kg : null)), last, measure === "time" || (measure === "distance" && item.log !== "carry") ? null : planRowReps(item, i), t.reps || null);
  const active = activeRowOf(item, kind === "repl" ? {sets: e.repl.sets} : e) === i;
  if (!active) return compactRowHTML(item, kind, i, s, row, sug, unit, beat, measure);
  let label = plainRowLabel(row.label);
  if (row.role === "warm") label = term("warmup", label);
  else if (row.role === "work") label = term("mainset", label);
  else if (row.role === "top") label = term("topset", label);
  else if (row.role === "backoff") label = term("backoff", label);
  else label = esc(label);
  const how = kind === "repl" ? (measure === "reps" ? "lift" : measure === "time" ? "seconds" : "distance") : item.log;
  const spec = row.reps && measure !== "time" && !(kind === "repl" && measure === "distance" && item.log !== "carry") ? " · " + esc(row.reps) + countWord(how, row.reps) + (row.left && parseLeft(row.left) ? ", " + esc(leftPhrase(row.left, item.log)) : "") : "";
  let html = '<div class="set-row' + (warm ? " is-warm" : "") + (beat.reps || beat.kg ? " is-beat" : "") + '" data-kind="' + kind + '" data-i="' + i + '">' +
    '<div class="set-row__head"><span class="set-row__label">' + label + spec + '</span><span class="set-row__beat">Beat last time</span></div>';
  if (t.text) html += '<p class="set-row__hint">' + term("target", "Target") + ": " + esc(t.text) + "</p>";
  if (kind === "repl" && w) html += '<p class="set-row__hint">Use <strong>' + esc(fmtLoad(w.kg, unit)) + "</strong>: " + term("percent", w.pct + "%") + " of your target " + esc(fmtLoad(w.workKg, unit)) + ".</p>";
  if (kind === "main" && item.plan === "hd" && row.role === "work"){
    const wp = weekPartner(c.slot, item.id);
    if (wp && t.from !== "partner") html += '<p class="set-row__hint">' + term("weekbase", "This week") + ", Day " + wp.day + " (" + esc(weekdayName(addDays(c.slot.weekStart, wp.day - 1))) + "): " +
      esc(wp.kg > 0 ? fmtLoad(wp.kg, wp.unit) + " × " + wp.reps : wp.reps + " reps") + ". " + (wp.day < item.day ? "Aim to hold this." : "Your baseline for the week.") + "</p>";
  }
  if (w && kind === "main"){
    let line;
    if (w.pending) line = esc(w.pct + "% of your main-set weight. Enter that weight to see this in " + (unit === "plates" ? "plates." : "kg."));
    else if (w.source === "last-only") line = "Use <strong>" + esc(fmtLoad(w.kg, unit)) + "</strong>: what you used last time.";
    else if (w.source === "same") line = "Use <strong>" + esc(fmtLoad(w.kg, unit)) + "</strong>: what you used last time, with the same main-set weight.";
    else if (w.source === "yours") line = "Use <strong>" + esc(fmtLoad(w.kg, unit)) + "</strong>: your own " + term("percent", w.pct + "%") + " from last time, of " + esc(fmtLoad(w.workingKg, unit)) + " (" + esc(w.from) + ")." + (w.pct !== w.planPct ? " Plan says " + w.planPct + "%." : "");
    else line = "Use <strong>" + esc(fmtLoad(w.kg, unit)) + "</strong>: " + term("percent", w.pct + "%") + " of " + esc(fmtLoad(w.workingKg, unit)) + ", " + esc(w.from) + ".";
    html += '<p class="set-row__hint">' + line + "</p>";
  }
  html += '<div class="set-row__fields">' + fieldsHTML(item, kind, row, s, base, unit, warm, sug.kg ? Number(sug.kg) : null, sug.reps, measure) + "</div>";
  if (kind === "main" && (row.role === "top" || (row.role === "test" && i === 2)) && isLogged(s) && Number(s.kg) > 0){
    const em = estimatedMax(s.kg, s.reps, s.left);
    if (em) html += '<p class="set-row__hint">' + term("estmax", "Estimated max") + ": about " + esc(fmtLoad(em, unit)) + ".</p>";
  }
  const lastText = last && isLogged(last) ? (kind === "repl" ? swapSetText(last, unit, measure) : item.log === "carry" ? (Number(last.kg) > 0 ? fmtLoad(last.kg, unit) + " for " : "") + last.reps + " m" + (last.left !== undefined && last.left !== "" ? ", " + leftPhrase(String(last.left), "carry") : "") : perfText(last, unit)) : "";
  html += '<p class="set-row__last">' + (lastText ? "Last time: " + esc(lastText) : "") + "</p>";
  if (kind === "repl" || (item.log !== "time" && item.log !== "rounds")){
    if (!anyLogged() && !isLogged(s)) html += '<p class="small muted">Grey numbers are filled in for you. Change them, or just tap the button.</p>';
    html += '<button type="button" class="button button--primary button--full set-row__log" data-act="log-set">' + (isLogged(s) ? "Update set" : "Log set") + "</button>";
  }
  html += '<p class="error-text" role="alert"></p></div>';
  return html;
}
// Sets you aren't on: one line each, tap to edit
function compactRowHTML(item, kind, i, s, row, sug, unit, beat, measure){
  const done = isLogged(s);
  const badge = done ? "✓" : row.role === "warm" ? "W" : String(i + 1);
  const value = measure === "time" || measure === "distance" ? (done ? swapSetText(s, unit, measure) : sug.reps || sug.kg ? "Aim: " + swapSetText({reps: sug.reps || "?", kg: sug.kg}, unit, measure) : "Not logged")
    : done ? (Number(s.kg) > 0 ? fmtLoad(s.kg, unit) + (item.log === "carry" ? " for " : " × ") : "") + setText(s) + (item.log === "carry" ? " m" : Number(s.kg) > 0 ? "" : " reps") + (s.left !== undefined && s.left !== "" ? ", " + leftPhrase(String(s.left), item.log) : "")
    : (sug.kg || sug.reps ? "Aim: " + (sug.kg ? fmtLoad(sug.kg, unit) + (item.log === "carry" ? " for " + (sug.reps || "?") + " m" : " × " + (sug.reps || "?")) : sug.reps + countWord(item.log, sug.reps) + (hasWeight(item) && item.log !== "bw" ? ", choose a weight" : "")) : "Not logged");
  return '<div class="set-row set-row--compact' + (done ? " is-done" : "") + (beat.reps || beat.kg ? " is-beat" : "") + '" data-kind="' + kind + '" data-i="' + i + '">' +
    '<button type="button" class="set-row__compact" data-act="edit-set"><span class="set-row__badge" aria-hidden="true">' + badge + "</span>" +
    '<span class="set-row__name">' + esc(plainRowLabel(row.label)) + '</span><span class="set-row__value">' + esc(value) + "</span>" +
    '<span class="visually-hidden">. ' + (done ? "Logged. Tap to change." : "Tap to log.") + "</span></button></div>";
}
function anyLogged(){ return Object.keys(state.entries).concat(state.pb ? Object.keys(state.pb.entries) : []).some(id => { const e = state.entries[id] || (state.pb && state.pb.entries[id]); return e && (e.sets || []).some(isLogged); }); }
// Which set is open for editing in each exercise (memory only, never saved)
const activeRows = {};
function activeRowOf(item, e){ return activeRows[item.id] !== undefined ? activeRows[item.id] : firstOpenRow(item, e && e.sets ? e : null); }
function stepperHTML(base, f, labelText, value, mode, suggestion){
  return '<div class="stepper-field"><label class="field__label" for="' + base + "-" + f + '">' + esc(labelText) + "</label>" +
    '<div class="stepper"><button type="button" class="stepper__button" data-act="dec" data-f="' + f + '" aria-label="Less">−</button>' +
    '<input class="stepper__input" id="' + base + "-" + f + '" data-f="' + f + '" type="text" inputmode="' + mode + '" autocomplete="off" value="' + esc(value) + '"' + (suggestion ? ' placeholder="' + esc(fmtNum(suggestion)) + '" data-suggest="' + esc(suggestion) + '"' : "") + ">" +
    '<button type="button" class="stepper__button" data-act="inc" data-f="' + f + '" aria-label="More">+</button></div></div>';
}
function fieldsHTML(item, kind, row, s, base, unit, warm, suggestKg, suggestReps, measure){
  if (measure === "distance"){
    let h = stepperHTML(base, "reps", "Metres", s.reps, "numeric", suggestReps ? Number(suggestReps) : null) +
      stepperHTML(base, "kg", unit === "plates" ? "Plates" : "Weight (kg)", s.kg, "decimal", suggestKg);
    if (item.plan === "pb") h += '<div class="select-field"><label class="field__label" for="' + base + '-left">How hard was it?</label><select class="select-input" id="' + base + '-left" data-left><option value="">Choose</option>' +
      CONFIG.carryEffortScale.map(r => '<option value="' + r.left + '"' + (String(s.left) === String(r.left) ? " selected" : "") + ">" + r.left + " " + esc(r.name) + ": " + esc(r.short) + "</option>").join("") + "</select></div>";
    return h;
  }
  if (measure === "time") return stepperHTML(base, "reps", "Seconds held", s.reps, "numeric", suggestReps ? Number(suggestReps) : null) +
    stepperHTML(base, "kg", unit === "plates" ? "Added plates" : "Added kg", s.kg, "decimal", suggestKg);
  const weightLabel = unit === "plates" ? "Plates" : (item.log === "bw" && kind === "main" ? "Added kg" : "Weight (kg)");
  const log = kind === "repl" ? (item.log === "carry" ? "carry" : "lift") : item.log;
  if (log === "time") return stepperHTML(base, "reps", "Minutes", s.reps, "numeric");
  if (log === "rounds") return stepperHTML(base, "reps", "Rounds", s.reps, "numeric");
  let html = stepperHTML(base, "reps", log === "carry" ? "Metres" : (item.plan === "hd" && !warm ? "Clean reps" : "Reps"), s.reps, "numeric", suggestReps ? Number(suggestReps) : null);
  html += stepperHTML(base, "kg", weightLabel, s.kg, "decimal", suggestKg);
  if (item.plan === "pb" && log !== "time" && log !== "rounds"){
    const carry = log === "carry";
    html += '<div class="select-field"><label class="field__label" for="' + base + '-left">' + (carry ? "How hard was it?" : "Reps left") + "</label>" +
      '<select class="select-input" id="' + base + '-left" data-left><option value="">Choose</option>' +
      (carry ? CONFIG.carryEffortScale.map(r => '<option value="' + r.left + '"' + (String(s.left) === String(r.left) ? " selected" : "") + ">" + r.left + " " + esc(r.name) + ": " + esc(r.short) + "</option>").join("")
        : CONFIG.repsLeftScale.map(r => '<option value="' + r.left + '"' + (String(s.left) === String(r.left) ? " selected" : "") + ">" + r.left + " left: " + esc(r.short) + "</option>").join("")) + "</select></div>";
  }
  if (item.plan === "hd" && !warm){
    const end = s.end || "clean";
    html += '<div class="select-field"><label class="field__label" for="' + base + '-end">How did the set end?</label><select class="select-input" id="' + base + '-end" data-end>' +
      Object.keys(CONFIG.setEnds).map(k => '<option value="' + k + '"' + (end === k ? " selected" : "") + ">" + esc(CONFIG.setEnds[k]) + "</option>").join("") + "</select></div>";
    if (end === "rp" || end === "forced") html += stepperHTML(base, "extra", end === "rp" ? "Reps after the pause" : "Forced reps", s.extra || "", "numeric");
    html += '<p class="small muted set-row__terms">What these mean: ' + term("cleanrep", "clean rep") + " · " + term("restpause", "rest-pause") + " · " + term("forced", "forced reps") + " · " + term("short", "stopped short") + "</p>";
  }
  return html;
}

function finderHTML(c, item){
  const f = (state.ui.finder || {})[item.id];
  const g = topSetGuess(item.lift, item.variant, state);
  const hasLast = c.slot.lastWeek && c.slot.lastWeek.entries && c.slot.lastWeek.entries[item.id] && (c.slot.lastWeek.entries[item.id].sets || []).some(isLogged);
  if (!f) return '<button type="button" class="button" data-act="finder-open">' + (hasLast ? "Find my top set again" : "Find my top set") + "</button>" +
    (hasLast ? "" : '<p class="small muted">First time? ' + term("topsetfinder", "The finder") + " works out a starting weight.</p>");
  const guess = f.guess != null ? f.guess : g.kg;
  const ladder = topSetLadder(guess, item.lift);
  let html = '<div class="sub-panel"><h4>Find my top set</h4>' + (g.source ? '<p class="small">' + esc(g.source) + " " + esc(g.note) + "</p>" : '<p class="small">' + esc(g.note) + "</p>") +
    stepperHTML(item.id + "-finder", "guess", "Your guess (kg)", guess != null ? guess : "", "decimal") +
    '<table class="finder-table"><thead><tr><th scope="col">Set</th><th scope="col">Weight</th><th scope="col">Reps</th><th scope="col">Rest</th></tr></thead><tbody>' +
    ladder.map(s => "<tr><td>" + s.set + "</td><td>" + (s.kg ? "<strong>" + esc(fmtLoad(s.kg, "kg")) + "</strong><br>" : "") + esc(s.weight) + "</td><td>" + esc(s.reps) + "</td><td>" + esc(s.rest) + "</td></tr>").join("") + "</tbody></table>" +
    '<div class="select-field"><label class="field__label" for="' + item.id + '-finder-left">Reps left on set 5 (try ' + (f.tries || 1) + " of " + PROGRAMME.plans.pb.topSetMaxTries + ")</label>" +
    '<select class="select-input" id="' + item.id + '-finder-left" data-finder-left><option value="">Choose</option>' + CONFIG.repsLeftScale.map(r => '<option value="' + r.left + '">' + r.left + (r.left === 4 ? " or more" : "") + " left: " + esc(r.short) + "</option>").join("") + "</select></div>";
  if (f.message) html += '<p class="advice" role="status">' + esc(f.message) + "</p>";
  html += '<div class="button-row">' + (f.verdict && f.verdict !== "light" || f.done ? '<button type="button" class="button button--primary" data-act="finder-use">Use ' + esc(fmtLoad(guess || 0, "kg")) + " as my top set</button>" : "") +
    '<button type="button" class="button" data-act="finder-close">Close the finder</button></div></div>';
  return html;
}

function makeupNoteHTML(c, item, e){
  const mu = e.missed.madeUp, today = sessionOf(c, mu.day), yesterday = addDays(mu.date, -1), tomorrow = sessionOf(c, mu.day + 1);
  const yNames = [];
  c.sessions.forEach(s => sessionItems(s).forEach(o => {
    if (o.id === item.id) return;
    const oe = c.slot.entries[o.id];
    if (!oe || oe.replaced || isMissed(oe)) return;
    const when = isMadeUp(oe) ? oe.missed.madeUp.date : oe.doneAt;
    if (when === yesterday && oe.sets.some(isLogged)) yNames.push(o.name);
  }));
  const rec = recoveryNote(item.name, today ? sessionItems(today).filter(o => o.id !== item.id).map(o => o.name) : [], yNames, tomorrow ? sessionItems(tomorrow).map(o => o.name) : [], tomorrow ? tomorrow.n : null);
  return '<div class="sub-panel"><p class="small">Missed on Day ' + item.day + ", made up on Day " + esc(mu.day) + ", " + esc(fmtDate(mu.date)) + ".</p>" +
    (rec ? '<p class="small"><strong>Recovery:</strong> ' + esc(rec) + "</p>" : "") + '<button type="button" class="link-button" data-act="undo-makeup">Undo make-up</button></div>';
}
function adviceHTML(c, item, e, mode){
  const reason = mode === "missed" ? e.missed.reason : e.repl.reason;
  if (!reason) return '<div class="advice">Choose a reason to see advice for next time.</div>';
  const h = c.slot.history[keyOf(item.name)] || null;
  const weeks = h ? planWeeksBetween(c.cycle, c.plan, h.date, c.today) : 0;
  return '<div class="advice"><strong>Next time:</strong> ' + esc(replacementAdvice(item.name, reason, h, workingTarget(item) || item.setsText, mode === "missed" ? "" : (e.repl.name || "").trim(), weeks)) + "</div>";
}
function swapPanelHTML(c, item, e, lw){
  const base = item.id + "-repl";
  const a = rowArgs(c, item);
  const saved = (c.slot.savedSwaps || {})[item.id] || [], cur = keyOf(e.repl.name);
  const chips = saved.filter(x => keyOf(x.name) !== cur).map((x, k) => '<button type="button" class="chip" data-act="pick-swap" data-k="' + saved.indexOf(x) + '">' + esc(x.name) + "</button>").join("") +
    (item.swap && keyOf(planSwapName(item.swap)) !== cur && !saved.some(x => keyOf(x.name) === keyOf(planSwapName(item.swap))) ? '<button type="button" class="chip" data-act="use-swap">' + esc(planSwapName(item.swap)) + ' <span class="chip__tag">plan</span></button>' : "");
  const rec = cur ? savedSwapFor(saved, e.repl.name) : null;
  return '<div class="sub-panel"><h4>' + term("swap", "Swap") + ": instead of " + esc(item.name) + "</h4>" +
    (chips ? '<p class="small" id="' + base + '-picks">' + (saved.length ? "Your swaps for this day" + (item.swap ? ", and the plan's" : "") : "The plan suggests") + ':</p><div class="chip-row" role="group" aria-labelledby="' + base + '-picks">' + chips + "</div>" : "") +
    (item.swapNote ? '<p class="small">' + esc(item.swapNote) + "</p>" : "") +
    '<div class="field"><label class="field__label" for="' + base + '-name">What did you do instead?</label><input class="text-input" id="' + base + '-name" data-repl="name" type="text" maxlength="60" autocomplete="off" placeholder="For example, Smith machine squat" value="' + esc(e.repl.name) + '"></div>' +
    '<div class="field"><label class="field__label" for="' + base + '-reason">Why?</label><select class="select-input" id="' + base + '-reason" data-repl="reason"><option value="">Choose a reason</option>' +
    Object.keys(CONFIG.reasons).map(k => '<option value="' + k + '"' + (e.repl.reason === k ? " selected" : "") + ">" + esc(CONFIG.reasons[k]) + "</option>").join("") + "</select></div>" +
    unitToggleHTML(item, "repl", e.repl.unit || "kg") + measureToggleHTML(item, e.repl.measure || "reps") +
    "</div>" +
    '<div class="set-rows" data-kind="repl">' + e.repl.sets.map((s, i) => setRowHTML(c, item, "repl", i, s, a)).join("") + "</div>" +
    setActionsHTML("repl", e.repl.sets.length, e.repl.name || item.name) +
    '<div class="swap-foot">' +
    (cur ? '<label class="check-row"><input type="checkbox" data-regular' + (rec && rec.regular ? " checked" : "") + "><span>Do this instead every week on Day " + item.day + " (" + term("regularswap", "what this does") + ")</span></label>" : "") +
    (rec ? '<p class="small muted">Saved for Day ' + item.day + ' only. <button type="button" class="link-button" data-act="forget-swap">Remove from my swaps</button></p>' : "") +
    '<div data-advice="replaced">' + adviceHTML(c, item, e, "replaced") + "</div></div>";
}
function measureToggleHTML(item, measure){
  const b = (m, t) => '<button type="button" class="button" data-act="measure" data-measure="' + m + '" aria-pressed="' + (measure === m) + '">' + t + "</button>";
  return '<div class="field"><span class="field__label" id="measure-' + item.id + '">Count reps, ' + term("hold", "seconds or metres") + '</span><div class="segmented" role="group" aria-labelledby="measure-' + item.id + '">' + b("reps", "Reps") + b("time", "Seconds") + b("distance", "Metres") + "</div></div>";
}
// Takes how a set is counted ("carry"/"distance", "time", "rounds" or reps) and a number. Returns " m", " min", " reps"...
function countWord(how, n){
  if (how === "carry" || how === "distance") return " m";
  if (how === "seconds") return " s";
  if (how === "time") return " min";
  if (how === "rounds") return " rounds";
  return Number(n) === 1 ? " rep" : " reps";
}
function missedPanelHTML(c, item, e){
  if (e.missed.viaDay) return '<p class="small">Part of missed Day ' + item.day + ". Make it up from the yellow card.</p>";
  return '<div class="sub-panel"><div class="field"><label class="field__label" for="' + item.id + '-missed-reason">Why did you skip it?</label><select class="select-input" id="' + item.id + '-missed-reason" data-missed="reason"><option value="">Choose a reason</option>' +
    Object.keys(CONFIG.missedReasons).map(k => '<option value="' + k + '"' + (e.missed.reason === k ? " selected" : "") + ">" + esc(CONFIG.missedReasons[k]) + "</option>").join("") + "</select></div>" +
    '<div data-advice="missed">' + adviceHTML(c, item, e, "missed") + "</div></div>";
}

function renderSwapsLog(c, day){
  if (day.rest){ $("#swaps-log").innerHTML = ""; return; }
  const items = currentVariations(c.slot, day, c.today).concat((c.slot.pastVariations || []).filter(v => v.day === day.n)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const body = items.length ? "<ul>" + items.map(v => {
    const reasons = v.type === "missedday" ? CONFIG.dayMissReasons : (v.type === "missed" || v.type === "madeup") ? CONFIG.missedReasons : CONFIG.reasons;
    const main = v.type === "missedday" ? "Day " + v.day + " missed" : v.type === "madeup" ? v.original + ": made up on Day " + v.madeDay : v.type === "missed" ? v.original + ": skipped" : v.original + " → " + (v.replacement || "not named yet");
    return "<li><strong>" + esc(main) + '</strong><br><span class="small muted">' + esc(reasons[v.reason] || "No reason chosen") + ". " + esc(fmtDate(v.date)) + (v.current ? ", this week" : "") + ".</span></li>";
  }).join("") + "</ul>" : '<p class="small muted">Swaps and skips you log for this day show here.</p>';
  $("#swaps-log").innerHTML = '<details class="swaps-log" id="swaps-details"' + (state.ui.varOpen ? " open" : "") + "><summary>Swaps and skips log (" + items.length + ')</summary><div class="swaps-log__body">' + body + "</div></details>";
}

/* ---------- 3.4b Extra exercises (not counted in progress) ---------- */
function extrasOf(c, n){ c.slot.extras = c.slot.extras || {}; return c.slot.extras[n] || (c.slot.extras[n] = []); }
// Last time's record for an extra with this name on this day, or null
function savedExtraFor(c, n, name){ return name.trim() ? ((c.slot.savedExtras || {})[n] || []).filter(x => keyOf(x.name) === keyOf(name))[0] || null : null; }
function renderExtras(c, day){
  const box = $("#extras");
  if (day.rest){ box.innerHTML = ""; return; }
  const list = (c.slot.extras || {})[day.n] || [], here = list.map(x => keyOf(x.name));
  const reminders = ((c.slot.savedExtras || {})[day.n] || []).filter(x => here.indexOf(keyOf(x.name)) < 0);
  let html = '<h3 class="group-title" id="extras-title">' + term("extra", "Extra exercises") + "</h3>";
  html += reminders.map(x => {
    const b = bestSet(x.sets);
    return '<p class="remind">Last time you added <strong>' + esc(x.name) + "</strong>" + (b ? " (" + esc(perfText(b, x.unit)) + ")" : "") +
      '. <button type="button" class="link-button" data-act="extra-again" data-name="' + esc(x.name) + '">Add again<span class="visually-hidden">: ' + esc(x.name) + "</span></button></p>";
  }).join("");
  html += list.map(x => extraHTML(c, day.n, x)).join("");
  html += (list.length < CONFIG.maxExtrasPerDay ? '<button type="button" class="button button--full" data-act="extra-add">Add extra exercise</button>' : "") +
    (list.length || reminders.length ? "" : '<p class="small muted">For a burnout set or anything else you add. It won’t change your progress or targets.</p>');
  box.innerHTML = html;
}
function extraHTML(c, n, x){
  const open = state.ui.openExtra === x.id, done = x.sets.filter(isLogged).length, rec = savedExtraFor(c, n, x.name);
  const base = "extra-" + x.id;
  let html = '<article class="exercise extra' + (open ? " is-open" : "") + (done ? " is-done" : "") + '" id="' + base + '" data-xid="' + esc(x.id) + '">' +
    '<button type="button" class="exercise__summary" data-act="extra-toggle" aria-expanded="' + open + '" aria-controls="' + base + '-panel">' +
    '<span class="exercise__status" aria-hidden="true">' + (done ? "✓" : "+") + "</span>" +
    '<span class="exercise__main"><span class="exercise__name">' + esc(x.name || "New extra exercise") + '<span class="exercise__tag">Extra</span></span>' +
    '<span class="exercise__target">' + (done ? done + (done === 1 ? " set" : " sets") + " logged" : "Nothing logged yet") + "</span></span>" +
    '<span class="exercise__chevron" aria-hidden="true"></span></button>' +
    '<div class="exercise__panel" id="' + base + '-panel"' + (open ? "" : " hidden") + ">";
  if (open){
    html += '<div class="field"><label class="field__label" for="' + base + '-name">Exercise</label><input class="text-input" id="' + base + '-name" data-xname type="text" maxlength="60" autocomplete="off" placeholder="For example, Push-ups to failure" value="' + esc(x.name) + '"></div>';
    const b = (u, t) => '<button type="button" class="button" data-act="extra-unit" data-unit="' + u + '" aria-pressed="' + (x.unit === u) + '">' + t + "</button>";
    html += '<div class="field"><span class="field__label" id="' + base + '-unit">Log weight in kg or ' + term("plates", "plates") + '</span><div class="segmented" role="group" aria-labelledby="' + base + '-unit">' + b("kg", "kg") + b("plates", "Plates") + "</div></div>";
    html += '<div class="set-rows">' + x.sets.map((s, i) => {
      const last = rec && rec.unit === x.unit ? rec.sets[i] : null, lb = last && isLogged(last) ? last : null;
      return '<div class="set-row" data-i="' + i + '"><div class="set-row__head"><span class="set-row__label">Set ' + (i + 1) + "</span></div>" +
        '<div class="set-row__fields">' + stepperHTML(base + "-" + i, "reps", "Reps", s.reps, "numeric", lb ? Number(lb.reps) : null) +
        stepperHTML(base + "-" + i, "kg", x.unit === "plates" ? "Plates" : "Weight (kg)", s.kg, "decimal", lb && Number(lb.kg) > 0 ? Number(lb.kg) : null) + "</div>" +
        '<p class="set-row__last">' + (lb ? "Last time: " + esc(perfText(lb, x.unit)) : "") + '</p><p class="error-text" role="alert"></p></div>';
    }).join("") + "</div>";
    html += '<div class="button-row"><button type="button" class="button" data-act="extra-set-add"' + (x.sets.length >= CONFIG.maxSetsPerExtra ? " disabled" : "") + ">Add set</button>" +
      '<button type="button" class="button" data-act="extra-set-remove"' + (x.sets.length <= 1 ? " disabled" : "") + ">Remove last set</button></div>" +
      '<div class="button-row"><button type="button" class="button button--primary" data-act="extra-close">Save and close</button>' +
      '<button type="button" class="button" data-act="extra-delete">Remove this exercise</button></div>';
  }
  return html + "</div></article>";
}
function rerenderExtras(focusSel){
  const c = ctx(), day = sessionOf(c, state.ui.day); if (!day) return;
  renderExtras(c, day); syncExerciseSheet();
  if (focusSel){ const f = $("#extras " + focusSel); if (f) f.focus(); }
}
let extraTimer = null;
(function(){
  const root = $("#extras");
  const find = el => { const art = el.closest("[data-xid]"); if (!art) return null; const c = ctx(), list = extrasOf(c, state.ui.day), x = list.filter(v => v.id === art.dataset.xid)[0]; return x ? {c: c, list: list, x: x, art: art} : null; };
  function setValue(h, row, input, raw){
    const r = sanitize(input.dataset.f, raw, h.x.unit), i = +row.dataset.i;
    if (input.value !== r.value) input.value = r.value;
    $(".error-text", row).textContent = r.error;
    h.x.sets[i][input.dataset.f] = r.value;
    if (!h.x.doneAt && h.x.sets.some(isLogged)) h.x.doneAt = h.c.today;
    save();
  }
  root.addEventListener("click", ev => {
    clearTimeout(extraTimer);
    const btn = ev.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act;
    if (act === "extra-add" || act === "extra-again"){
      const c = ctx(), list = extrasOf(c, state.ui.day), rec = act === "extra-again" ? savedExtraFor(c, state.ui.day, btn.dataset.name) : null;
      const x = newExtra(rec ? rec.name : "", rec ? rec.unit : "kg", rec ? rec.sets.length : 1, Date.now().toString(36));
      list.push(x); state.ui.openExtra = x.id; state.ui.openEx = null; save(); renderAll();
      rerenderExtras(rec ? "#extra-" + x.id + "-0-reps" : "#extra-" + x.id + "-name");
      if (rec) toast(rec.name + " added. Last time's numbers are in grey.");
      return;
    }
    const h = find(btn); if (!h) return;
    if (act === "extra-toggle"){ state.ui.openExtra = state.ui.openExtra === h.x.id ? null : h.x.id; if (state.ui.openExtra && state.ui.openEx){ state.ui.openEx = null; renderAll(); } save(); rerenderExtras("#extra-" + h.x.id + " .exercise__summary"); }
    else if (act === "extra-close"){ state.ui.openExtra = null; save(); rerenderExtras("#extra-" + h.x.id + " .exercise__summary"); if (h.x.sets.some(isLogged)) toast((h.x.name || "Extra exercise") + " saved."); }
    else if (act === "extra-unit"){ h.x.unit = btn.dataset.unit === "plates" ? "plates" : "kg"; save(); rerenderExtras('[data-act="extra-unit"][data-unit="' + h.x.unit + '"]'); }
    else if (act === "extra-set-add"){ if (h.x.sets.length < CONFIG.maxSetsPerExtra){ h.x.sets.push(emptySet()); save(); rerenderExtras("#extra-" + h.x.id + "-" + (h.x.sets.length - 1) + "-reps"); } }
    else if (act === "extra-set-remove"){ if (h.x.sets.length > 1){ h.x.sets.pop(); save(); rerenderExtras('#extra-' + h.x.id + ' [data-act="extra-set-add"]'); } }
    else if (act === "extra-delete"){
      h.list.splice(h.list.indexOf(h.x), 1); if (state.ui.openExtra === h.x.id) state.ui.openExtra = null;
      save(); rerenderExtras('[data-act="extra-add"]'); toast((h.x.name || "Extra exercise") + " removed.");
    }
    else if (act === "inc" || act === "dec"){
      const row = btn.closest(".set-row"), f = btn.dataset.f, input = $('input[data-f="' + f + '"]', row);
      const step = f !== "kg" ? CONFIG.repsStep : h.x.unit === "plates" ? CONFIG.plateStep : CONFIG.kgStep;
      const suggest = Number(input.dataset.suggest) || 0;
      if (input.value === "" && suggest > 0){ setValue(h, row, input, fmtNum(suggest)); }
      else {
        const next = Math.max(0, Math.round(((Number(input.value) || 0) + (act === "inc" ? step : -step)) * 100) / 100);
        setValue(h, row, input, next === 0 && act === "dec" && f !== "kg" ? "" : fmtNum(next));
      }
      const t = $(".exercise__target", h.art), n = h.x.sets.filter(isLogged).length;
      t.textContent = n ? n + (n === 1 ? " set" : " sets") + " logged" : "Nothing logged yet";
    }
  });
  root.addEventListener("input", ev => {
    const t = ev.target, h = find(t); if (!h) return;
    if (t.matches("input[data-xname]")){ h.x.name = t.value.slice(0, 60); save(); return; }
    if (t.matches("input[data-f]")) setValue(h, t.closest(".set-row"), t, t.value);
  });
  // Redraw after leaving a field, late enough that a tap on a button wins (see deferRefresh)
  root.addEventListener("change", ev => {
    if (!find(ev.target)) return;
    clearTimeout(extraTimer);
    extraTimer = setTimeout(() => { const a = document.activeElement; rerenderExtras(a && a.id && a.closest("#extras") ? "#" + CSS.escape(a.id) : null); }, 300);
  });
})();

/* ---------- 3.5 Floating controls: next-set button, hazard card ---------- */
let upNextVisible = true;
function renderFab(c){
  const day = sessionOf(c, state.ui.day), n = day && !day.rest ? nextSet(c.slot, day) : null;
  $("#next-fab").hidden = state.ui.tab !== "train" || !state.cycle || !day || day.rest || !n || upNextVisible || !!state.ui.openEx;
  if (n){
    const e = c.slot.entries[n.item.id];
    $("#next-fab-title").textContent = n.kind === "repl" && e && e.repl.name.trim() ? e.repl.name.trim() : n.item.name;
    $("#next-fab-sub").textContent = plainRowLabel((n.item.rows[n.i] || {label: "Next set"}).label) + " is next";
  }
}
function renderHazard(c){
  const bar = $("#hazard-bar");
  let html = "";
  if (state.cycle && c.slot.weekStart === c.now.weekStart){
    const ask = unansweredDay(c.slot, c.sessions, c.today);
    const days = Object.keys(c.slot.missedDays || {}).map(Number).sort((a, b) => a - b);
    if (ask){
      html = '<p class="hazard-bar__title">No sets logged for Day ' + ask.n + ". Missed it?</p><p class=\"small\">" + esc(weekdayName(addDays(c.slot.weekStart, ask.n - 1))) + ", " + esc(ask.title) + "</p>" +
        '<div class="button-row"><button type="button" class="button" data-hz-yes="' + ask.n + '">Yes, I missed it</button><button type="button" class="button button--quiet" data-hz-trained="' + ask.n + '">I trained, log it now</button></div>';
    } else if (days.length){
      const n = days.filter(d => dayMakeupStatus(c.slot, d, sessionOf(c, d)).pending.length)[0] || days[0];
      const st = dayMakeupStatus(c.slot, n, sessionOf(c, n)), md = c.slot.missedDays[n];
      html = '<p class="hazard-bar__title">Day ' + n + " missed, " + esc(weekdayName(md.date)) + (days.length > 1 ? " (+" + (days.length - 1) + " more)" : "") + "</p>" +
        '<p class="small">Made up so far: ' + st.made.length + " of " + st.total + ".</p>" +
        '<div class="button-row"><button type="button" class="button" data-hz-open="' + n + '">Log make-ups</button></div>';
    }
  }
  bar.innerHTML = html;
  bar.hidden = !html;
  document.body.classList.toggle("has-hazard", !!html);
  if (html) document.documentElement.style.setProperty("--hazard-height", bar.offsetHeight + 16 + "px");
}

/* ---------- 3.5b Calendar: blocks of each plan, with longer or shorter runs ---------- */
// Takes a Monday. Returns "19 to 25 October" or "26 October to 1 November".
function fmtWeekShort(start){
  const end = addDays(start, 6), a = parseISO(start), b = parseISO(end);
  return a.getMonth() === b.getMonth() ? a.getDate() + " to " + b.getDate() + " " + MONTHS[b.getMonth()] : a.getDate() + " " + MONTHS[a.getMonth()] + " to " + b.getDate() + " " + MONTHS[b.getMonth()];
}
// Takes two dates. Returns "19 October to 29 November 2026", with the first year only when the years differ.
function fmtSpan(a, b){
  const x = parseISO(a), y = parseISO(b);
  return (x.getFullYear() === y.getFullYear() ? x.getDate() + " " + MONTHS[x.getMonth()] : fmtDate(a)) + " to " + fmtDate(b);
}
// Takes a week (from weekInfo). Returns its calendar label.
function calWeekLabel(w){
  if (w.plan === "hd") return "Week " + w.blockWeek + " of " + w.blockWeeks;
  if (w.testWeek) return "Test week";
  if (w.heavyWeek) return "Heavy week · block 3";
  return "Week " + w.weekLetter + " · block " + w.fortnight;
}
function weekRange(a, b){ return a === b ? "Week " + a : "Weeks " + a + " to " + b; }
// Takes a block. Returns what the plan's own rules do across it, as short lines.
function calBlockNotes(block){
  if (block.plan === "hd"){
    const drop = Math.round((1 - CONFIG.dropPercent) * 1000) / 10;
    const out = ["Same five sessions every week: one all-out set per exercise.",
      "Reach the top of the rep range and your next target adds weight. Below the range " + weekWord(CONFIG.belowStreakToDrop) + " running, it drops about " + drop + "%."];
    if (block.weeks >= CONFIG.longRunWeeks) out.push("Long run: if a lift stalls for two weeks, add a rest day before you cut the weight.");
    return out;
  }
  const pb = PROGRAMME.plans.pb, out = [], groups = [];
  block.list.forEach((w, i) => {
    const key = Math.floor(w.pbWeek / 2), g = groups[groups.length - 1];
    if (g && g.key === key) g.weeks.push(i + 1), g.letters.push(w.weekLetter); else groups.push({key: key, f: w.fortnight, weeks: [i + 1], letters: [w.weekLetter]});
  });
  groups.forEach((g, gi) => {
    const f = pb.fortnights[g.f - 1], range = weekRange(g.weeks[0], g.weeks[g.weeks.length - 1]);
    let line;
    if (g.f === 3){
      const parts = [];
      if (g.letters.indexOf("A") >= 0) parts.push("heavy singles with " + f.top.A.left + " left");
      if (g.letters.indexOf("B") >= 0) parts.push("test week to find your new maxes");
      line = range + ": block 3, " + listWords(parts) + ".";
    } else {
      const reps = g.letters.map(l => f.top[l].left);
      line = range + ": block " + g.f + ", top sets of " + f.top.A.reps + " reps with " + listWords(reps) + (reps.length > 1 ? " left (Week A, then B)." : " left.");
    }
    if (f.changes) line += " " + f.changes.charAt(0).toUpperCase() + f.changes.slice(1) + ".";
    if (g.letters.length === 1 && g.letters[0] === "A" && gi === groups.length - 1) line += " Week B comes first in your next Powerbuilding run.";
    out.push(line);
    if (g.letters.indexOf("B") >= 0 && g.f === 3 && gi < groups.length - 1) out.push("After test week, block 1 starts again from your new maxes.");
  });
  return out;
}
// Takes the cycle, a block and today. Returns a line when the plan returns after a long run on the other plan.
function calReturnNote(cycle, block, today){
  if (block.start <= mondayOf(today)) return "";
  for (let b = block.index - 1; b >= 0; b--){
    const len = blockLength(cycle, b);
    if (!len) continue;
    if (blockPlan(cycle, b) === block.plan) return "";
    if (len < CONFIG.longRunWeeks) return "";
    return "Back after " + len + " weeks of " + PLAN_NAMES[blockPlan(cycle, b)] + ". Targets carry on from your last " + PLAN_NAMES[block.plan] + " week; go by feel in the first session.";
  }
  return "";
}
function renderCalendar(c){
  const box = $("#calendar");
  if (!box) return;
  const show = Math.min(24, state.ui.calShow || CONFIG.calendarBlocks);
  const blocks = calendarBlocks(c.cycle, c.now.before ? 0 : c.now.blockIndex, show), nowWeek = c.now.before ? "" : c.now.weekStart;
  let html = '<div class="calendar__head"><h2 id="calendar-title" tabindex="-1">Calendar</h2>' +
    '<p class="small muted">Your plans take turns in blocks. Add weeks to stay on a plan longer. Your logs and targets carry on, and each plan keeps its own rules.</p></div><ol class="cal-blocks">';
  blocks.forEach(bl => {
    const lim = blockLimits(c.cycle, bl.index, c.today), isNow = bl.list.some(w => w.weekStart === nowWeek);
    const end = addDays(bl.start, 7 * bl.weeks - 1), step = lim.step, unitWord = step === 1 ? "a week" : step + " weeks";
    const canAdd = !lim.locked && bl.weeks + step <= lim.max, canRemove = !lim.locked && bl.weeks - step >= lim.min;
    const headId = "cal-b-" + bl.index, ret = calReturnNote(c.cycle, bl, c.today);
    let why = "";
    if (!canRemove && !lim.locked) why = lim.why || "The shortest " + PLAN_NAMES[bl.plan] + " block is " + weekWord(lim.min) + ".";
    if (!canAdd && !lim.locked) why = (why ? why + " " : "") + "The longest block is " + weekWord(lim.max) + ".";
    html += '<li class="cal-block cal-block--' + bl.plan + (isNow ? " is-current" : "") + '" aria-labelledby="' + headId + '">' +
      '<div class="cal-block__head"><span class="cal-block__bar" aria-hidden="true"></span><div>' +
      '<h3 class="cal-block__title" id="' + headId + '" tabindex="-1">' + planBadge(bl.plan) + esc(PLAN_NAMES[bl.plan]) + '<span class="cal-block__run">run ' + planRun(c.cycle, bl.index) + "</span>" + (isNow ? ' <span class="cal-tag">Now</span>' : "") + "</h3>" +
      '<p class="small muted">' + esc(fmtSpan(bl.start, end) + " · " + weekWord(bl.weeks)) + "</p></div></div>" +
      '<ol class="cal-weeks">' + bl.list.map(w => {
        const past = nowWeek && w.weekStart < nowWeek, cur = w.weekStart === nowWeek;
        return '<li class="cal-week' + (past ? " is-past" : "") + (cur ? " is-now" : "") + (w.testWeek ? " is-test" : "") + '"' + (cur ? ' aria-current="date"' : "") + '>' +
          '<span class="cal-week__date">' + esc(fmtWeekShort(w.weekStart)) + "</span>" +
          '<span class="cal-week__label">' + esc(calWeekLabel(w)) + "</span>" +
          '<span class="cal-week__state">' + (cur ? "This week" : past ? "Done" : "") + "</span></li>";
      }).join("") + "</ol>" +
      '<ul class="cal-notes small">' + calBlockNotes(bl).map(t => "<li>" + esc(t) + "</li>").join("") + (ret ? "<li>" + esc(ret) + "</li>" : "") + "</ul>" +
      (lim.locked ? "" : '<div class="button-row cal-block__actions">' +
        '<button type="button" class="button" data-cal-b="' + bl.index + '" data-cal-d="-1"' + (canRemove ? "" : " disabled") + ' aria-label="Remove ' + unitWord + " from " + esc(PLAN_NAMES[bl.plan]) + ", " + esc(fmtDate(bl.start)) + '">Remove ' + unitWord + "</button>" +
        '<button type="button" class="button" data-cal-b="' + bl.index + '" data-cal-d="1"' + (canAdd ? "" : " disabled") + ' aria-label="Add ' + unitWord + " to " + esc(PLAN_NAMES[bl.plan]) + ", " + esc(fmtDate(bl.start)) + '">Add ' + unitWord + "</button></div>" +
        (why ? '<p class="small muted">' + esc(why) + "</p>" : "")) +
      "</li>";
  });
  html += "</ol><div class=\"button-row\">" +
    (show < 24 ? '<button type="button" class="button" data-cal-more>Show more blocks</button>' : "") +
    (state.cycle && !c.now.before ? '<button type="button" class="button" data-cal-switch>Switch to ' + esc(PLAN_NAMES[otherPlan(c.plan)]) + " this week</button>" : "") +
    (hasUpcomingChanges(c.cycle, c.today) ? '<button type="button" class="button button--quiet" data-cal-reset>Set upcoming blocks to ' + weekWord(CONFIG.blockWeeks) + "</button>" : "") +
    "</div>";
  box.innerHTML = html;
}
// Takes today. Moves a plan's log to its next scheduled week when nothing is logged in it yet,
// so a schedule change never leaves an empty log sitting on a week that now belongs to the other plan.
function realignSlots(today){
  if (!state.cycle) return;
  PLAN_IDS.forEach(p => {
    const slot = slotOf(state, p);
    if (!slot) return;
    const used = Object.keys(slot.entries || {}).some(id => isAccounted(slot.entries[id])) || Object.keys(slot.missedDays || {}).length > 0;
    if (used) return;
    const target = nextWeekForPlan(state.cycle, p, today);
    if (slot.weekStart !== target) slot.weekStart = target;
  });
}
// Takes a block index and +1 or -1. Changes that block by its plan's step, then re-renders and keeps focus.
function changeBlock(b, dir){
  const c = ctx(), lim = blockLimits(c.cycle, b, c.today);
  if (lim.locked) return;
  const weeks = blockLength(c.cycle, b) + dir * lim.step;
  if (weeks < lim.min || weeks > lim.max) return;
  state.cycle = withBlockLength(c.cycle, b, weeks);
  realignSlots(c.today);
  save(); renderAll();
  const after = ctx(), sw = nextSwap(after.cycle, after.today), plan = blockPlan(state.cycle, b);
  toast(PLAN_NAMES[plan] + " block is now " + weekWord(weeks) + ". " + PLAN_NAMES[sw.plan] + " starts " + fmtDayDate(sw.date) + ".");
  const same = $('[data-cal-b="' + b + '"][data-cal-d="' + dir + '"]'), other = $('[data-cal-b="' + b + '"][data-cal-d="' + (-dir) + '"]');
  const target = same && !same.disabled ? same : other && !other.disabled ? other : $("#cal-b-" + b);
  if (target) target.focus({preventScroll: true});
}
$("#view-plan").addEventListener("click", ev => {
  const b = ev.target.closest("[data-cal-b]");
  if (b){ changeBlock(+b.dataset.calB, +b.dataset.calD); return; }
  if (ev.target.closest("[data-cal-more]")){ state.ui.calShow = Math.min(24, (state.ui.calShow || CONFIG.calendarBlocks) + CONFIG.calendarBlocks); save(); renderAll(); const m = $("[data-cal-more]"); if (m) m.focus({preventScroll: true}); return; }
  if (ev.target.closest("[data-cal-switch]")){ openSwitchDialog(); return; }
  if (ev.target.closest("[data-cal-reset]")){
    const c = ctx(); state.cycle = resetUpcomingBlocks(c.cycle, c.today); realignSlots(c.today); save(); renderAll();
    toast("Upcoming blocks are " + weekWord(CONFIG.blockWeeks) + " each again."); const t = $("#calendar-title"); if (t) t.focus({preventScroll: true});
  }
});
$("#view-train").addEventListener("click", ev => {
  if (!ev.target.closest("[data-go-calendar]")) return;
  showTab("plan");
  const t = $("#calendar-title"); if (t){ t.scrollIntoView({block: "start"}); t.focus({preventScroll: true}); }
});

/* ---------- 3.6 Plan view ---------- */
function renderPlanView(c){
  const view = state.ui.planView || c.plan;
  $("#plan-switch").innerHTML = PLAN_IDS.map(p => '<button type="button" class="button" data-plan-view="' + p + '" aria-pressed="' + (p === view) + '">' + esc(PLAN_NAMES[p]) + "</button>").join("");
  $("#plan-switch-note").textContent = view === c.plan ? "This is your plan right now. Log sets on the Today page." : "Viewing only. You start this plan again on " + fmtDayDate(nextWeekForPlan(c.cycle, view, c.today)) + ".";
  renderCalendar(c);
  renderTodayCard(c, view);
  const plan = PROGRAMME.plans[view];
  const t = view === c.plan ? todaysDay(c) : 0;
  $("#week-tiles").innerHTML = plan.days.map(d => '<a class="week-tile' + (d.n === t ? " is-today" : "") + '" href="#plan-' + view + "-day-" + d.n + '"' + (d.n === t ? ' aria-current="date"' : "") + '><span class="week-tile__n">' + d.n + "</span><span>" + esc(d.title) + (d.n === t ? "<br>Today" : "") + "</span></a>").join("") +
    '<span class="week-tile week-tile--rest"><span class="week-tile__n">6</span><span>Rest</span></span><span class="week-tile week-tile--rest"><span class="week-tile__n">7</span><span>Rest</span></span>';
  $("#plan-guide").innerHTML = view === "hd" ? hdGuideHTML() : pbGuideHTML();
  $("#plan-days").innerHTML = plan.days.map(d => view === "hd" ? hdDayTableHTML(d, view === c.plan) : pbDayTableHTML(d, view === c.plan)).join("");
}
function renderTodayCard(c, view){
  if (view !== c.plan){ $("#today-card").innerHTML = ""; return; }
  const t = todaysDay(c), s = t ? sessionOf(c, t) : null;
  let html;
  if (c.now.before) html = '<p class="up-next__kicker">Coming up</p><h2>Your plan starts ' + esc(fmtDayDate(c.now.weekStart)) + ".</h2>";
  else if (s && !s.rest){ const p = dayProgress(c.slot, s); html = '<p class="up-next__kicker">Today, ' + esc(fmtDate(c.today)) + "</p><h2>Day " + s.n + ": " + esc(s.title) + '</h2><p class="small muted">' + p.done + " of " + p.total + " done.</p>" +
    '<button type="button" class="button button--primary" data-open-day="' + s.n + '">' + (p.done ? "Continue today's session" : "Start today's session") + "</button>"; }
  else html = '<p class="up-next__kicker">Today, ' + esc(fmtDate(c.today)) + "</p><h2>Rest day. Recover well.</h2>";
  $("#today-card").innerHTML = '<section class="today-card" aria-label="Today">' + html + "</section>";
}
function guide(title, body, open){ return '<details class="guide"' + (open ? " open" : "") + "><summary>" + esc(title) + '</summary><div class="guide__body">' + body + "</div></details>"; }
function hdGuideHTML(){
  const p = PROGRAMME.plans.hd;
  return '<p class="small plan-summary">' + esc(p.summary) + "</p>" + guide("How to read this plan", p.legend.map(l => "<p>" + esc(l) + "</p>").join("") +
    "<p>" + term("warmup", "Warm-up") + ", " + term("mainset", "main set") + " and " + term("failure", "failure") + " explain themselves when tapped.</p>");
}
function pbGuideHTML(){
  const p = PROGRAMME.plans.pb;
  const rows = (head, list) => '<div class="table-scroll"><table class="finder-table"><thead><tr>' + head.map(h => '<th scope="col">' + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + list.map(r => "<tr>" + r.map(x => "<td>" + esc(x) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  return '<p class="small plan-summary">' + esc(p.summary) + "</p>" +
    guide("How hard: reps left", "<p>Every weight is set by how many more clean reps you could still do. \"2 left\" means stop with 2 in the tank.</p>" +
      rows(["Reps left", "What it looks like"], CONFIG.repsLeftScale.map(r => [String(r.left), r.short])) + "<p>A range like \"2–3 left\" means anywhere in it is fine.</p>" +
      "<p>Carries use the same numbers, judged by grip and posture:</p>" + rows(["Level", "How it feels"], CONFIG.carryEffortScale.map(r => [r.left + " " + r.name, r.short]))) +
    guide("Find your top set", "<p>You find it on the day by working up in small jumps. Within about 5 kg is good enough.</p>" +
      rows(["Lift", "From Heavy Duty", "First guess"], Object.keys(p.mainLifts).map(k => [p.mainLifts[k].name, p.mainLifts[k].hdNote, p.mainLifts[k].guessNote])) +
      rows(["Set", "Weight", "Reps", "Rest"], p.topSetLadder.map(s => [String(s.set), s.weight, s.reps, s.rest])) +
      rows(["Reps left on set 5", "What it means", "What to do"], p.topSetOutcome.map(o => [o.left, o.means, o.action])) +
      "<p>Maximum three tries. Then use the best one and fix it next session.</p><p>" + esc(p.backoffCheckNote) + "</p>" +
      rows(["Reps on the last back-off", "Your top set was", "Next session"], p.backoffCheck.map(o => [o.reps, o.topSet, o.next]))) +
    guide(p.warmup.title, "<ol>" + p.warmup.steps.map(s => "<li>" + esc(s) + "</li>").join("") + "</ol>") +
    guide("How the weights go up", rows(["Block", "Top set, Week A", "Top set, Week B", "Back-offs", "Other changes"], p.fortnights.map(f => [String(f.n), f.top.A.reps + " reps, " + f.top.A.left + " left", f.top.B === "test" ? "Test week" : f.top.B.reps + " reps, " + f.top.B.left + " left", f.backoff.text, f.changes])) +
      "<p>Deadlift always does 2 back-off sets, not 3. " + esc(p.secondaryPattern.text) + "</p>" + rows(["Reps left on the top set", "Next session"], p.topSetRules.map(r => [r.when, r.next])) +
      "<p>" + esc(p.accessoryRule) + "</p><p>" + esc(p.nordicRule.text) + "</p><p>" + esc(p.estimatedMax.text) + "</p>") +
    guide("Test week", "<ol>" + p.testWeek.steps.map(s => "<li>" + esc(s) + "</li>").join("") + "</ol>") +
    guide("Bad days", "<p>Before training, count how many apply: " + esc(p.badDay.questions.join(" · ")) + ".</p>" + rows(["How many apply", "What to do"], p.badDay.rules.map(r => [r.count, r.do])) +
      "<ul>" + p.badDay.extra.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>");
}
function hdDayTableHTML(d, current){
  return '<section class="plan-day" id="plan-hd-day-' + d.n + '" aria-labelledby="plan-hd-day-' + d.n + '-title"><div class="plan-day__head"><h2 id="plan-hd-day-' + d.n + '-title">Day ' + d.n + ": " + esc(d.title) + "</h2>" +
    (current ? '<button type="button" class="button button--primary" data-open-day="' + d.n + '">Open in Train</button>' : "") + "</div>" +
    d.groups.map(g => (g.title ? "<h3>" + esc(g.title) + "</h3>" : "") + '<div class="table-scroll" tabindex="0" role="region" aria-label="Day ' + d.n + " " + esc(g.title || d.title) + '"><table class="plan-table"><thead><tr><th scope="col">Exercise</th><th scope="col">Equipment</th><th scope="col">Sets</th><th scope="col">Reps @ % of main-set weight</th><th scope="col">Rest</th><th scope="col">Notes</th></tr></thead><tbody>' +
      g.items.map(it => "<tr><td><strong>" + esc(it.name) + "</strong>" + (it.optional ? ' <span class="exercise__tag">Optional</span>' : "") + "</td><td>" + esc(it.equip) + "</td><td>" + esc(plainSets(it.sets)) + "</td><td>" + esc(it.reps) + "</td><td>" + esc(it.rest) + "</td><td>" + esc(it.notes) + "</td></tr>").join("") +
      "</tbody></table></div>").join("") + "</section>";
}
function pbDayTableHTML(d, current){
  const row = (name, it, sets, left, rest, notes) => "<tr><td><strong>" + esc(name) + "</strong></td><td>" + esc(it.equip) + "</td><td>" + esc(sets) + "</td><td>" + esc(left) + "</td><td>" + esc(rest) + "</td><td>" + esc(notes) + "</td></tr>";
  return '<section class="plan-day" id="plan-pb-day-' + d.n + '" aria-labelledby="plan-pb-day-' + d.n + '-title"><div class="plan-day__head"><h2 id="plan-pb-day-' + d.n + '-title">Day ' + d.n + ": " + esc(d.title) + " (" + esc(d.time) + ")</h2>" +
    (current ? '<button type="button" class="button button--primary" data-open-day="' + d.n + '">Open in Train</button>' : "") + "</div>" +
    '<p class="small">Roll: ' + esc(d.roll) + ". Warm-up moves: " + esc(d.moves.join(", ").toLowerCase()) + ".</p>" + (d.intro ? '<p class="small">' + esc(d.intro) + "</p>" : "") +
    '<div class="table-scroll" tabindex="0" role="region" aria-label="Day ' + d.n + ' exercises"><table class="plan-table"><thead><tr><th scope="col">Exercise</th><th scope="col">Equipment</th><th scope="col">Sets × reps</th><th scope="col">Reps left</th><th scope="col">Rest</th><th scope="col">Notes and swap</th></tr></thead><tbody>' +
    d.items.map(it => {
      const name = (it.pair ? it.pair + " " : "") + it.name, swap = it.swap ? (it.notes ? " " : "") + "Swap: " + it.swap : "";
      if (it.kind === "main") return row(name + ": top set", it, it.top.sets, it.top.left, it.top.rest, it.top.notes + swap) + row(name + ": back-offs", it, it.backoff.sets, it.backoff.left, it.backoff.rest, it.backoff.notes);
      return row(name, it, it.sets, it.left, it.rest, it.notes + swap + (it.swapNote ? " " + it.swapNote : ""));
    }).join("") + "</tbody></table></div></section>";
}

/* ---------- 3.6b History and progress ---------- */
function histSetText(meta, s, unit){
  const log = meta ? meta.item.log : "lift";
  if (log === "check") return "done";
  if (log === "time") return s.reps + " min";
  if (log === "rounds") return s.reps + " rounds";
  if (log === "carry") return (Number(s.kg) > 0 ? fmtLoad(s.kg, unit) + " for " : "") + s.reps + " m";
  return (Number(s.kg) > 0 ? fmtLoad(s.kg, unit) + " × " : "") + setText(s) + (Number(s.kg) > 0 ? "" : " reps");
}
function histWeeks(c, plan){
  const slot = slotOf(state, plan);
  if (!slot) return [];
  return historyWeeks(slot, plan, sessionsFor(plan, slot, c.cycle), archiveLoad(), new Date().toISOString());
}
// Takes a plan id. Returns its short, colour-coded badge. The letters carry the meaning; colour only helps.
const PLAN_CODES = {hd: "HD", pb: "PB"};
function planBadge(plan){ return '<span class="plan-badge plan-badge--' + plan + '" title="' + esc(PLAN_NAMES[plan]) + '">' + PLAN_CODES[plan] + "</span>"; }
// Takes a Monday and a plan id. Returns {tag, short, run, code, sub}: "Week 3 of 4", "Week 3", which run of
// the plan the block is, "HD run 2", and the powerbuilding programme stage. Day 1 of one week is then
// never confused with Day 1 of the next, and runs of the same plan can be told apart.
function histWeekTag(weekStart, plan){
  const none = {tag: "", short: "", run: 0, code: "", sub: ""};
  if (!state.cycle) return none;
  const cy = cycleOf(), w = weekInfo(cy, weekStart);
  if (w.before || w.plan !== plan) return none;
  const run = planRun(cy, w.blockIndex);
  return {tag: "Week " + w.blockWeek + " of " + w.blockWeeks, short: "Week " + w.blockWeek, run: run, code: PLAN_CODES[plan] + " run " + run, sub: plan === "pb" ? calWeekLabel(w) : ""};
}
function renderHistory(c){
  const plan = state.ui.histPlan === "hd" || state.ui.histPlan === "pb" ? state.ui.histPlan : c.plan;
  const view = state.ui.histView === "log" ? "log" : "progress";
  const slot = slotOf(state, plan), weeks = histWeeks(c, plan);
  const seg = p => '<button type="button" class="button" data-hist-plan="' + p + '" aria-pressed="' + (p === plan) + '">' + esc(PLAN_NAMES[p]) + "</button>";
  const vseg = (v, t) => '<button type="button" class="button" data-hist-view="' + v + '" aria-pressed="' + (v === view) + '">' + t + "</button>";
  let html = '<div class="hist-controls"><div class="segmented" role="group" aria-label="Plan">' + seg("hd") + seg("pb") + "</div>" +
    '<div class="segmented" role="group" aria-label="Show">' + vseg("progress", "Progress") + vseg("log", "Week log") + "</div></div>";
  if (!weeks.length){
    $("#hist-body").innerHTML = html + '<div class="empty-state"><p><strong>Nothing logged on ' + esc(PLAN_NAMES[plan]) + " yet.</strong></p><p class=\"small muted\">Every week you log shows here. The app keeps the last " + CONFIG.archiveWeeks + " weeks of each plan on this phone.</p></div>";
    return;
  }
  if (view === "progress"){ $("#hist-body").innerHTML = html + progressHTML(weeks, plan); return; }
  const ws = weeks.some(w => w.weekStart === state.ui.histWeek) ? state.ui.histWeek : weeks[0].weekStart;
  const week = weeks.filter(w => w.weekStart === ws)[0], tagOf = w => histWeekTag(w.weekStart, plan);
  // Short enough to fit a phone-width picker: "Week B of 2 · 23 to 29 November · last week"
  const thisYear = parseISO(c.today).getFullYear();
  const label = w => { const t = tagOf(w), y = parseISO(w.weekStart).getFullYear();
    const d1 = parseISO(w.weekStart), d2 = parseISO(addDays(w.weekStart, 6)), mon = d => MONTHS[d.getMonth()].slice(0, 3);
    const span = d1.getMonth() === d2.getMonth() ? d1.getDate() + "–" + d2.getDate() + " " + mon(d2) : d1.getDate() + " " + mon(d1) + "–" + d2.getDate() + " " + mon(d2);
    return (t.tag ? t.code + " · " + t.short + " · " : "") + span + (y !== thisYear ? " " + y : "") + (w.source === "this" ? " · now" : ""); };
  const when = w => w.source === "this" ? "This week" : slot.lastWeek && slot.lastWeek.weekStart === w.weekStart ? "Last week" : "";
  html += '<div class="field"><label class="field__label" for="hist-week">Week</label><select class="select-input" id="hist-week">' +
    weeks.map(w => '<option value="' + w.weekStart + '"' + (w.weekStart === ws ? " selected" : "") + ">" + esc(label(w)) + "</option>").join("") + "</select></div>";
  const tag = tagOf(week);
  if (tag.tag) html += '<p class="hist-weekline">' + planBadge(plan) + '<span><strong>' + esc(PLAN_NAMES[plan] + ", run " + tag.run + " · " + tag.tag) + "</strong>" +
    '<span class="small muted"> · ' + esc(fmtRange(week.weekStart)) + (when(week) ? " (" + when(week).toLowerCase() + ")" : "") + (tag.sub ? ". Programme: " + esc(tag.sub) : "") + "</span></span></p>";
  const nItems = week.view.reduce((a, dd) => a + dd.items.filter(it => it.sets.length || (it.swap && it.swap.sets.length)).length, 0);
  const nSets = week.view.reduce((a, dd) => a + dd.items.reduce((b, it) => b + it.sets.filter(x => x.working).length + (it.swap ? it.swap.sets.length : 0), 0), 0);
  const tile = (n, lab, val, sub) => '<div class="hist-tile"><span class="metric-label metric-' + n + '">' + lab + '</span><span class="metric-value metric-' + n + '">' + val + '</span><span class="small muted">' + sub + "</span></div>";
  html += '<div class="hist-tiles">' + tile(2, "Days", week.view.length, "trained") + tile(3, "Exercises", nItems, "logged") + tile(1, "Sets", nSets, "working") + "</div>";
  html += '<p class="small muted">Tap a day to see its sets. Working sets are in bold.</p>';
  html += week.view.map(d => {
    const n = d.items.filter(it => it.sets.length || (it.swap && it.swap.sets.length)).length + d.extras.length;
    return '<details class="hist-day"><summary class="hist-day__summary"><span class="hist-day__title">' + planBadge(plan) + " Day " + d.day + (tag.short ? " · " + esc(tag.short) : "") + ": " + esc(d.title) + '</span><span class="small muted">' + n + (n === 1 ? " exercise" : " exercises") + "</span></summary><ul class=\"hist-list\">" +
    d.items.map(it => {
      const meta = EXERCISES[it.id];
      const sets = it.sets.map(x => x.working ? "<strong>" + esc(histSetText(meta, x.set, it.unit)) + "</strong>" : esc(histSetText(meta, x.set, it.unit))).join(", ");
      let line = '<li><span class="hist-name">' + esc(it.name) + (it.madeUp ? ' <span class="exercise__tag">Made up</span>' : "") + "</span>";
      if (it.missed) line += '<span class="hist-sets muted">Skipped</span>';
      if (sets) line += '<span class="hist-sets">' + sets + "</span>";
      if (it.swap) line += '<span class="hist-sets">Swapped for ' + esc(it.swap.name) + (it.swap.sets.length ? ": <strong>" + it.swap.sets.map(z => esc(swapSetText(z, it.swap.unit, it.swap.measure))).join(", ") + "</strong>" : "") + "</span>";
      return line + "</li>";
    }).join("") +
    d.extras.map(x => '<li><span class="hist-name">' + esc(x.name || "Extra") + ' <span class="exercise__tag">Extra</span></span><span class="hist-sets">' + x.sets.map(z => esc(histSetText(null, z, x.unit))).join(", ") + "</span></li>").join("") +
    "</ul></details>"; }).join("");
  html += '<p class="small muted">This phone keeps your last ' + CONFIG.archiveWeeks + " finished weeks of each plan.</p>";
  $("#hist-body").innerHTML = html;
}
// Line chart of the best working set per week (planned exercise only; swaps stay in the table).
// Plots weight, or reps (metres, minutes) when no weight was logged. Only the latest unit is drawn.
// Takes points [{weekStart, v}], {cls, word, area, axisDates, title}. Returns one small line chart (SVG).
// Every chart in a stack shares the same x positions, so a picked week lines up across them.
const CHART = {W: 320, padL: 44, padR: 12, padT: 22, padB: 8, dateRow: 20, plotH: 84};
function lineChartSVG(pts, o){
  const H = CHART.padT + CHART.plotH + CHART.padB + (o.axisDates ? CHART.dateRow : 0);
  const vs = pts.map(p => p.v), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), span = hi - lo || Math.max(1, hi * 0.1);
  const y0 = lo - span * 0.15, y1 = hi + span * 0.15, base = CHART.padT + CHART.plotH;
  const X = k => pts.length === 1 ? (CHART.padL + CHART.W - CHART.padR) / 2 : CHART.padL + k / (pts.length - 1) * (CHART.W - CHART.padL - CHART.padR);
  const Y = v => CHART.padT + (1 - (v - y0) / (y1 - y0)) * CHART.plotH;
  const xy = pts.map((p, k) => [X(k), Y(p.v)]), every = Math.ceil(pts.length / 6);
  const short = iso => { const d = parseISO(iso); return d ? d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) : ""; };
  const label = o.title + ": " + pts.map(p => short(p.weekStart) + " " + fmtNum(p.v)).join(", ");
  return '<svg class="chart ' + o.cls + '" viewBox="0 0 ' + CHART.W + " " + H + '" role="img" aria-label="' + esc(label) + '">' +
    '<text class="chart__title" x="0" y="13">' + esc(o.title) + "</text>" +
    [lo, hi].filter((v, i, a) => a.indexOf(v) === i).map(v => '<line class="chart__grid" x1="' + CHART.padL + '" x2="' + (CHART.W - CHART.padR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="chart__label" x="' + (CHART.padL - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmtNum(v)) + "</text>").join("") +
    (o.area && xy.length > 1 ? '<polygon class="chart__area" points="' + xy.map(q => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ") + " " + xy[xy.length - 1][0].toFixed(1) + "," + base + " " + xy[0][0].toFixed(1) + "," + base + '"/>' : "") +
    (xy.length > 1 ? '<polyline class="chart__line" points="' + xy.map(q => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ") + '"/>' : "") +
    '<line class="chart__guide" x1="0" x2="0" y1="' + CHART.padT + '" y2="' + base + '" visibility="hidden"/>' +
    xy.map((q, k) => '<circle class="chart__dot" data-k="' + k + '" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="4.5"/>').join("") +
    (o.axisDates ? pts.map((p, k) => (k % every === 0 || k === pts.length - 1) ? '<text class="chart__label" x="' + X(k).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="' + (pts.length > 1 && k === pts.length - 1 ? "end" : k === 0 && pts.length > 1 ? "start" : "middle") + '">' + esc(short(p.weekStart)) + "</text>" : "").join("") : "") +
    "</svg>";
}
// Takes the planned rows for one exercise and its meta. Returns the progress charts:
// with weights, a strength headline plus three stacked lines (estimated max, weight, reps) on a shared week axis;
// without weights, one line of reps, metres or minutes.
function progressChartsHTML(rows, meta){
  if (!rows.length) return "";
  const unit = rows[rows.length - 1].unit, pts = rows.filter(r => r.unit === unit);
  const loadWord = unit === "plates" ? "plates" : "kg";
  const byKg = pts.some(r => r.kg > 0) && meta.item.log !== "carry" && meta.item.log !== "time";
  let charts, head = "";
  if (byKg){
    const strong = pts.filter(r => r.est > 0), first = strong[0], last = strong[strong.length - 1];
    if (last){
      const diff = Math.round((last.est - first.est) * 10) / 10, dir = strong.length < 2 ? "" : diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      head = '<div class="strength-head"><p class="strength-head__label">Estimated max</p><p class="strength-head__value">' + esc(fmtLoad(last.est, unit)) + "</p>" +
        (dir ? '<p class="small"><span class="trend' + (dir === "up" ? " trend--up" : "") + '"><span aria-hidden="true">' + (dir === "up" ? "▲" : dir === "down" ? "▼" : "•") + "</span>" +
          esc(dir === "flat" ? "Same" : (diff > 0 ? "+" : "−") + fmtLoad(Math.abs(diff), unit)) + "</span> since " + esc(fmtDate(first.weekStart)) + "</p>" : "") +
        pbOnTrackHTML(pts, meta) +
        '<p class="small muted">Weight, reps and reps left combined into one number (Epley formula), so adding reps counts as getting stronger. Less exact above 12 reps.</p></div>';
    }
    charts = [
      {cls: "chart--m1", area: true, title: "Strength: estimated max (" + loadWord + ")", data: pts.map(r => ({weekStart: r.weekStart, v: r.est || r.kg}))},
      {cls: "chart--m3", title: "Weight: heaviest set (" + loadWord + ")", data: pts.map(r => ({weekStart: r.weekStart, v: r.kg}))},
      {cls: "chart--m2", title: "Reps: on that set", data: pts.map(r => ({weekStart: r.weekStart, v: r.reps}))}];
  } else {
    const word = meta.item.log === "carry" ? "metres" : meta.item.log === "time" ? "minutes" : "reps";
    charts = [{cls: "chart--m1", area: true, title: "Best set (" + word + ")", data: pts.map(r => ({weekStart: r.weekStart, v: r.reps}))}];
  }
  const readouts = pts.map(r => fmtDate(r.weekStart) + ": " + histSetText(meta, {reps: r.reps, kg: r.kg}, r.unit) + (byKg && r.est ? ", estimated max " + fmtLoad(r.est, r.unit) : ""));
  return head + '<div class="chart-stack" tabindex="0" role="group" aria-label="Progress charts. Use the left and right arrow keys to read each week." data-readouts="' + esc(JSON.stringify(readouts)) + '" data-n="' + pts.length + '">' +
    charts.map((c, i) => lineChartSVG(c.data, {cls: c.cls, area: c.area, title: c.title, axisDates: i === charts.length - 1})).join("") +
    '<p class="chart-readout small" aria-live="polite">' + esc(readouts[readouts.length - 1]) + "</p></div>";
}
// Powerbuilding main lifts. Takes the planned rows and the meta. Returns the Week B to Week B check, or "".
// Rules: the programme compares harder (Week B) weeks: a rise of 2 to 5% each time is on track. Below that,
//   hold the weights where technique stays the same rather than testing more often. No rise across
//   CONFIG.pbCoaching.flatChecks checks in a row → say so plainly.
function pbOnTrackHTML(pts, meta){
  if (!meta || meta.plan !== "pb" || !meta.item.lift || !state.cycle) return "";
  const cy = cycleOf(), b = pts.filter(r => r.est > 0).filter(r => { const w = weekInfo(cy, r.weekStart); return !w.before && w.plan === "pb" && w.weekLetter === "B" && !w.testWeek; });
  if (b.length < 2) return '<p class="small muted">Week B check: compare after your next Week B. A rise of ' + CONFIG.pbCoaching.onTrackPct[0] + " to " + CONFIG.pbCoaching.onTrackPct[1] + "% is on track.</p>";
  const last = b[b.length - 1], prev = b[b.length - 2], pct = Math.round((last.est / prev.est - 1) * 1000) / 10;
  const [lo, hi] = CONFIG.pbCoaching.onTrackPct, n = CONFIG.pbCoaching.flatChecks;
  const tail = b.slice(-n), flat = tail.length === n && tail.every((r, k) => k === 0 || r.est <= tail[k - 1].est);
  let msg;
  if (flat) msg = "No rise across your last " + n + " Week B checks. Keep the weights where your technique looks the same every rep, and let the next block do the work. Testing more often won't help.";
  else if (pct < lo) msg = "Below the " + lo + " to " + hi + "% aim. Hold the weights, keep the reps left honest and your technique the same.";
  else if (pct > hi) msg = "Above the " + lo + " to " + hi + "% aim. Good. Keep your reps left honest so the next targets stay right.";
  else msg = "On track: the aim is " + lo + " to " + hi + "%.";
  return '<p class="small"><strong>Week B check: ' + (pct > 0 ? "+" : pct < 0 ? "−" : "") + Math.abs(pct) + "%</strong> since " + esc(fmtDate(prev.weekStart)) + ". " + esc(msg) + "</p>";
}
// Takes a chart stack and a week index. Shows that week's guide line and values in every chart.
function pickChartWeek(stack, k){
  const n = +stack.dataset.n; k = Math.max(0, Math.min(n - 1, k));
  stack.dataset.pick = k;
  $$("svg", stack).forEach(svg => {
    const dot = svg.querySelector('.chart__dot[data-k="' + k + '"]'), g = svg.querySelector(".chart__guide");
    $$(".chart__dot", svg).forEach(d => d.classList.toggle("is-picked", d === dot));
    if (g && dot){ g.setAttribute("x1", dot.getAttribute("cx")); g.setAttribute("x2", dot.getAttribute("cx")); g.setAttribute("visibility", "visible"); }
  });
  const out = stack.querySelector(".chart-readout"), list = JSON.parse(stack.dataset.readouts || "[]");
  if (out && list[k]) out.textContent = list[k];
}
// Pointer: the nearest week to the finger or mouse, measured in the shared x positions
function chartWeekAt(stack, clientX){
  const svg = stack.querySelector("svg"), r = svg.getBoundingClientRect(), n = +stack.dataset.n;
  if (n < 2) return 0;
  const x = (clientX - r.left) / r.width * CHART.W;
  return Math.round((x - CHART.padL) / (CHART.W - CHART.padL - CHART.padR) * (n - 1));
}
$("#view-hist").addEventListener("pointermove", ev => { const s = ev.target.closest(".chart-stack"); if (s && ev.target.closest("svg")) pickChartWeek(s, chartWeekAt(s, ev.clientX)); });
$("#view-hist").addEventListener("pointerdown", ev => { const s = ev.target.closest(".chart-stack"); if (s && ev.target.closest("svg")) pickChartWeek(s, chartWeekAt(s, ev.clientX)); });
$("#view-hist").addEventListener("keydown", ev => {
  const s = ev.target.closest(".chart-stack"); if (!s || ev.target !== s) return;
  const n = +s.dataset.n, k = s.dataset.pick != null ? +s.dataset.pick : n - 1;
  const to = {ArrowLeft: k - 1, ArrowRight: k + 1, Home: 0, End: n - 1}[ev.key];
  if (to == null) return;
  ev.preventDefault(); pickChartWeek(s, to);
});
function progressHTML(weeks, plan){
  const ids = [], names = {};
  weeks.forEach(w => w.view.forEach(d => d.items.forEach(it => {
    if (ids.indexOf(it.id) < 0 && (it.sets.some(x => x.working) || (it.swap && it.swap.sets.length))){ ids.push(it.id); names[it.id] = "Day " + d.day + ": " + it.name; }
  })));
  ids.sort((a, b) => Object.keys(EXERCISES).indexOf(a) - Object.keys(EXERCISES).indexOf(b));
  let html = '<section class="hist-progress" aria-label="Progress per exercise">';
  if (!ids.length) return html + '<p class="small muted">Log a working set to see your progress here.</p></section>';
  const id = ids.indexOf(state.ui.histEx) >= 0 ? state.ui.histEx : ids[0];
  html += '<div class="field"><label class="field__label" for="hist-ex">Exercise</label><select class="select-input" id="hist-ex">' +
    ids.map(x => '<option value="' + x + '"' + (x === id ? " selected" : "") + ">" + esc(names[x]) + "</option>").join("") + "</select></div>";
  const rows = exerciseProgress(weeks, id), prev = {};
  if (rows.length < 2) html += '<p class="small muted">One week so far. Next week shows the change.</p>';
  html += progressChartsHTML(rows.filter(r => r.kind === "planned"), EXERCISES[id]);
  html += '<details class="hist-weeks"><summary>Week by week (' + rows.length + ")</summary>" +
    '<table class="hist-table"><caption class="visually-hidden">Best working set per week</caption><thead><tr><th scope="col">Week</th><th scope="col">Best set</th><th scope="col">Change</th></tr></thead><tbody>' +
    rows.slice().reverse().map((r, k, all) => {
      // change against the previous week of the same exercise (swaps compare only with the same swap)
      const older = all.slice(k + 1).filter(o => o.kind === r.kind && keyOf(o.name) === keyOf(r.name) && o.unit === r.unit)[0];
      let ch = "–";
      if (older){
        const dk = Math.round((r.kg - older.kg) * 100) / 100, dr = r.reps - older.reps;
        ch = dk ? (dk > 0 ? "+" : "−") + fmtLoad(Math.abs(dk), r.unit) : dr ? (dr > 0 ? "+" : "−") + Math.abs(dr) + (r.measure === "time" ? " s" : r.measure === "distance" || (r.kind !== "swap" && EXERCISES[id].item.log === "carry") ? " m" : Math.abs(dr) === 1 ? " rep" : " reps") : "Same";
      }
      const best = r.kind === "swap" ? swapSetText({reps: r.reps, kg: r.kg}, r.unit, r.measure) : histSetText(EXERCISES[id], {reps: r.reps, kg: r.kg}, r.unit);
      // Trend pill: arrow plus words, so the direction never relies on colour alone
      const dir = !older ? "" : ch.charAt(0) === "+" ? "up" : ch.charAt(0) === "−" ? "down" : "flat";
      const pill = dir ? '<span class="trend' + (dir === "up" ? " trend--up" : "") + '"><span aria-hidden="true">' + (dir === "up" ? "▲" : dir === "down" ? "▼" : "•") + "</span>" + esc(ch) + "</span>" : esc(ch);
      return "<tr" + (r.kind === "swap" ? ' class="is-swap"' : "") + "><td>" + esc(fmtDate(r.weekStart)) + (histWeekTag(r.weekStart, plan).tag ? '<br><span class="small muted">' + esc(histWeekTag(r.weekStart, plan).code + " · " + histWeekTag(r.weekStart, plan).short) + "</span>" : "") + "</td><td>" + (r.kind === "swap" ? '<span class="small">Swap: ' + esc(r.name) + "</span><br>" : "") + esc(best) + (r.est ? '<br><span class="small muted hist-est">Est. max ' + esc(fmtLoad(r.est, r.unit)) + "</span>" : "") + "</td><td>" + pill + "</td></tr>";
    }).join("") + "</tbody></table></details></section>";
  return html;
}
$("#view-hist").addEventListener("click", ev => {
  const v = ev.target.closest("[data-hist-view]");
  if (v){ state.ui.histView = v.dataset.histView; save(); renderAll(); const f = $('[data-hist-view="' + state.ui.histView + '"]'); if (f) f.focus({preventScroll: true}); return; }
  const p = ev.target.closest("[data-hist-plan]"); if (!p) return;
  state.ui.histPlan = p.dataset.histPlan; state.ui.histWeek = null; state.ui.histEx = null; save(); renderAll();
  const f = $('[data-hist-plan="' + state.ui.histPlan + '"]'); if (f) f.focus();
});
$("#view-hist").addEventListener("change", ev => {
  if (ev.target.id === "hist-week") state.ui.histWeek = ev.target.value;
  else if (ev.target.id === "hist-ex") state.ui.histEx = ev.target.value;
  else return;
  // Keep the picker where it was on screen, so changing exercise or week never jumps the page
  const id = ev.target.id, top = ev.target.getBoundingClientRect().top;
  save(); renderAll();
  const f = $("#" + id);
  if (f){ window.scrollBy(0, f.getBoundingClientRect().top - top); f.focus({preventScroll: true}); }
});

/* ---------- 3.7 Render everything ---------- */
// Replacing a focused field fires blur and change events mid-render; this guard stops a second render
// starting inside the first (the outer render already draws the latest state).
let rendering = false;
function renderAll(){
  if (rendering) return;
  rendering = true;
  try { renderAllInner(); } finally { rendering = false; }
}
function renderAllInner(){
  if (state.cycle){
    const w = weekInfo(cycleOf(), todayISO());
    if (!w.before){ const sl = slotOf(state, w.plan); if (sl) alignEmptySlot(sl, w.weekStart); }
  }
  const c = ctx();
  renderHeader(c);
  renderStorageWarning();
  renderSetup();
  renderHelp();
  const ready = !!state.cycle;
  $("#view-train").hidden = !ready || state.ui.tab !== "train";
  $("#view-plan").hidden = !ready || state.ui.tab !== "plan";
  $("#view-hist").hidden = !ready || state.ui.tab !== "history";
  $$(".bottom-nav__button").forEach(b => { if (b.dataset.tab === state.ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (ready && state.ui.tab === "train") renderTrain(c);
  if (ready && state.ui.tab === "plan") renderPlanView(c);
  if (ready && state.ui.tab === "history") renderHistory(c);
  renderHazard(c);
  renderFab(c);
  updateToTop();
  syncExerciseSheet();
  if (sheetOpen) renderMakeupSheet();
}
// The open exercise shows as a sheet over Today: dim the page behind it and stop it scrolling
function syncExerciseSheet(){
  const open = state.ui.tab === "train" && !!state.cycle && ((!!state.ui.openEx && !!$("#ex-" + state.ui.openEx)) || (!!state.ui.openExtra && !!$("#extra-" + state.ui.openExtra)));
  $("#sheet-scrim").hidden = !open;
  document.body.classList.toggle("has-sheet", open);
}
function closeExerciseSheet(){
  if (state.ui.openExtra){ const x = state.ui.openExtra; state.ui.openExtra = null; save(); renderAll(); const s = $("#extra-" + x + " .exercise__summary"); if (s) s.focus({preventScroll: true}); return; }
  const id = state.ui.openEx; if (!id) return;
  state.ui.openEx = null; save(); renderAll();
  const s = $("#ex-" + id + " .exercise__summary"); if (s) s.focus({preventScroll: true});
}
// Redraw one exercise, keeping focus where it was
function rerenderExercise(id, focusSel){
  if (rendering) return;
  const c = ctx(), item = itemOf(c, id), old = $("#ex-" + id);
  if (!item || !old) { renderAll(); return; }
  rendering = true;
  try { old.outerHTML = exerciseHTML(c, item); } finally { rendering = false; }
  if (focusSel){ const f = $("#ex-" + id + " " + focusSel); if (f) f.focus(); }
  const day = sessionOf(c, state.ui.day);
  if (day){ renderProgress(c, day); renderUpNext(c, day); renderDayTabs(c); renderWeekStatus(c); renderSwapsLog(c, day); }
  renderHazard(c); renderFab(c); syncExerciseSheet();
  if (sheetOpen) renderMakeupNote();
}

/* ---------- 3.8 Toast, terms, dialogs ---------- */
let toastTimer = null;
function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.classList.add("is-shown");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("is-shown"), CONFIG.toastMs);
}
let lastFocus = null;
function openDialog(d){
  lastFocus = document.activeElement;
  if (typeof d.showModal === "function") d.showModal();
  else { d.setAttribute("open", ""); d.classList.add("dialog--fallback"); const f = $("button, input, select, textarea", d); if (f) f.focus(); }
}
function closeDialog(d){
  if (!d.open && !d.hasAttribute("open")) return;
  if (typeof d.close === "function" && d.open) d.close(); else { d.removeAttribute("open"); d.classList.remove("dialog--fallback"); d.dispatchEvent(new Event("close")); }
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
}
$$("dialog").forEach(d => d.addEventListener("click", ev => { if (ev.target.closest("[data-close]") || ev.target === d) closeDialog(d); }));
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-term]");
  if (!t) return;
  ev.preventDefault(); ev.stopPropagation();
  $("#term-box-text").innerHTML = "<strong>" + esc(t.textContent) + ":</strong> " + esc(CONFIG.glossary[t.dataset.term] || "");
  $("#term-box").hidden = false;
  $("#term-box-close").focus();
}, true);
$("#term-box-close").addEventListener("click", () => { $("#term-box").hidden = true; });

/* ---------- 3.9 Setup, help, settings ---------- */
function readStart(inputSel, noteSel, errSel){
  const r = checkStartDate($(inputSel).value);
  $(noteSel).textContent = r.note; $(errSel).textContent = r.error;
  return r;
}
$("#setup-start").addEventListener("change", () => readStart("#setup-start", "#setup-start-note", "#setup-start-error"));
$("#button-setup-save").addEventListener("click", () => {
  const r = readStart("#setup-start", "#setup-start-note", "#setup-start-error");
  if (r.error){ $("#setup-start").focus(); return; }
  const first = ($('input[name="setup-first"]:checked') || {}).value || CONFIG.defaultFirstPlan;
  state.cycle = {start: r.value, first: first};
  ensurePbSlot(state, todayISO());
  openToday();
  save(); renderAll();
  toast("Plans set up. Today's session is ready.");
});
$("#button-help").addEventListener("click", () => { state.ui.helpSeen = false; save(); renderAll(); $("#help-title").scrollIntoView({block: "center"}); $("#button-help-close").focus(); });
$("#button-help-close").addEventListener("click", () => { state.ui.helpSeen = true; save(); renderAll(); });
$("#button-settings").addEventListener("click", () => {
  const cy = cycleOf(), c = ctx();
  $("#settings-start").value = cy.start; $("#settings-start-note").textContent = ""; $("#settings-start-error").textContent = "";
  $$('input[name="settings-first"]').forEach(i => { i.checked = i.value === cy.first; });
  $("#settings-schedule-now").textContent = state.cycle ? "Now: " + PLAN_NAMES[c.plan] + ", " + weekLabel(c.plan, c.now) + "." : "Not set up yet.";
  $("#button-switch-now").textContent = "Switch to " + PLAN_NAMES[otherPlan(c.plan)] + " now";
  $("#button-switch-now").disabled = !state.cycle;
  openDialog($("#dialog-settings"));
});
$("#settings-start").addEventListener("change", () => readStart("#settings-start", "#settings-start-note", "#settings-start-error"));
$("#button-schedule-save").addEventListener("click", () => {
  const r = readStart("#settings-start", "#settings-start-note", "#settings-start-error");
  if (r.error) return;
  const first = ($('input[name="settings-first"]:checked') || {}).value || CONFIG.defaultFirstPlan, old = state.cycle;
  const same = old && old.start === r.value && old.first === first;
  state.cycle = {start: r.value, first: first, lengths: same && Array.isArray(old.lengths) ? old.lengths : []};
  ensurePbSlot(state, todayISO());
  realignSlots(todayISO());
  save(); renderAll();
  toast(same ? "Schedule saved." : "Schedule saved. Blocks are back to " + weekWord(CONFIG.blockWeeks) + " each.");
});
$("#button-switch-now").addEventListener("click", () => openSwitchDialog());
function openSwitchDialog(){
  const c = ctx();
  $("#dialog-switch-text").textContent = "You'll start " + PLAN_NAMES[otherPlan(c.plan)] + " this week, " + fmtRange(c.now.weekStart) + ". Your logged sets stay safe in each plan.";
  closeDialog($("#dialog-settings"));
  openDialog($("#dialog-switch"));
}
$("#button-switch-confirm").addEventListener("click", () => {
  const c = ctx(), to = otherPlan(c.plan);
  state.cycle = switchCycleNow(c.cycle, c.today);
  ensurePbSlot(state, c.today);
  realignSlots(c.today);
  closeDialog($("#dialog-switch"));
  openToday(); save(); renderAll();
  toast("Switched to " + PLAN_NAMES[to] + ".");
});
// Themes, colour mode, layout
// Theme preferences, kept apart from training data. Older saves held them in state.ui: move them once.
const themePrefs = themeLoad() || {palette: "pulse", mode: state.ui.mode || "system", contrast: "auto", v: 3};
// Version 3 themes (22 October 2026): five multi-colour themes replace the nine single-colour ones.
// Each old theme moves to the closest new one, once.
if (!themePrefs.v || themePrefs.v < 3){ themePrefs.palette = themeMove(themePrefs.palette); themePrefs.v = 3; }
delete state.ui.theme; delete state.ui.mode;
themeSave(themePrefs);
// Takes an old theme id. Returns the closest of the five current themes.
function themeMove(id){
  const map = {tempo: "pulse", volt: "pulse", steel: "glacier", tide: "glacier", iron: "glacier", ember: "forge", mono: "forge", bush: "dune", ultraviolet: "bloom"};
  return CONFIG.themes.some(t => t.id === id) ? id : (map[id] || "pulse");
}
// A short cross-fade when the theme changes (skipped with reduced motion)
function fadeTheme(){
  if (reducedMotion()) return;
  const r = document.documentElement;
  r.classList.add("theme-switching");
  setTimeout(() => r.classList.remove("theme-switching"), CONFIG.themeSwitchMs);
}
// Browser bar colour follows the current surface
function syncThemeColour(){
  const m = $('meta[name="theme-color"]');
  if (m) m.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim());
}
function applyTheme(id){
  const t = CONFIG.themes.some(x => x.id === id) ? id : "pulse";
  if (t === "pulse") document.documentElement.removeAttribute("data-palette"); else document.documentElement.setAttribute("data-palette", t);
  themePrefs.palette = t; themeSave(themePrefs); syncThemeColour();
}
$("#theme-options").insertAdjacentHTML("beforeend", CONFIG.themes.map(t => '<label class="choice"><input type="radio" name="theme" value="' + t.id + '"><span class="choice__text"><strong><span class="theme-dots" aria-hidden="true">' + t.colours.map(x => '<i style="background:' + x + '"></i>').join("") + "</span>" + esc(t.name) + '</strong><span class="small muted">' + esc(t.desc) + "</span></span></label>").join(""));
$("#theme-options").addEventListener("change", ev => { if (ev.target.name === "theme"){ fadeTheme(); applyTheme(ev.target.value); } });
const viewerTheme = window.viewerThemeAtLoad || null;
function applyMode(mode){
  const m = mode === "light" || mode === "dark" ? mode : "system";
  themePrefs.mode = m; themeSave(themePrefs);
  if (m === "system"){ if (viewerTheme) document.documentElement.setAttribute("data-theme", viewerTheme); else document.documentElement.removeAttribute("data-theme"); }
  else document.documentElement.setAttribute("data-theme", m);
  $$("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  syncThemeColour();
}
document.addEventListener("click", ev => { const b = ev.target.closest("[data-mode]"); if (b){ fadeTheme(); applyMode(b.dataset.mode); } });
function applyContrast(on){
  themePrefs.contrast = on ? "more" : "auto"; themeSave(themePrefs);
  if (on) document.documentElement.setAttribute("data-contrast", "more"); else document.documentElement.removeAttribute("data-contrast");
  $("#settings-contrast").checked = !!on;
}
$("#settings-contrast").addEventListener("change", ev => { fadeTheme(); applyContrast(ev.target.checked); });
if (window.matchMedia) try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColour); } catch (e){}
function applyLayout(v){
  state.ui.cols = v === "1" ? "1" : "2";
  document.body.classList.toggle("two-up", state.ui.cols === "2");
  $$('#layout-options input').forEach(i => { i.checked = i.value === state.ui.cols; });
}
$("#layout-options").addEventListener("change", ev => { if (ev.target.name === "layout"){ applyLayout(ev.target.value); save(); } });

/* ---------- 3.10 Navigation ---------- */
function showTab(tab){
  state.ui.tab = tab === "plan" || tab === "history" ? tab : "train";
  save(); renderAll();
  window.scrollTo(0, 0);
}
// Open on today's session: today's day, first unfinished exercise open
function openToday(){
  const c = ctx(), t = todaysDay(c);
  if (t) state.ui.day = t;
  // Today opens on the overview; the Up next card opens the exercise sheet with one tap
  state.ui.openEx = null;
  state.ui.tab = "train";
}
function selectDay(n, focus){
  state.ui.day = n;
  state.ui.openEx = null;   // switching day shows that day's overview, not a sheet
  save(); renderAll();
  if (focus) $("#tab-day-" + n).focus();
}
$(".bottom-nav").addEventListener("click", ev => { const b = ev.target.closest("[data-tab]"); if (b) showTab(b.dataset.tab); });
$("#day-tabs").addEventListener("click", ev => { const b = ev.target.closest(".day-tab"); if (b) selectDay(+b.dataset.day, false); });
$("#day-tabs").addEventListener("keydown", ev => {
  const keys = {ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last"};
  if (!(ev.key in keys)) return;
  ev.preventDefault();
  const n = CONFIG.trainingDays, i = state.ui.day - 1;
  const next = keys[ev.key] === "first" ? 0 : keys[ev.key] === "last" ? n - 1 : (i + keys[ev.key] + n) % n;
  selectDay(next + 1, true);
});
$("#view-plan").addEventListener("click", ev => {
  const p = ev.target.closest("[data-plan-view]"); if (p){ state.ui.planView = p.dataset.planView; save(); renderAll(); return; }
  const o = ev.target.closest("[data-open-day]"); if (o){ selectDay(+o.dataset.openDay, false); showTab("train"); }
});
const TO_TOP_AFTER_PX = 400;
function updateToTop(){ $("#to-top").hidden = !(state.ui.tab === "plan" && window.scrollY > TO_TOP_AFTER_PX); }
window.addEventListener("scroll", updateToTop, {passive: true});
$("#to-top").addEventListener("click", () => { window.scrollTo({top: 0, behavior: reducedMotion() ? "auto" : "smooth"}); $("#plan-title").focus({preventScroll: true}); });

/* ---------- 3.11 Logging sets ---------- */
function setsFor(e, kind){ return kind === "repl" ? e.repl.sets : e.sets; }
function goToNextSet(){
  const c = ctx(), day = sessionOf(c, state.ui.day), n = day ? nextSet(c.slot, day) : null;
  if (!n) return;
  activeRows[n.item.id] = n.i;
  state.ui.openEx = n.item.id; save(); renderAll();
  const input = $("#" + n.item.id + "-" + n.kind + "-" + n.i + "-reps") || $("#ex-" + n.item.id + ' [data-kind="' + n.kind + '"][data-i="' + n.i + '"] input');
  if (!input) return;
  input.closest(".set-row").scrollIntoView({block: "center", behavior: reducedMotion() ? "auto" : "smooth"});
  input.focus({preventScroll: true});
}
// Apply one typed or stepped value: clean it, store it, refresh highlights
function applyValue(exEl, rowEl, input, raw, typing){
  const c = ctx(), item = itemOf(c, exEl.dataset.id); if (!item) return;
  const e = ensureEntry(c.slot, item), kind = rowEl.dataset.kind, i = +rowEl.dataset.i, f = input.dataset.f;
  const unit = kind === "repl" ? (e.repl.unit || "kg") : unitOf(c.slot.units, item);
  const r = sanitize(f, raw, unit);
  if (input.value !== r.value) input.value = r.value;
  $(".error-text", rowEl).textContent = r.error;
  setsFor(e, kind)[i][f] = r.value;
  activeRows[item.id] = i;   // keep this set open until "Log set" or another set is tapped
  if (!e.doneAt && setsFor(e, kind).some(isLogged)) e.doneAt = c.today;
  save();
  if (!typing){ refreshExercise(item.id, "#" + CSS.escape(input.id)); return; }
  // While typing: update highlights in place, so the keyboard stays open
  let last = null;
  const a = rowArgs(c, item);
  if (kind === "main" && a.last && a.last.sets) last = sameUnit(withUnit(a.last.sets[i], a.last.unit), unit);
  const b = compareToLast(setsFor(e, kind)[i], last);
  rowEl.classList.toggle("is-beat", b.reps || b.kg);
  const done = isComplete(e);
  exEl.classList.toggle("is-done", done);
  $(".exercise__status", exEl).textContent = done ? "✓" : (item.pair || "");
  const day = sessionOf(c, state.ui.day);
  if (day){ renderProgress(c, day); renderUpNext(c, day); renderDayTabs(c); }
  renderFab(c);
}
// Redraw one open exercise; restore the caret in the field being typed in
function refreshExercise(id, focusSel){
  const active = document.activeElement, pos = active && active.selectionStart != null ? active.selectionStart : null;
  rerenderExercise(id, focusSel);
  const f = focusSel ? $(focusSel) : null;
  if (f && pos != null && f.setSelectionRange) try { f.setSelectionRange(pos, pos); } catch (e){}
}
function listHandler(root){
  root.addEventListener("click", ev => {
    clearTimeout(refreshTimer);
    const mk = ev.target.closest("[data-makeup]");
    if (mk){
      const c = ctx(), item = itemOf(c, mk.dataset.makeup), e = ensureEntry(c.slot, item);
      e.missed.madeUp = {day: state.ui.day, date: c.today};
      state.ui.openEx = item.id; save(); renderAll();
      toast(item.name + " moved into today's session.");
      return;
    }
    const sum = ev.target.closest(".exercise__summary");
    if (sum){
      const id = sum.closest(".exercise").dataset.id;
      state.ui.openEx = state.ui.openEx === id ? null : id; if (state.ui.openEx) state.ui.openExtra = null;
      save(); rerenderAllKeepScroll(id);
      return;
    }
    const btn = ev.target.closest("[data-act]"); if (!btn) return;
    const exEl = btn.closest(".exercise"); if (!exEl) return;
    const c = ctx(), item = itemOf(c, exEl.dataset.id); if (!item) return;
    const e = ensureEntry(c.slot, item), act = btn.dataset.act;
    if (act === "inc" || act === "dec"){
      const row = btn.closest(".set-row"), f = btn.dataset.f;
      const input = row ? $('input[data-f="' + f + '"]', row) : $('input[data-f="guess"]', exEl);
      if (!row){ finderStep(c, item, act === "inc" ? 1 : -1); return; }
      const unit = row.dataset.kind === "repl" ? (e.repl.unit || "kg") : unitOf(c.slot.units, item);
      const step = f !== "kg" ? CONFIG.repsStep : unit === "plates" ? CONFIG.plateStep : CONFIG.kgStep;
      const suggest = Number(input.dataset.suggest) || 0;
      let cur = Number(input.value);
      if (input.value === "" && suggest > 0){ applyValue(exEl, row, input, fmtNum(suggest)); return; }
      cur = cur || 0;
      const next = Math.max(0, Math.round((cur + (act === "inc" ? step : -step)) * 100) / 100);
      applyValue(exEl, row, input, next === 0 && act === "dec" && f !== "kg" ? "" : fmtNum(next));
    } else if (act === "log-set"){
      const row = btn.closest(".set-row");
      logSet(c, item, e, exEl, +row.dataset.i, row.dataset.kind);
    } else if (act === "edit-set"){
      activeRows[item.id] = +btn.closest(".set-row").dataset.i;
      rerenderExercise(item.id, '[data-i="' + activeRows[item.id] + '"] input[data-f="reps"]');
    } else if (act === "add"){
      setsFor(e, btn.dataset.kind).push(emptySet()); activeRows[item.id] = setsFor(e, btn.dataset.kind).length - 1; save(); rerenderExercise(item.id, '[data-act="add"][data-kind="' + btn.dataset.kind + '"]');
    } else if (act === "remove"){
      const sets = setsFor(e, btn.dataset.kind);
      if (sets.length > 1){ sets.pop(); save(); rerenderExercise(item.id, '[data-act="' + (sets.length > 1 ? "remove" : "add") + '"][data-kind="' + btn.dataset.kind + '"]'); }
    } else if (act === "toggle-swap"){
      if (e.replaced) e.replaced = false; else startSwap(e, item, null, c.today);
      delete activeRows[item.id];
      save(); rerenderExercise(item.id, e.replaced ? "#" + CSS.escape(item.id + "-repl-name") : '[data-act="toggle-swap"]');
    } else if (act === "toggle-missed"){
      const on = !(e.missed && e.missed.on);
      e.missed = {on: on, reason: "", date: on ? c.today : null, madeUp: null};
      if (on) e.replaced = false;
      save(); rerenderExercise(item.id, '[data-act="toggle-missed"]');
    } else if (act === "swap-again"){
      const sv = ((c.slot.savedSwaps || {})[item.id] || [])[0]; if (!sv) return;
      startSwap(e, item, sv, c.today); delete activeRows[item.id];
      save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-repl-reason"));
      toast("Swapped for " + sv.name + ". Targets come from last time.");
    } else if (act === "pick-swap"){
      const sv = ((c.slot.savedSwaps || {})[item.id] || [])[+btn.dataset.k]; if (!sv) return;
      startSwap(e, item, sv, c.today);
      save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-repl-reason"));
    } else if (act === "forget-swap"){
      const name = e.repl.name;
      forgetSwap(c.slot, item.id, name); save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-repl-name"));
      toast(name + " removed from your swaps.");
    } else if (act === "measure"){
      e.repl.measure = cleanMeasure(btn.dataset.measure); e.repl.measureChosen = true;
      save(); rerenderExercise(item.id, '[data-act="measure"][data-measure="' + e.repl.measure + '"]');
    } else if (act === "use-swap"){
      e.repl.name = planSwapName(item.swap); if (!e.repl.measureChosen) e.repl.measure = measureFor(e.repl.name); save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-repl-reason"));
    } else if (act === "unit"){
      const u = btn.dataset.unit === "plates" ? "plates" : "kg";
      if (btn.dataset.kind === "repl") e.repl.unit = u; else c.slot.units[unitKey(item)] = u;
      save(); rerenderExercise(item.id, '[data-act="unit"][data-kind="' + btn.dataset.kind + '"][data-unit="' + u + '"]');
    } else if (act === "undo-makeup"){
      e.missed.madeUp = null; save(); renderAll(); toast(item.name + " is back to missed.");
    } else if (act === "close"){
      closeAndOpenNext(c, item);
    } else if (act === "finder-open"){
      state.ui.finder = state.ui.finder || {}; state.ui.finder[item.id] = {guess: topSetGuess(item.lift, item.variant, state).kg, tries: 1};
      save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-finder-guess"));
    } else if (act === "finder-close"){
      delete state.ui.finder[item.id]; save(); rerenderExercise(item.id, '[data-act="finder-open"]');
    } else if (act === "finder-use"){
      const g = state.ui.finder[item.id].guess;
      if (g > 0){ e.sets[0].kg = fmtNum(g); }
      delete state.ui.finder[item.id];
      save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-main-0-reps"));
      toast("Top set weight filled in. Log your reps.");
    }
  });
  root.addEventListener("input", ev => {
    const t = ev.target, exEl = t.closest(".exercise"); if (!exEl) return;
    if (t.matches("input[data-f]") && t.closest(".set-row")) applyValue(exEl, t.closest(".set-row"), t, t.value, true);
    else if (t.matches('input[data-f="guess"]')){
      const c = ctx(), item = itemOf(c, exEl.dataset.id), r = sanitize("kg", t.value, "kg");
      if (t.value !== r.value) t.value = r.value;
      state.ui.finder[item.id].guess = r.value === "" ? null : Number(r.value); save();
    } else if (t.dataset.repl === "name"){
      const c = ctx(), item = itemOf(c, exEl.dataset.id), e = ensureEntry(c.slot, item);
      e.repl.name = t.value.slice(0, 60);
      const slot = $('[data-advice="replaced"]', exEl); if (slot) slot.innerHTML = adviceHTML(c, item, e, "replaced");
      save();
    }
  });
  root.addEventListener("change", ev => {
    const t = ev.target, exEl = t.closest(".exercise"); if (!exEl) return;
    const c = ctx(), item = itemOf(c, exEl.dataset.id); if (!item) return;
    const e = ensureEntry(c.slot, item);
    if (t.matches("input[data-f]") && t.closest(".set-row")){ deferRefresh(item.id); return; }
    if (t.dataset.repl === "name"){
      if (!e.repl.measureChosen && !e.repl.sets.some(isLogged)) e.repl.measure = measureFor(e.repl.name);
      deferRefresh(item.id); return;
    }
    if (t.matches("input[data-regular]")){
      setRegularSwap(c.slot, item.id, {name: e.repl.name, unit: e.repl.unit || "kg", measure: e.repl.measure, setCount: e.repl.sets.length}, t.checked, c.today);
      save(); rerenderExercise(item.id, "input[data-regular]");
      toast(t.checked ? e.repl.name.trim() + " will be swapped in every week on Day " + item.day + "." : "Back to " + item.name + " from next week.");
      return;
    }
    if (t.matches("select[data-variant]")){
      e.variant = t.value;
      const fresh = itemOf(ctx(), item.id);
      if (!e.sets.some(isLogged)) e.sets = fresh.rows.map(emptySet); else while (e.sets.length < fresh.rows.length) e.sets.push(emptySet());
      save(); rerenderExercise(item.id, "#" + CSS.escape(t.id)); return;
    }
    if (t.matches("select[data-end]")){
      const i = +t.closest(".set-row").dataset.i;
      e.sets[i].end = t.value; if (t.value !== "rp" && t.value !== "forced") e.sets[i].extra = "";
      save(); rerenderExercise(item.id, "#" + CSS.escape(t.id)); return;
    }
    if (t.matches("select[data-left]")){
      const row = t.closest(".set-row"), i = +row.dataset.i;
      setsFor(e, row.dataset.kind)[i].left = t.value;
      save(); rerenderExercise(item.id, "#" + CSS.escape(t.id)); return;
    }
    if (t.matches("input[data-check]")){
      const i = +t.closest(".set-row").dataset.i;
      e.sets[i].reps = t.checked ? "1" : "";
      if (!e.doneAt && e.sets.some(isLogged)) e.doneAt = c.today;
      save(); rerenderExercise(item.id, '[data-i="' + i + '"] input[data-check]'); return;
    }
    if (t.matches("select[data-finder-left]")){
      const f = state.ui.finder[item.id];
      const out = topSetOutcome(t.value, f.guess || 0, item.lift, f.tries || 1);
      f.message = out.message; f.verdict = out.verdict; f.done = out.done;
      if (out.verdict === "light" && !out.done){ f.guess = out.nextGuess; f.tries = (f.tries || 1) + 1; }
      save(); rerenderExercise(item.id, "#" + CSS.escape(t.id)); return;
    }
    const mode = t.dataset.repl === "reason" ? "replaced" : t.dataset.missed === "reason" ? "missed" : null;
    if (!mode) return;
    if (mode === "missed") e.missed.reason = t.value; else e.repl.reason = t.value;
    save(); rerenderExercise(item.id, "#" + CSS.escape(t.id));
  });
}
// Redraw after a field loses focus, but late enough that a tap on a button (which redraws anyway) wins.
// Redrawing during the blur would swap the button out from under the tap.
let refreshTimer = null;
function deferRefresh(id){
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    const act = document.activeElement, inside = act && act.id && act.closest && act.closest("#ex-" + id);
    refreshExercise(id, inside ? "#" + CSS.escape(act.id) : null);
  }, 300);
}
function finderStep(c, item, dir){
  const f = state.ui.finder[item.id], cur = Number(f.guess) || 0;
  f.guess = Math.max(0, cur + dir * CONFIG.kgStep);
  save(); rerenderExercise(item.id, "#" + CSS.escape(item.id + "-finder-guess"));
}
function rerenderAllKeepScroll(id){
  renderAll();
  const el = $("#ex-" + id);
  if (el && state.ui.openEx === id){ const r = el.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * 0.6) el.scrollIntoView({block: "start", behavior: reducedMotion() ? "auto" : "smooth"}); }
  const s = $("#ex-" + id + " .exercise__summary"); if (s) s.focus({preventScroll: true});
}
// "Save and close": collapse this exercise and open the next one still to log
function closeAndOpenNext(c, item){
  const day = sessionOf(c, state.ui.day);
  const n = day ? nextSet(c.slot, day, item.id) : null;
  state.ui.openEx = n ? n.item.id : null;
  save(); renderAll();
  const target = state.ui.openEx ? $("#ex-" + state.ui.openEx) : $("#ex-" + item.id);
  if (target){ target.scrollIntoView({block: "start", behavior: reducedMotion() ? "auto" : "smooth"}); const s = $(".exercise__summary", target); if (s) s.focus({preventScroll: true}); }
  if (isComplete(c.slot.entries[item.id])) toast(item.name + " saved.");
}
// "Log set": fill empty fields with the grey suggestions, save, confirm, start the rest timer, move on
function logSet(c, item, e, exEl, i, kind){
  kind = kind === "repl" ? "repl" : "main";
  const a = rowArgs(c, item), row = item.rows[i] || {role: "set"}, sets = setsFor(e, kind);
  const unit = kind === "repl" ? (e.repl.unit || "kg") : unitOf(c.slot.units, item);
  let last = null, t, w, known = null;
  if (kind === "main"){
    last = a.last && a.last.sets ? sameUnit(withUnit(a.last.sets[i], a.last.unit), unit) : null;
    t = rowTarget(item, i, Object.assign({}, a, {entry: e}));
    w = item.plan === "hd" ? hdWarmup(item, i, Object.assign({}, a, {entry: e})) : null;
    known = !(w && w.kg) && !t.kg && isWorkingRow(item, i) ? bestKnownLoad(item, i, Object.assign({}, a, {entry: e}), c.slot.history) : null;
  } else {
    const g = replGuide(c, item, e, i, unit); t = g.t; w = g.w;
    if (a.last && a.last.replaced && a.last.replacement && keyOf(a.last.replacement.name) === keyOf(e.repl.name)) last = sameUnit(withUnit((a.last.replacement.sets || [])[i], a.last.replacement.unit || "kg"), unit);
    if (!last && g.rec && (g.rec.measure || "reps") === (e.repl.measure || "reps")) last = sameUnit(withUnit(g.rec.sets[i], g.rec.unit), unit);
  }
  const m = kind === "repl" ? cleanMeasure(e.repl.measure) : "reps", timed = m === "time";
  const sug = suggestedSet(sets[i], w && w.kg ? w.kg : (t.kg || (known ? known.kg : null)), last, timed || (m === "distance" && item.log !== "carry") ? null : planRowReps(item, i), t.reps || null);
  const repsOk = sanitize("reps", sug.reps), kgOk = sanitize("kg", sug.kg, unit);
  if (!(Number(repsOk.value) > 0)){ const err = $('[data-kind="' + kind + '"][data-i="' + i + '"] .error-text', exEl); if (err) err.textContent = timed ? "Enter the seconds you held first." : m === "distance" || (kind === "main" && item.log === "carry") ? "Enter the metres first." : "Enter your reps first."; return; }
  sets[i].reps = repsOk.value; sets[i].kg = kgOk.value;
  if (!e.doneAt) e.doneAt = c.today;
  save();
  if (navigator.vibrate) try { navigator.vibrate(15); } catch (err){}
  const next = sets.findIndex((s, k) => k > i && !isLogged(s));
  activeRows[item.id] = next >= 0 ? next : -1;
  rerenderExercise(item.id, next >= 0 ? '[data-kind="' + kind + '"][data-i="' + next + '"] [data-act="log-set"]' : '[data-act="close"]');
  const el = $("#ex-" + item.id + ' [data-kind="' + kind + '"][data-i="' + i + '"]'); if (el){ el.classList.add("is-just-logged"); }
  const secs = restSeconds(item.rest, row.role);
  const name = kind === "repl" && e.repl.name.trim() ? e.repl.name.trim() : item.name;
  const day = sessionOf(c, state.ui.day), after = next < 0 && day ? nextSet(c.slot, day, item.id) : null;
  // Supersets: after the first half, go straight to the partner's set in the same round;
  // after the second half, the rest timer points back to the first half's next set
  const partner = pairPartnerId(c, item) ? itemOf(c, pairPartnerId(c, item)) : null;
  if (partner && $("#ex-" + partner.id + " .exercise__panel:not([hidden])")){
    const pe = c.slot.entries[partner.id], pk = pe && pe.replaced ? "repl" : "main", psets = pe ? setsFor(pe, pk) : partner.rows.map(emptySet);
    const pname = pe && pe.replaced && pe.repl.name.trim() ? pe.repl.name.trim() : partner.name;
    if (item.pair < partner.pair && i < psets.length && !isLogged(psets[i])){
      activeRows[partner.id] = i;
      rerenderExercise(partner.id, '[data-kind="' + pk + '"][data-i="' + i + '"] [data-act="log-set"]');
      toast(plainRowLabel(row.label || "Set") + " logged. Now " + pname + ".");
      return;
    }
    const pn = psets.findIndex(s => !isLogged(s));
    if (item.pair > partner.pair && pn >= 0){
      activeRows[partner.id] = pn; rerenderExercise(partner.id);
      const focusBtn = $("#ex-" + item.id + ' [data-act="log-set"]') || $("#ex-" + partner.id + ' [data-i="' + pn + '"] [data-act="log-set"]'); if (focusBtn) focusBtn.focus();
      if (secs){ startRest(secs, pname + ", " + plainRowLabel((partner.rows[pn] || {label: "next set"}).label)); return; }
    }
  }
  if (secs) startRest(secs, next >= 0 ? name + ", " + plainRowLabel((item.rows[next] || {label: "next set"}).label) : (after ? after.item.name : "you're done for today"));
  else toast(plainRowLabel(row.label || "Set") + " logged.");
}

/* ---------- 3.11b Rest timer (memory only; nothing is saved) ---------- */
let rest = null, restTick = null;
// Takes seconds and what comes next. Shows the timer bar and counts down.
function startRest(secs, nextLabel){
  rest = {end: Date.now() + secs * 1000, total: secs, next: nextLabel, doneShown: false};
  $("#rest-bar").hidden = false; document.body.classList.add("has-rest");
  clearInterval(restTick); restTick = setInterval(renderRest, 250); renderRest();
}
function stopRest(){ clearInterval(restTick); restTick = null; rest = null; $("#rest-bar").hidden = true; document.body.classList.remove("has-rest"); }
function renderRest(){
  if (!rest) return;
  const left = Math.max(0, Math.ceil((rest.end - Date.now()) / 1000));
  const mm = Math.floor(left / 60), ss = left % 60;
  $("#rest-time").textContent = mm + ":" + (ss < 10 ? "0" : "") + ss;
  $("#rest-fill").style.width = Math.round((1 - left / rest.total) * 100) + "%";
  $("#rest-next").textContent = left > 0 ? "Next: " + rest.next : "Rest done. Go: " + rest.next;
  $("#rest-bar").classList.toggle("is-done", left === 0);
  if (left === 0 && !rest.doneShown){
    rest.doneShown = true;
    $("#rest-status").textContent = "Rest done.";
    if (navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (err){}
    setTimeout(() => { if (rest && rest.doneShown) stopRest(); }, 8000);
  }
}
$("#rest-add").addEventListener("click", () => { if (rest){ rest.end = Math.max(rest.end, Date.now()) + 30000; rest.total += 30; rest.doneShown = false; renderRest(); } });
$("#rest-skip").addEventListener("click", stopRest);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") renderRest(); });

listHandler($("#exercise-list"));
listHandler($("#catchup"));
listHandler($("#makeup-body"));
$("#swaps-log").addEventListener("toggle", ev => { if (ev.target.id === "swaps-details"){ state.ui.varOpen = ev.target.open; save(); } }, true);

/* ---------- 3.12 Up next, banners and hazard card actions ---------- */
document.addEventListener("click", ev => {
  if (ev.target.closest("[data-next-set]")) goToNextSet();
  const g = ev.target.closest("[data-goto-day]"); if (g) selectDay(+g.dataset.gotoDay, true);
  if (ev.target.closest("[data-export]")) exportWeek();
  if (ev.target.closest("[data-open-new-week]")) openDialog($("#dialog-new-week"));
  const m = ev.target.closest("[data-miss-day]"); if (m) openMissDialog(+m.dataset.missDay);
  const o = ev.target.closest("[data-open-makeup]"); if (o) openMakeupSheet(+o.dataset.openMakeup);
  const u = ev.target.closest("[data-undo-missday]");
  if (u){ const c = ctx(), k = +u.dataset.undoMissday; undoDayMissed(c.slot, k); save(); if (sheetOpen) closeDialog($("#dialog-makeup")); renderAll(); toast("Day " + k + " is no longer marked missed."); }
  if (ev.target.closest("#button-clear-loaded")) openDialog($("#dialog-clear"));
});
$("#next-fab").addEventListener("click", goToNextSet);
$("#sheet-scrim").addEventListener("click", closeExerciseSheet);
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && (state.ui.openEx || state.ui.openExtra) && !$("dialog[open]") && state.ui.tab === "train") closeExerciseSheet(); });
if ("IntersectionObserver" in window) new IntersectionObserver(entries => { upNextVisible = entries[0].isIntersecting; renderFab(ctx()); }).observe($("#up-next"));
$("#hazard-bar").addEventListener("click", ev => {
  const y = ev.target.closest("[data-hz-yes]"); if (y){ openMissDialog(+y.dataset.hzYes); return; }
  const t = ev.target.closest("[data-hz-trained]");
  if (t){ const c = ctx(), n = +t.dataset.hzTrained; c.slot.ui.dismissedMiss = Object.assign({}, c.slot.ui.dismissedMiss, {[n]: true}); selectDay(n, false); showTab("train"); return; }
  const o = ev.target.closest("[data-hz-open]"); if (o) openMakeupSheet(+o.dataset.hzOpen);
});

/* ---------- 3.13 Missed whole days and make-ups ---------- */
let missDayPending = null;
$("#missday-reasons").insertAdjacentHTML("beforeend", Object.keys(CONFIG.dayMissReasons).map((k, i) => '<label class="choice"><input type="radio" name="missday" value="' + k + '"' + (i === 0 ? " checked" : "") + "><span>" + esc(CONFIG.dayMissReasons[k]) + "</span></label>").join(""));
function openMissDialog(n){
  missDayPending = n;
  $("#dialog-missday-title").textContent = "Missed Day " + n + "?";
  $$("#missday-reasons input")[0].checked = true;
  openDialog($("#dialog-missday"));
}
$("#button-missday-confirm").addEventListener("click", () => {
  const c = ctx(), n = missDayPending, r = ($("#missday-reasons input:checked") || {}).value || "other";
  closeDialog($("#dialog-missday"));
  markDayMissed(c.slot, sessionOf(c, n), r, addDays(c.slot.weekStart, n - 1));
  state.ui.openEx = null;
  save(); renderAll();
  toast("Day " + n + " marked as missed. Make-ups are in the yellow card.");
});
let sheetOpen = false;
function openMakeupSheet(n){ state.ui.makeupDay = n; sheetOpen = true; renderMakeupSheet(); openDialog($("#dialog-makeup")); }
function renderMakeupNote(){
  const c = ctx(), n = state.ui.makeupDay, md = (c.slot.missedDays || {})[n]; if (!md) return;
  const s = sessionOf(c, n), st = dayMakeupStatus(c.slot, n, s);
  $("#makeup-note").textContent = "Missed " + weekdayName(md.date) + ", " + s.title + ". Made up so far: " + st.made.length + " of " + st.total + ". The export will say: \"" + dayNote(c.slot, n, s) + ".\"";
}
function renderMakeupSheet(){
  const c = ctx(), days = Object.keys(c.slot.missedDays || {}).map(Number).sort((a, b) => a - b);
  let n = state.ui.makeupDay;
  if (days.indexOf(n) < 0) n = days[0];
  if (!n){ closeDialog($("#dialog-makeup")); return; }
  state.ui.makeupDay = n;
  const s = sessionOf(c, n), md = c.slot.missedDays[n], ids = md.exIds || [];
  $("#makeup-title").textContent = "Day " + n + " make-ups";
  renderMakeupNote();
  $("#makeup-days").innerHTML = days.length > 1 ? days.map(d => '<button type="button" class="button" data-sheet-day="' + d + '" aria-pressed="' + (d === n) + '">Day ' + d + "</button>").join("") : "";
  const slotDay = dayOfWeek(c.today);
  $("#makeup-body").innerHTML = (sessionItems(s).filter(it => ids.indexOf(it.id) >= 0).map(it => {
    const e = c.slot.entries[it.id];
    if (isMadeUp(e)) return exerciseHTML(c, it);
    return '<div class="catchup__item"><div><strong>' + esc(it.name) + '</strong><br><span class="small muted">' + esc(summaryText(c, it)) + '</span></div><button type="button" class="button button--primary" data-sheet-makeup="' + it.id + '">Log it today<span class="visually-hidden">: ' + esc(it.name) + "</span></button></div>";
  }).join("") || '<p class="small muted">Nothing left to make up for this day.</p>') +
    '<p class="small muted">Make-ups are stamped ' + (slotDay <= CONFIG.trainingDays ? "Day " + slotDay : weekdayName(c.today)) + ", " + esc(fmtDate(c.today)) + '. <button type="button" class="link-button" data-undo-missday="' + n + '">Undo missed day</button></p>';
}
$("#dialog-makeup").addEventListener("click", ev => {
  const d = ev.target.closest("[data-sheet-day]"); if (d){ state.ui.makeupDay = +d.dataset.sheetDay; renderMakeupSheet(); return; }
  const m = ev.target.closest("[data-sheet-makeup]");
  if (m){
    const c = ctx(), item = itemOf(c, m.dataset.sheetMakeup), e = ensureEntry(c.slot, item);
    e.missed.madeUp = {day: dayOfWeek(c.today), date: c.today};
    state.ui.openEx = item.id;
    save(); renderMakeupSheet(); renderHazard(ctx());
    const first = $("#makeup-body #ex-" + item.id + " input"); if (first) first.focus();
  }
});
$("#dialog-makeup").addEventListener("close", () => { sheetOpen = false; renderAll(); });

/* ---------- 3.14 Week options: export, load, new week, restore ---------- */
// Takes a plan id and a finished week (export or last-week shape). Keeps it in the history archive.
function archiveWeek(plan, week){
  if (!week || !week.weekStart || !week.entries) return;
  if (!archiveSave(archiveAdd(archiveLoad(), plan, week, CONFIG.archiveWeeks))){ storageOK = false; renderStorageWarning(); }
}
// First run with history: keep the week already loaded as last week, so it doesn't drop out later.
PLAN_IDS.forEach(p => { const sl = slotOf(state, p); if (sl && sl.lastWeek && sl.lastWeek.weekStart && !archiveLoad()[p].some(w => w.weekStart === sl.lastWeek.weekStart)) archiveWeek(p, sl.lastWeek); });
$("#button-week-options").addEventListener("click", () => {
  const c = ctx();
  $("#dialog-week-note").textContent = PLAN_NAMES[c.plan] + ", " + fmtRange(c.slot.weekStart) + ". Each plan keeps its own weeks.";
  openDialog($("#dialog-week"));
});
function exportWeek(){
  const c = ctx(), other = otherPlan(c.plan), otherSlot = slotOf(state, other);
  const obj = buildExport(c.slot, c.plan, c.sessions, otherSlot ? {plan: other, slot: slotForExport(otherSlot)} : null, new Date().toISOString());
  storageDownload(obj, exportFilename(c.plan, c.slot.weekStart)).then(result => {
    if (result === "saved") toast("Week exported.");
    else if (result === "cancelled") toast("Export cancelled.");
    else if (result === "busy") toast("An export is already open.");
    else { $("#export-text").value = JSON.stringify(obj, null, 2); $("#copy-error").textContent = ""; closeDialog($("#dialog-week")); openDialog($("#dialog-export")); }
  });
}
$("#button-export").addEventListener("click", exportWeek);
$("#button-copy").addEventListener("click", () => {
  const ta = $("#export-text");
  const done = () => toast("Copied. Paste it somewhere safe.");
  const fallback = () => { ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e){} if (ok) done(); else $("#copy-error").textContent = "Copy didn't work here. The text is selected. Use your phone's copy option."; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
});
$("#button-new-week").addEventListener("click", () => {
  const c = ctx(), next = nextWeekForPlan(c.cycle, c.plan, laterOf(addDays(c.slot.weekStart, 7), c.now.weekStart));
  $("#dialog-new-week-text").textContent = "This week's sets become targets for " + fmtRange(next) + ". Then the log clears. Export first if you want a backup.";
  closeDialog($("#dialog-week")); openDialog($("#dialog-new-week"));
});
$("#button-new-week-confirm").addEventListener("click", () => {
  const c = ctx(), nowISO = new Date().toISOString();
  archiveWeek(c.plan, buildExport(c.slot, c.plan, c.sessions, null, nowISO));
  startNewWeek(c.slot, c.plan, c.sessions, c.cycle, c.today, nowISO);
  Object.keys(activeRows).forEach(k => { delete activeRows[k]; });
  closeDialog($("#dialog-new-week"));
  openToday(); save(); renderAll();
  toast("New week started. Last week's numbers are your targets.");
});
$("#button-clear-confirm").addEventListener("click", () => {
  clearLoadedWeek(ctx().slot); save(); closeDialog($("#dialog-clear")); renderAll(); toast("Loaded week cleared.");
});
function doLoad(text){
  try {
    const r = readExportFile(text), slot = slotOf(state, r.plan);
    if (!slot) throw new Error("Set up your plans first.");
    loadAsLastWeek(slot, r.plan, r.data);
    archiveWeek(r.plan, r.data);
    save(); closeDialog($("#dialog-load")); renderAll();
    toast("Loaded into " + PLAN_NAMES[r.plan] + (slot.lastWeek.weekStart ? ": " + fmtRange(slot.lastWeek.weekStart) : "") + ".");
  } catch (err){ $("#load-error").textContent = err.message; }
}
$("#button-load").addEventListener("click", () => { $("#load-error").textContent = ""; $("#load-text").value = ""; $("#load-file").value = ""; closeDialog($("#dialog-week")); openDialog($("#dialog-load")); });
$("#button-load-text").addEventListener("click", () => { const t = $("#load-text").value.trim(); if (!t){ $("#load-error").textContent = "Paste the exported text first, or choose a file."; return; } doLoad(t); });
$("#load-file").addEventListener("change", ev => {
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => doLoad(String(reader.result));
  reader.onerror = () => { $("#load-error").textContent = "That file couldn't be read. Try again, or paste its text."; };
  reader.readAsText(file);
});
let pendingRestore = null;
function previewRestore(text){
  $("#restore-error").textContent = ""; $("#restore-summary").textContent = ""; $("#button-restore-go").disabled = true; $("#restore-other-row").hidden = true; pendingRestore = null;
  try {
    pendingRestore = parseBackup(text);
    const n = pendingRestore.logged;
    $("#restore-summary").textContent = PLAN_NAMES[pendingRestore.plan] + " backup of " + fmtRange(pendingRestore.weekStart) + ": " + n + " " + (n === 1 ? "exercise" : "exercises") + " logged.";
    if (pendingRestore.other){ $("#restore-other-row").hidden = false; $("#restore-other").checked = false; $("#restore-other-label").textContent = "Also restore your " + PLAN_NAMES[pendingRestore.other.plan] + " data from this file."; }
    $("#button-restore-go").disabled = false;
  } catch (err){ $("#restore-error").textContent = err.message; }
}
$("#button-restore").addEventListener("click", () => {
  $("#restore-error").textContent = ""; $("#restore-summary").textContent = ""; $("#restore-text").value = ""; $("#restore-file").value = ""; $("#restore-other-row").hidden = true;
  $("#button-restore-go").disabled = true; pendingRestore = null;
  closeDialog($("#dialog-week")); openDialog($("#dialog-restore"));
});
$("#restore-file").addEventListener("change", ev => {
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  $("#restore-summary").textContent = "Reading backup…";
  reader.onload = () => previewRestore(String(reader.result));
  reader.onerror = () => { $("#restore-error").textContent = "That file couldn't be read. Try again, or paste its text."; };
  reader.readAsText(file);
});
$("#restore-text").addEventListener("input", ev => { if (ev.target.value.trim()) previewRestore(ev.target.value.trim()); else { pendingRestore = null; $("#button-restore-go").disabled = true; $("#restore-summary").textContent = ""; $("#restore-error").textContent = ""; } });
$("#button-restore-go").addEventListener("click", () => {
  const p = pendingRestore; if (!p) return;
  ensurePbSlot(state, todayISO());
  applyBackup(slotOf(state, p.plan), p);
  if (p.other && $("#restore-other").checked){
    const target = slotOf(state, p.other.plan), src = p.other.slot;
    const keep = p.other.plan === "hd" ? {cycle: state.cycle, pb: state.pb, ui: state.ui} : null;
    ["weekStart", "entries", "units", "lastWeek", "history", "varHistory", "loadedStreaks", "pastVariations", "missedDays", "extras", "savedSwaps", "savedExtras"].forEach(k => { if (src[k] !== undefined) target[k] = JSON.parse(JSON.stringify(src[k])); });
    if (keep) Object.assign(state, keep);
    if (target.lastWeek) archiveWeek(p.other.plan, target.lastWeek);
  }
  { const sl = slotOf(state, p.plan); if (sl.lastWeek) archiveWeek(p.plan, sl.lastWeek); }
  state.ui.openEx = null;
  save(); closeDialog($("#dialog-restore")); state.ui.tab = "train"; renderAll();
  toast("Backup restored: " + fmtRange(p.weekStart) + ".");
});

/* ---------- 3.15 Offline use and updates ----------
   On a web address (not a saved file), sw.js keeps a copy of the app so it opens with no signal.
   When a newer version downloads, the update bar asks before switching. */
function setupOffline(){
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  let reloading = false;
  const offer = worker => {
    $("#update-bar").hidden = false;
    $("#button-update").onclick = () => { $("#button-update").disabled = true; worker.postMessage("skip-waiting"); };
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading){ reloading = true; location.reload(); } });
  navigator.serviceWorker.register("sw.js").then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
    });
    // Check for a new version each time the app comes back into view
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
}
setupOffline();

/* ---------- 3.16 Start ---------- */
applyTheme(themePrefs.palette || "pulse");
$$('#theme-options input').forEach(i => { i.checked = i.value === (themePrefs.palette || "pulse"); });
applyMode(themePrefs.mode || "system");
applyContrast(themePrefs.contrast === "more");
applyLayout(state.ui.cols || "2");
if (state.cycle){
  // Open on today's session each new day
  if (state.ui.lastOpened !== todayISO()){ openToday(); state.ui.lastOpened = todayISO(); }
  state.ui.openEx = null;   // never start with a sheet covering Today
}
renderAll();
save();
