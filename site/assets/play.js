// Try it: a whole deal in the browser. Handshake's own terms parser and strategy (handshake/terms.py, strategy.py),
// ported, against a seller whose floor is sealed in a room you can't see. Orders to their agent are refused, as on Switch.
const $ = (s, r = document) => r.querySelector(s);
const UNITS = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, lakh: 1e5, lakhs: 1e5, l: 1e5, cr: 1e7, crore: 1e7 };
const AMOUNT = /(\$|₹|rs\.?\s?)?(\d[\d,]*(?:\.\d+)?)\s?(k|thousand|mn|m|million|lakhs?|l|cr|crore)?\b/gi;
const WALK = /walk[\s-]?away|ceiling|max(imum)?|at most|no more than|floor|minimum|at least|bottom[\s-]?line|limit/i;
const TARGET = /\b(aim\w*|target\w*|hop(e|ing)|ideal(ly)?|(would|i'?d) like|goal|prefer)/i;
const OPEN = /\b(open|start|first offer|begin|anchor)/i;

const amounts = (text, needMarker = false) => [...text.matchAll(AMOUNT)]
  .filter((m) => !needMarker || m[1] || m[3]).map((m) => Math.round(parseFloat(m[2].replace(/,/g, "")) * (UNITS[(m[3] || "").toLowerCase()] || 1) * 100) / 100);
const money = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `$${(v / 1e3).toFixed(1).replace(".0", "")}K` : `$${Math.round(v).toLocaleString()}`);
const roundMoney = (v) => { const u = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 2); return Math.round(v / u) * u; };

function parseTerms(text) {
  const found = {};
  for (const clause of text.split(/(?<!\d)\.(?!\d)|[;,\n]|\bbut\b|\band\b(?!\s*\d)/i)) {
    const v = amounts(clause)[0];
    if (v == null) continue;
    if (WALK.test(clause)) found.walk ??= v; else if (TARGET.test(clause)) found.target ??= v; else if (OPEN.test(clause)) found.open ??= v;
  }
  if (found.walk == null) return { missing: true };
  const t = found.target ?? roundMoney(found.walk * 0.85), o = found.open ?? roundMoney(t - (found.walk - t) * 0.8);
  return { role: "buyer", open: o, target: t, walk: found.walk, step: roundMoney(Math.max(Math.abs(found.walk - o) / 4, 1)) };
}
function nextMove(pb, mine, theirs) {
  const buyer = pb.role === "buyer";
  let nxt = !mine.length ? pb.open : (buyer ? Math.min(mine.at(-1) + pb.step, pb.walk) : Math.max(mine.at(-1) - pb.step, pb.walk));
  nxt = roundMoney(nxt);
  const last = theirs.at(-1);
  if (last != null && ((buyer && last <= nxt) || (!buyer && last >= nxt))) return { kind: "accept", price: last };
  return { kind: "offer", price: nxt, stuck: mine.length && nxt === mine.at(-1) };
}

function start() {
  const root = $("[data-play]");
  if (!root) return;
  const logYou = $("[data-log-you]"), logTable = $("[data-log-table]");
  let me, them, deal;
  const say = (log, who, text, cls = "") => {
    const el = document.createElement("div"); el.className = `line ${cls}`;
    el.innerHTML = `<b></b><span></span>`; el.querySelector("b").textContent = who; el.querySelector("span").textContent = text;
    log.append(el); log.scrollTop = log.scrollHeight;
    if (window.gsap) gsap.from(el, { y: 10, opacity: 0, duration: 0.5, ease: "power3.out" });
  };
  const reset = () => {
    logYou.replaceChildren(); logTable.replaceChildren();
    const floor = roundMoney(68000 + Math.random() * 18000); // their sealed floor, somewhere between $68K and $86K
    them = { pb: { role: "seller", open: 110000, target: floor + 16000, walk: floor, step: 8000 }, mine: [], theirs: [] };
    me = { pb: null, mine: [], theirs: [], pending: null };
    deal = { closed: false };
    $("[data-them-note]").textContent = "403 · Agent is not a member of this room";
    $("[data-them]").classList.remove("open");
    say(logYou, "your agent", "Tell me your limits in plain words, then say open. Only you and I can see this room.", "agent");
  };
  const draft = (move) => {
    me.pending = move;
    say(logYou, "your agent", move.kind === "accept" ? `Draft: accept ${money(move.price)}. Reply yes to send it.`
      : `Draft: offer ${money(move.price)}${move.stuck ? " (that's your walk-away)" : ""}. ${money(me.pb.walk - move.price)} left before your walk-away. Reply yes.`, "agent draft");
  };
  const theirTurn = () => setTimeout(() => {
    if (deal.closed) return;
    const m = nextMove(them.pb, them.mine, them.theirs);
    if (m.kind === "accept") { say(logTable, "their agent", `accepts ${money(m.price)}`, "them"); return close(m.price); }
    if (m.price === them.mine.at(-1) && me.mine.at(-1) === me.pb.walk) {
      say(logTable, "their agent", `holds at ${money(m.price)}`, "them");
      return close(null);
    }
    them.mine.push(m.price); me.theirs.push(m.price);
    say(logTable, "their agent", `proposes ${money(m.price)} (their person said yes in their room)`, "them");
    draft(nextMove(me.pb, me.mine, me.theirs));
  }, 1300);
  const react = (line, light) => dispatchEvent(new CustomEvent("hs:react", { detail: { line, light } }));
  const close = (price) => {
    deal.closed = true;
    react(price ? `Deal at ${money(price)}, and neither of you ever saw the other's number.` : "No overlap this time, and still neither number came out.", "on");
    $("[data-them]").classList.add("open");
    $("[data-them-note]").textContent = price ? `Deal at ${money(price)}. Their floor was ${money(them.pb.walk)}: you never saw it, and they never saw your ${money(me.pb.walk)}.`
      : `No deal: their floor (${money(them.pb.walk)}) is above your walk-away (${money(me.pb.walk)}). Neither side learned the other's number.`;
    say(logYou, "your agent", price ? `Agreed at ${money(price)}. Term sheet filed at the table.` : "No overlap; I stopped at your walk-away. Say new deal to try other limits.", "agent");
  };
  const fromYou = (text) => {
    const t = text.trim(), low = t.toLowerCase();
    if (!t) return;
    say(logYou, "you", t, "you");
    if (low === "new deal" || low === "reset") return reset();
    if (deal.closed) return say(logYou, "your agent", "This deal is closed. Say new deal for another.", "agent");
    if (/^(yes|y|ok|send|go)\b/.test(low) && me.pending) {
      const m = me.pending; me.pending = null;
      if (m.kind === "accept") { say(logTable, "your agent", `accepts ${money(m.price)}`, "you"); return close(m.price); }
      me.mine.push(m.price); them.theirs.push(m.price);
      say(logTable, "your agent", `proposes ${money(m.price)} for the retainer`, "you");
      return theirTurn();
    }
    if (/^open\b/.test(low)) return me.pb ? draft(nextMove(me.pb, me.mine, me.theirs)) : say(logYou, "your agent", "Your limits first: where do you walk away?", "agent");
    const pb = parseTerms(t);
    if (pb.missing) return say(logYou, "your agent", "Tell me the number you walk away at (for example: walk away above $90K).", "agent");
    me.pb = pb;
    say(logYou, "your agent", `Sealed: open ${money(pb.open)}, aim ${money(pb.target)}, walk away above ${money(pb.walk)}, steps of ${money(pb.step)}. Say open.`, "agent");
  };
  const atTable = (text) => {
    const t = text.trim();
    if (!t) return;
    say(logTable, "you", t, "you");
    if (/@their/i.test(t)) { setTimeout(() => say(logTable, "Switch", "You're not permitted to direct messages to their agent in this room: its operator has restricted who can address it.", "switch"), 500); react("See that? Switch turned your order away before their agent ever read it.", "nervous"); setTimeout(() => react(null, "on"), 2600); }
    else setTimeout(() => say(logTable, "Switch", "Nobody was addressed. Talk to your own agent in your room.", "switch"), 500);
  };
  $("[data-form-you]").addEventListener("submit", (e) => { e.preventDefault(); const i = $("[data-input-you]"); fromYou(i.value); i.value = ""; });
  $("[data-form-table]").addEventListener("submit", (e) => { e.preventDefault(); const i = $("[data-input-table]"); atTable(i.value); });
  root.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => fromYou(b.dataset.act === "reset" ? "new deal" : b.dataset.act)));
  reset();
}
if (document.readyState === "complete") start(); else addEventListener("load", start);
