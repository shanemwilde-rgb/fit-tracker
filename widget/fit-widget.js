// Shane's Fit Tracker — Scriptable home-screen widget.
// Progress tab → iPhone Widget → Copy Script. That copy already includes your key.
// Paste over any older script. Small shows two rings, medium adds a 7-day calorie
// chart, large adds a protein chart. Tapping the widget opens the app.
// Drawn with DrawContext only — no images downloaded.

const WIDGET_KEY = "PASTE_YOUR_KEY";
const API_KEY = "AIzaSyAhtYVlq8qOKtac1MHPyfKUCGWfRiEhEYs";
const PROJECT_ID = "shane-fitness-c1e81";
const APP_URL = "https://shanemwilde-rgb.github.io/fit-tracker/";
const CALORIE_GOAL_DEFAULT = 2600;
const PROTEIN_GOAL_DEFAULT = 195;

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

function shiftYMD(ymd, delta) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!match) return "";
  const dt = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const mo = dt.getUTCMonth() + 1;
  const da = dt.getUTCDate();
  return dt.getUTCFullYear() + "-" + (mo < 10 ? "0" : "") + mo + "-" + (da < 10 ? "0" : "") + da;
}

function weekdayLetter(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!match) return "";
  const dt = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return "SMTWTFS".charAt(dt.getUTCDay());
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

function parseLast7(fields) {
  const out = [];
  const values = fields && fields.last7 && fields.last7.arrayValue && fields.last7.arrayValue.values;
  if (!values) return out;
  for (let i = 0; i < values.length && out.length < 14; i++) {
    const item = values[i];
    const map = item && item.mapValue && item.mapValue.fields;
    if (!map) continue;
    out.push({
      date: strField(map, "date").substring(0, 10),
      calories: intField(map, "calories"),
      protein: intField(map, "protein")
    });
  }
  return out;
}

function weekSeries(model) {
  const today = denverToday();
  const map = {};
  const rows = (model && model.last7) || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].date) map[rows[i].date] = rows[i];
  }
  const days = [];
  for (let back = 6; back >= 0; back--) {
    const date = shiftYMD(today, -back);
    const row = map[date];
    let calories = row ? Math.round(Number(row.calories)) : 0;
    let protein = row ? Math.round(Number(row.protein)) : 0;
    if (!isFinite(calories) || calories < 0) calories = 0;
    if (!isFinite(protein) || protein < 0) protein = 0;
    const isToday = date === today;
    if (model && model.stale && isToday) {
      calories = 0;
      protein = 0;
    }
    days.push({
      date: date,
      calories: calories,
      protein: protein,
      today: isToday,
      label: weekdayLetter(date)
    });
  }
  return days;
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
  const base = {
    caloriesEaten: 0,
    calorieGoal: CALORIE_GOAL_DEFAULT,
    protein: 0,
    proteinGoal: PROTEIN_GOAL_DEFAULT,
    caloriesRemaining: CALORIE_GOAL_DEFAULT,
    stale: true,
    note: "no meals logged yet",
    kind: "ready",
    last7: []
  };
  if (!result || result.error || !result.fields) {
    if (result && result.error === "setup") {
      base.kind = "setup";
      base.note = "Copy the script from the app";
    } else if (result && result.error === "rules") {
      base.kind = "rules";
      base.note = "Publish Firestore rules";
    } else if (result && result.error === "network") {
      base.kind = "offline";
      base.note = "Couldn't refresh";
    }
    return base;
  }
  const fields = result.fields;
  const goal = positiveInt(numField(fields, "calorieGoal"), CALORIE_GOAL_DEFAULT);
  const pGoal = positiveInt(numField(fields, "proteinGoal"), PROTEIN_GOAL_DEFAULT);
  const date = strField(fields, "date").substring(0, 10);
  const last7 = parseLast7(fields);
  if (!date || date !== denverToday()) {
    base.calorieGoal = goal;
    base.proteinGoal = pGoal;
    base.caloriesRemaining = goal;
    base.last7 = last7;
    base.note = "no meals logged yet";
    return base;
  }
  return {
    caloriesEaten: intField(fields, "caloriesEaten"),
    calorieGoal: goal,
    protein: intField(fields, "protein"),
    proteinGoal: pGoal,
    caloriesRemaining: intField(fields, "caloriesRemaining"),
    stale: false,
    note: "",
    kind: "ready",
    last7: last7
  };
}

function mixHex(a, b, t) {
  const parse = function (hex) {
    const h = String(hex).replace("#", "");
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  };
  const A = parse(a);
  const B = parse(b);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(A[i] + (B[i] - A[i]) * t);
    out += ("0" + v.toString(16)).slice(-2);
  }
  return out;
}

function palette(dark) {
  const hex = dark ? {
    bgTop: "#1b2631",
    bgBottom: "#10151a",
    text: "#f4f7f8",
    muted: "#93a0ad",
    track: "#314152",
    cal: "#3dcf8e",
    pro: "#7aa2ff",
    accent: "#c5d0ff",
    warn: "#f0a36a",
    ok: "#8ee0b2",
    low: "#f0c27a",
    line: "#9aafc2",
    todayStroke: "#f7fbff",
    divider: "#2c3a48"
  } : {
    bgTop: "#fbfcfe",
    bgBottom: "#e6eef7",
    text: "#172033",
    muted: "#5c6d7e",
    track: "#d3ddea",
    cal: "#1c9a5e",
    pro: "#3a6fe0",
    accent: "#5b6ed4",
    warn: "#d4843c",
    ok: "#1c9a5e",
    low: "#c4842a",
    line: "#7f96ad",
    todayStroke: "#172033",
    divider: "#d3ddea"
  };
  const out = { hex: hex, dark: !!dark };
  const names = Object.keys(hex);
  for (let i = 0; i < names.length; i++) out[names[i]] = new Color(hex[names[i]]);
  return out;
}

function progressHex(kind, eaten, goal, pal) {
  const over = goal > 0 && eaten > goal;
  const hit = goal > 0 && eaten >= goal;
  if (kind === "calories" && over) return pal.hex.warn;
  if (hit) return pal.hex.accent;
  return kind === "protein" ? pal.hex.pro : pal.hex.cal;
}

function faceSize(family) {
  if (family === "small") return { w: 158, h: 158 };
  if (family === "large") return { w: 338, h: 354 };
  return { w: 338, h: 158 };
}

function text(dc, value, x, y, w, h, font, color, align) {
  dc.setFont(font);
  dc.setTextColor(color);
  if (align === "center") dc.setTextAlignedCenter();
  else if (align === "right") dc.setTextAlignedRight();
  else dc.setTextAlignedLeft();
  dc.drawTextInRect(String(value), new Rect(x, y, w, h));
}

function paintBackground(dc, w, h, pal) {
  const steps = 28;
  for (let i = 0; i < steps; i++) {
    const hex = mixHex(pal.hex.bgTop, pal.hex.bgBottom, steps === 1 ? 0 : i / (steps - 1));
    dc.setFillColor(new Color(hex));
    const y0 = Math.floor(h * i / steps);
    const y1 = Math.floor(h * (i + 1) / steps);
    dc.fillRect(new Rect(0, y0, w, (y1 - y0) + 1));
  }
}

function strokeOval(dc, cx, cy, r, width, color) {
  dc.setStrokeColor(color);
  dc.setLineWidth(width);
  dc.strokeEllipse(new Rect(cx - r, cy - r, r * 2, r * 2));
}

function strokeArc(dc, cx, cy, r, width, sweep, color) {
  if (sweep <= 0) return;
  const start = -Math.PI / 2;
  const end = start + Math.min(sweep, 1) * Math.PI * 2;
  const steps = Math.max(16, Math.ceil(Math.min(sweep, 1) * 80));
  const path = new Path();
  for (let i = 0; i <= steps; i++) {
    const angle = start + (end - start) * (i / steps);
    const point = new Point(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    if (i === 0) path.move(point);
    else path.addLine(point);
  }
  dc.setStrokeColor(color);
  dc.setLineWidth(width);
  dc.addPath(path);
  dc.strokePath();
  dc.setFillColor(color);
  const cap = width / 2;
  const ends = [start, end];
  for (let i = 0; i < ends.length; i++) {
    const angle = ends[i];
    dc.fillEllipse(new Rect(
      cx + r * Math.cos(angle) - cap,
      cy + r * Math.sin(angle) - cap,
      width,
      width
    ));
  }
}

function drawRing(dc, cx, cy, r, width, eaten, goal, color, track) {
  strokeOval(dc, cx, cy, r, width, track);
  let sweep = goal > 0 ? eaten / goal : 0;
  if (eaten > 0 && sweep < 0.03) sweep = 0.03;
  if (sweep > 0) strokeArc(dc, cx, cy, r, width, sweep, color);
}

function paintRingPair(dc, x, y, width, pal, model, radius) {
  const gap = radius > 30 ? 18 : 10;
  const diameter = radius * 2;
  const total = diameter * 2 + gap;
  const x0 = x + Math.max(0, (width - total) / 2);
  const cy = y + radius;
  const eatenC = model.stale ? 0 : model.caloriesEaten;
  const eatenP = model.stale ? 0 : model.protein;
  const rings = [
    { cx: x0 + radius, eaten: eatenC, goal: model.calorieGoal, kind: "calories" },
    { cx: x0 + diameter + gap + radius, eaten: eatenP, goal: model.proteinGoal, kind: "protein" }
  ];
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const hex = progressHex(ring.kind, ring.eaten, ring.goal, pal);
    const stroke = radius > 30 ? 9 : 7;
    drawRing(dc, ring.cx, cy, radius - 1, stroke, ring.eaten, ring.goal, new Color(hex), pal.track);
    const label = fmt(ring.eaten);
    const fontSize = label.length >= 5 ? Math.max(11, radius * 0.42) : Math.max(13, radius * 0.52);
    text(dc, label, ring.cx - radius + 6, cy - fontSize * 0.78, (radius - 6) * 2, fontSize + 3, Font.boldRoundedSystemFont(fontSize), pal.text, "center");
    const unit = ring.kind === "protein" ? "protein" : "calories";
    text(dc, unit, ring.cx - radius, cy + 1, radius * 2, 11, Font.mediumSystemFont(8), pal.muted, "center");
    const goalText = ring.kind === "protein" ? fmt(ring.goal) + "g" : fmt(ring.goal);
    text(dc, goalText, ring.cx - radius, cy + radius + 6, radius * 2, 13, Font.mediumSystemFont(10), new Color(hex), "center");
  }
}

function remainingTone(model, pal) {
  const n = Math.round(Number(model.caloriesRemaining));
  const value = isFinite(n) ? n : 0;
  if (model.stale) {
    return { big: fmt(model.calorieGoal), sub: "cal left", note: "no meals logged yet", color: pal.muted };
  }
  if (value < 0) return { big: fmt(Math.abs(value)), sub: "cal over", note: "", color: pal.warn };
  if (value === 0) return { big: "0", sub: "cal left", note: "", color: pal.accent };
  return { big: fmt(value), sub: "cal left", note: "", color: value <= 200 ? pal.low : pal.ok };
}

function dashHLine(dc, x, y, w, color) {
  dc.setStrokeColor(color);
  dc.setLineWidth(1.25);
  const dash = 4;
  const gap = 3;
  let i = 0;
  while (i < w) {
    const len = Math.min(dash, w - i);
    const path = new Path();
    path.move(new Point(x + i, y));
    path.addLine(new Point(x + i + len, y));
    dc.addPath(path);
    dc.strokePath();
    i += dash + gap;
  }
}

function drawBars(dc, x, y, w, h, days, goal, pal, field) {
  const titleH = 15;
  const labelH = 13;
  const plotY = y + titleH;
  const plotH = Math.max(20, h - titleH - labelH);
  const values = [];
  let maxV = goal > 0 ? goal : 1;
  for (let i = 0; i < days.length; i++) {
    const v = field === "protein" ? days[i].protein : days[i].calories;
    values.push(v);
    if (v > maxV) maxV = v;
  }
  const scale = maxV * 1.22;
  const gap = 4;
  const barW = (w - gap * (days.length + 1)) / days.length;
  const title = field === "protein" ? "Protein" : "Calories";
  text(dc, title, x, y, w * 0.52, titleH, Font.mediumSystemFont(10), pal.muted, "left");
  text(dc, fmt(goal), x + w * 0.48, y, w * 0.52, titleH, Font.mediumSystemFont(10), pal.line, "right");
  for (let i = 0; i < days.length; i++) {
    const bx = x + gap + i * (barW + gap);
    dc.setFillColor(new Color(mixHex(pal.hex.track, pal.hex.bgBottom, pal.dark ? 0.35 : 0.45)));
    dc.fillRect(new Rect(bx, plotY + plotH - 2, barW, 2));
    const v = values[i];
    if (v > 0 && scale > 0) {
      const bh = Math.max(3, (v / scale) * plotH);
      const hex = progressHex(field, v, goal, pal);
      const shown = days[i].today ? hex : mixHex(hex, pal.hex.bgBottom, 0.16);
      dc.setFillColor(new Color(shown));
      dc.fillRect(new Rect(bx, plotY + plotH - bh, barW, bh));
      if (days[i].today) {
        dc.setStrokeColor(pal.todayStroke);
        dc.setLineWidth(1.4);
        dc.strokeRect(new Rect(bx + 0.4, plotY + plotH - bh + 0.4, Math.max(1, barW - 0.8), Math.max(1, bh - 0.8)));
      }
    }
    text(
      dc,
      days[i].label,
      bx - 1,
      plotY + plotH + 1,
      barW + 2,
      labelH,
      days[i].today ? Font.boldSystemFont(9) : Font.mediumSystemFont(9),
      days[i].today ? pal.text : pal.muted,
      "center"
    );
  }
  if (goal > 0 && scale > 0) {
    const gy = plotY + plotH - (goal / scale) * plotH;
    dashHLine(dc, x + 1, gy, w - 2, pal.line);
  }
}

function paintMessage(dc, w, h, pal, model) {
  text(dc, "FIT TRACKER", 16, h * 0.28, w - 32, 16, Font.boldSystemFont(11), pal.cal, "center");
  text(dc, model.note || "Open Fit Tracker", 18, h * 0.28 + 26, w - 36, 52, Font.boldRoundedSystemFont(w < 200 ? 15 : 18), pal.text, "center");
  const sub = model.kind === "rules" ? "Then open the app once" : "Tap to open Fit Tracker";
  text(dc, sub, 18, h * 0.28 + 82, w - 36, 18, Font.mediumSystemFont(12), pal.muted, "center");
}

function paintSmall(dc, w, h, pal, model) {
  paintRingPair(dc, 0, 12, w, pal, model, 29);
  const rem = remainingTone(model, pal);
  if (rem.note) text(dc, rem.note, 8, 96, w - 16, 13, Font.mediumSystemFont(10), pal.warn, "center");
  text(dc, rem.big, 8, rem.note ? 110 : 112, w - 16, 26, Font.boldRoundedSystemFont(24), rem.color, "center");
  text(dc, rem.sub, 8, rem.note ? 136 : 138, w - 16, 14, Font.mediumSystemFont(11), pal.muted, "center");
}

function paintMedium(dc, w, h, pal, model) {
  dc.setFillColor(pal.divider);
  dc.fillRect(new Rect(150, 18, 1, h - 36));
  paintRingPair(dc, 0, 8, 148, pal, model, 25);
  const rem = remainingTone(model, pal);
  text(dc, rem.big, 6, rem.note ? 102 : 108, 140, 24, Font.boldRoundedSystemFont(22), rem.color, "center");
  text(dc, rem.sub, 6, rem.note ? 124 : 130, 140, 13, Font.mediumSystemFont(10), pal.muted, "center");
  if (rem.note) text(dc, rem.note, 6, 142, 140, 12, Font.mediumSystemFont(8), pal.warn, "center");
  drawBars(dc, 160, 10, w - 172, h - 18, weekSeries(model), model.calorieGoal, pal, "calories");
}

function paintLarge(dc, w, h, pal, model) {
  const rem = remainingTone(model, pal);
  text(dc, "FIT TRACKER", 16, 14, 170, 16, Font.boldSystemFont(12), pal.cal, "left");
  text(dc, rem.big + " " + rem.sub, 150, 14, w - 166, 16, Font.boldSystemFont(13), rem.color, "right");
  if (rem.note) text(dc, rem.note, 16, 34, w - 32, 14, Font.mediumSystemFont(11), pal.warn, "left");
  const ringY = rem.note ? 50 : 40;
  paintRingPair(dc, 0, ringY, w, pal, model, 34);
  const days = weekSeries(model);
  const chartY = ringY + 86;
  const chartH = Math.floor((h - chartY - 14) / 2);
  drawBars(dc, 16, chartY, w - 32, chartH, days, model.calorieGoal, pal, "calories");
  drawBars(dc, 16, chartY + chartH + 6, w - 32, chartH, days, model.proteinGoal, pal, "protein");
}

function renderFace(family, model, dark) {
  const fam = family === "small" || family === "large" ? family : "medium";
  const size = faceSize(fam);
  const dc = new DrawContext();
  dc.opaque = true;
  dc.respectScreenScale = true;
  dc.size = new Size(size.w, size.h);
  const pal = palette(true);
  paintBackground(dc, size.w, size.h, pal);
  if (model && model.kind && model.kind !== "ready") paintMessage(dc, size.w, size.h, pal, model);
  else if (fam === "small") paintSmall(dc, size.w, size.h, pal, model);
  else if (fam === "large") paintLarge(dc, size.w, size.h, pal, model);
  else paintMedium(dc, size.w, size.h, pal, model);
  dc._face = fam;
  return dc.getImage();
}

function isDarkMode() {
  // The widget stays on the dark palette in both iPhone appearance modes.
  return true;
}

async function makeWidget() {
  const family = (config.widgetFamily === "small" || config.widgetFamily === "large" || config.widgetFamily === "medium")
    ? config.widgetFamily
    : "medium";
  let model;
  try {
    model = modelFrom(await fetchSummary());
  } catch (e) {
    model = modelFrom({ error: "network" });
  }
  const widget = new ListWidget();
  widget.url = APP_URL;
  try { widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000); } catch (e) {}
  let image = null;
  try { image = renderFace(family, model, isDarkMode()); } catch (e) { image = null; }
  try {
    const pal = palette(isDarkMode());
    widget.backgroundColor = pal.bgBottom;
  } catch (e) {}
  if (!image) {
    const line = widget.addText((model && model.note) || "Open Fit Tracker");
    line.font = Font.mediumSystemFont(14);
    try { line.textColor = palette(isDarkMode()).text; } catch (e2) {}
    return widget;
  }
  try { widget.setPadding(0, 0, 0, 0); } catch (e) {}
  const el = widget.addImage(image);
  const size = faceSize(family === "small" || family === "large" ? family : "medium");
  try { el.imageSize = new Size(size.w, size.h); } catch (e) {}
  try { el.centerAlignImage(); } catch (e) {}
  return widget;
}

if (typeof ListWidget !== "undefined") {
  (async () => {
    try {
      const widget = await makeWidget();
      if (config.runsInWidget) Script.setWidget(widget);
      else if (config.widgetFamily === "small") await widget.presentSmall();
      else if (config.widgetFamily === "large") await widget.presentLarge();
      else await widget.presentMedium();
    } catch (e) {
      try {
        const widget = new ListWidget();
        widget.url = APP_URL;
        widget.addText("Publish Firestore rules");
        if (config.runsInWidget) Script.setWidget(widget);
      } catch (e2) {}
    }
    try { Script.complete(); } catch (e3) {}
  })();
}
