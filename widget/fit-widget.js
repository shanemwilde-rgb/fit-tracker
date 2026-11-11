// Shane's Fit Tracker — Scriptable home-screen widget.
// Progress tab → iPhone Widget → Copy Script. That copy already includes your key.
// In Scriptable: add a Small or Medium widget and choose this script.
// Tapping the widget opens the app.

const WIDGET_KEY = "PASTE_YOUR_KEY";
const API_KEY = "AIzaSyAhtYVlq8qOKtac1MHPyfKUCGWfRiEhEYs";
const PROJECT_ID = "shane-fitness-c1e81";
const APP_URL = "https://shanemwilde-rgb.github.io/fit-tracker/";
const CALORIE_GOAL_DEFAULT = 2600;
const PROTEIN_GOAL_DEFAULT = 195;

const BG = new Color("#14181c");
const BG_TOP = new Color("#1c2830");
const TEXT = new Color("#f4f7f8");
const MUTED = new Color("#9aa3ab");
const GREEN = new Color("#39d47f");
const GOLD = new Color("#ffc53d");
const ORANGE = new Color("#ff8a3d");
const RED = new Color("#f0564a");

function keyReady() {
  return typeof WIDGET_KEY === "string"
    && WIDGET_KEY !== "PASTE_YOUR_KEY"
    && WIDGET_KEY.length >= 20;
}

function denverToday() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    let y = "", m = "", d = "";
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type === "year") y = parts[i].value;
      if (parts[i].type === "month") m = parts[i].value;
      if (parts[i].type === "day") d = parts[i].value;
    }
    if (y && m && d) return y + "-" + m + "-" + d;
  } catch (e) {}
  try {
    const df = new DateFormatter();
    df.dateFormat = "yyyy-MM-dd";
    df.timeZone = "America/Denver";
    const s = df.string(new Date());
    if (s && s.length >= 10) return s.substring(0, 10);
  } catch (e2) {}
  const n = new Date();
  const mo = n.getMonth() + 1;
  const da = n.getDate();
  return n.getFullYear() + "-" + (mo < 10 ? "0" : "") + mo + "-" + (da < 10 ? "0" : "") + da;
}

function fmt(n) {
  const rounded = Math.round(Number(n));
  if (!isFinite(rounded)) return "0";
  const neg = rounded < 0;
  const digits = String(Math.abs(rounded));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits.charAt(i);
  }
  return (neg ? "-" : "") + out;
}

function numField(fields, name) {
  if (!fields || !fields[name]) return NaN;
  const f = fields[name];
  if (f.integerValue != null && f.integerValue !== "") return parseInt(f.integerValue, 10);
  if (f.doubleValue != null && f.doubleValue !== "") return Number(f.doubleValue);
  if (f.stringValue != null && f.stringValue !== "") return Number(f.stringValue);
  return NaN;
}

function intField(fields, name) {
  const n = Math.round(numField(fields, name));
  return isFinite(n) ? n : 0;
}

function positiveInt(n, fallback) {
  const r = Math.round(Number(n));
  return (isFinite(r) && r > 0) ? r : fallback;
}

function strField(fields, name) {
  if (!fields || !fields[name] || fields[name].stringValue == null) return "";
  return String(fields[name].stringValue);
}

async function fetchSummary() {
  if (!keyReady()) return { error: "setup" };
  const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID
    + "/databases/(default)/documents/widget/" + encodeURIComponent(WIDGET_KEY)
    + "?key=" + encodeURIComponent(API_KEY);
  const req = new Request(url);
  req.timeoutInterval = 12;
  req.headers = { Referer: APP_URL, Accept: "application/json" };
  try {
    const json = await req.loadJSON();
    if (!json || !json.fields) return { error: "missing" };
    return { fields: json.fields };
  } catch (e) {
    let code = 0;
    try { code = req.response && req.response.statusCode; } catch (e2) {}
    if (code === 403 || code === 401) return { error: "rules" };
    if (code === 404) return { error: "missing" };
    return { error: "network" };
  }
}

function modelFrom(result) {
  const goalDefault = CALORIE_GOAL_DEFAULT;
  const proteinDefault = PROTEIN_GOAL_DEFAULT;
  const empty = {
    caloriesEaten: 0,
    calorieGoal: goalDefault,
    protein: 0,
    proteinGoal: proteinDefault,
    caloriesRemaining: goalDefault,
    stale: true,
    note: "no meals logged yet"
  };
  if (!result || result.error || !result.fields) {
    if (result && result.error === "setup") empty.note = "Copy the script from the app";
    else if (result && result.error === "rules") empty.note = "Publish Firestore rules";
    else if (result && result.error === "network") empty.note = "Couldn't refresh";
    return empty;
  }
  const fields = result.fields;
  const goal = positiveInt(numField(fields, "calorieGoal"), goalDefault);
  const pGoal = positiveInt(numField(fields, "proteinGoal"), proteinDefault);
  const date = strField(fields, "date").substring(0, 10);
  if (!date || date !== denverToday()) {
    empty.calorieGoal = goal;
    empty.proteinGoal = pGoal;
    empty.note = "no meals logged yet";
    return empty;
  }
  return {
    caloriesEaten: intField(fields, "caloriesEaten"),
    calorieGoal: goal,
    protein: intField(fields, "protein"),
    proteinGoal: pGoal,
    caloriesRemaining: intField(fields, "caloriesRemaining"),
    stale: false,
    note: ""
  };
}

function leftColor(n) {
  if (n > 200) return GREEN;
  if (n > 0) return ORANGE;
  return RED;
}

function paint(widget) {
  const g = new LinearGradient();
  g.locations = [0, 1];
  g.colors = [BG_TOP, BG];
  widget.backgroundGradient = g;
  widget.backgroundColor = BG;
  widget.url = APP_URL;
  widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
}

function addLabel(stack, text, size, color, limit) {
  const t = stack.addText(text);
  t.font = Font.mediumSystemFont(size);
  t.textColor = color;
  t.lineLimit = limit || 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function addValue(stack, text, size, color) {
  const t = stack.addText(text);
  t.font = Font.boldRoundedSystemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.55;
  return t;
}

function buildSmall(widget, model) {
  widget.setPadding(12, 14, 10, 14);
  const head = widget.addText("FIT TRACKER");
  head.font = Font.boldSystemFont(11);
  head.textColor = GREEN;
  head.lineLimit = 1;
  widget.addSpacer(6);
  addValue(widget, fmt(model.caloriesEaten) + "/" + fmt(model.calorieGoal), 18, TEXT);
  addLabel(widget, "calories", 11, MUTED);
  widget.addSpacer(4);
  addValue(widget, fmt(model.protein) + "/" + fmt(model.proteinGoal) + "g", 16, TEXT);
  addLabel(widget, "protein", 11, MUTED);
  widget.addSpacer(4);
  if (model.stale) {
    const note = widget.addText(model.note);
    note.font = Font.mediumSystemFont(12);
    note.textColor = GOLD;
    note.lineLimit = 2;
    note.minimumScaleFactor = 0.7;
  } else {
    addValue(widget, fmt(model.caloriesRemaining), 16, leftColor(model.caloriesRemaining));
    addLabel(widget, "cal left", 11, MUTED);
  }
}

function buildMedium(widget, model) {
  widget.setPadding(14, 16, 14, 16);
  const head = widget.addStack();
  head.centerAlignContent();
  const title = head.addText("FIT TRACKER");
  title.font = Font.boldSystemFont(12);
  title.textColor = GREEN;
  head.addSpacer();
  const when = head.addText("TODAY");
  when.font = Font.mediumSystemFont(11);
  when.textColor = MUTED;
  widget.addSpacer(10);
  const row = widget.addStack();
  row.centerAlignContent();
  row.addSpacer();
  const cols = [
    { value: fmt(model.caloriesEaten) + "/" + fmt(model.calorieGoal), label: "calories", color: TEXT },
    { value: fmt(model.protein) + "/" + fmt(model.proteinGoal) + "g", label: "protein", color: TEXT }
  ];
  if (!model.stale) {
    cols.push({
      value: fmt(model.caloriesRemaining),
      label: "cal left",
      color: leftColor(model.caloriesRemaining)
    });
  }
  for (let i = 0; i < cols.length; i++) {
    if (i) row.addSpacer(12);
    const col = row.addStack();
    col.layoutVertically();
    addValue(col, cols[i].value, 16, cols[i].color);
    addLabel(col, cols[i].label, 11, MUTED);
  }
  row.addSpacer();
  if (model.stale) {
    widget.addSpacer(8);
    const note = widget.addText(model.note);
    note.font = Font.mediumSystemFont(13);
    note.textColor = GOLD;
    note.lineLimit = 2;
  }
}

async function makeWidget() {
  const widget = new ListWidget();
  paint(widget);
  let model;
  try {
    model = modelFrom(await fetchSummary());
  } catch (e) {
    model = modelFrom({ error: "network" });
  }
  const family = config.widgetFamily || "medium";
  if (family === "small") buildSmall(widget, model);
  else buildMedium(widget, model);
  return widget;
}

function errorWidget() {
  const widget = new ListWidget();
  paint(widget);
  buildSmall(widget, modelFrom({ error: "network" }));
  return widget;
}

if (typeof ListWidget !== "undefined") {
  (async () => {
    try {
      const widget = await makeWidget();
      if (config.runsInWidget) {
        Script.setWidget(widget);
      } else if (config.widgetFamily === "small") {
        await widget.presentSmall();
      } else {
        await widget.presentMedium();
      }
    } catch (e) {
      try {
        const widget = errorWidget();
        if (config.runsInWidget) Script.setWidget(widget);
      } catch (e2) {}
    }
    try { Script.complete(); } catch (e3) {}
  })();
}
