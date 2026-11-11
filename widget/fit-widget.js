// Shane's Fit Tracker — Scriptable home-screen widget.
// Progress tab → iPhone Widget → Copy Script. That copy already includes your key.
// Paste over any older script, then run it in the Scriptable app (not on the
// home screen) and choose Set transparent background. Small shows calorie and
// protein rings plus fat and carb bars. Medium and large add the week chart.
// Tapping the widget opens the app. Drawn with DrawContext only.

const WIDGET_KEY = "PASTE_YOUR_KEY";
const API_KEY = "AIzaSyAhtYVlq8qOKtac1MHPyfKUCGWfRiEhEYs";
const PROJECT_ID = "shane-fitness-c1e81";
const APP_URL = "https://shanemwilde-rgb.github.io/fit-tracker/";
const CALORIE_GOAL_DEFAULT = 2600;
const PROTEIN_GOAL_DEFAULT = 195;
// Same numbers as the app's PROF_DEFAULTS. Used only when the widget doc has no goal yet.
const CARB_GOAL_DEFAULT = 270;
const FAT_GOAL_DEFAULT = 75;

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
      protein: intField(map, "protein"),
      carbs: intField(map, "carbs"),
      fat: intField(map, "fat")
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
    let carbs = row ? Math.round(Number(row.carbs)) : 0;
    let fat = row ? Math.round(Number(row.fat)) : 0;
    if (!isFinite(calories) || calories < 0) calories = 0;
    if (!isFinite(protein) || protein < 0) protein = 0;
    if (!isFinite(carbs) || carbs < 0) carbs = 0;
    if (!isFinite(fat) || fat < 0) fat = 0;
    const isToday = date === today;
    if (model && model.stale && isToday) {
      calories = 0;
      protein = 0;
      carbs = 0;
      fat = 0;
    }
    days.push({
      date: date,
      calories: calories,
      protein: protein,
      carbs: carbs,
      fat: fat,
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
    carbs: 0,
    carbsGoal: CARB_GOAL_DEFAULT,
    fat: 0,
    fatGoal: FAT_GOAL_DEFAULT,
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
  const cGoal = positiveInt(numField(fields, "carbsGoal"), CARB_GOAL_DEFAULT);
  const fGoal = positiveInt(numField(fields, "fatGoal"), FAT_GOAL_DEFAULT);
  const date = strField(fields, "date").substring(0, 10);
  const last7 = parseLast7(fields);
  if (!date || date !== denverToday()) {
    base.calorieGoal = goal;
    base.proteinGoal = pGoal;
    base.carbsGoal = cGoal;
    base.fatGoal = fGoal;
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
    carbs: intField(fields, "carbs"),
    carbsGoal: cGoal,
    fat: intField(fields, "fat"),
    fatGoal: fGoal,
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
    divider: "#2c3a48",
    fat: "#ff8a4a",
    carb: "#f0c14a"
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
    divider: "#d3ddea",
    fat: "#e06a2f",
    carb: "#c99612"
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
  if (align === "center") dc.setTextAlignedCenter();
  else if (align === "right") dc.setTextAlignedRight();
  else dc.setTextAlignedLeft();
  dc.setTextColor(new Color("#000000", 0.55));
  dc.drawTextInRect(String(value), new Rect(x + 0.7, y + 0.9, w, h));
  dc.setTextColor(color);
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

function drawMacroBar(dc, x, y, w, label, eaten, goal, colorHex, pal) {
  const frac = goal > 0 ? Math.min(1, Math.max(0, eaten / goal)) : 0;
  text(dc, label + " " + fmt(eaten) + "/" + fmt(goal) + "g", x, y, w, 11, Font.mediumSystemFont(9), pal.text, "left");
  const trackY = y + 12;
  dc.setFillColor(new Color("#000000", 0.35));
  dc.fillRect(new Rect(x, trackY, w, 5));
  if (frac > 0) {
    dc.setFillColor(new Color(colorHex));
    dc.fillRect(new Rect(x, trackY, Math.max(3, w * frac), 5));
  }
}

function macroHex(kind, eaten, goal, pal) {
  if (goal > 0 && eaten > goal) return pal.hex.warn;
  return kind === "fat" ? pal.hex.fat : pal.hex.carb;
}

function paintMacroBars(dc, x, y, w, pal, model, stacked) {
  const fatEaten = model.stale ? 0 : (model.fat || 0);
  const carbEaten = model.stale ? 0 : (model.carbs || 0);
  const fatColor = macroHex("fat", fatEaten, model.fatGoal, pal);
  const carbColor = macroHex("carbs", carbEaten, model.carbsGoal, pal);
  if (stacked) {
    drawMacroBar(dc, x, y, w, "Fat", fatEaten, model.fatGoal, fatColor, pal);
    drawMacroBar(dc, x, y + 20, w, "Carbs", carbEaten, model.carbsGoal, carbColor, pal);
    return;
  }
  const gap = 8;
  const col = (w - gap) / 2;
  drawMacroBar(dc, x, y, col, "F", fatEaten, model.fatGoal, fatColor, pal);
  drawMacroBar(dc, x + col + gap, y, col, "C", carbEaten, model.carbsGoal, carbColor, pal);
}

function paintSampleWallpaper(dc, w, h) {
  dc.setFillColor(new Color("#2f6fdb"));
  dc.fillRect(new Rect(0, 0, w, h));
  dc.setFillColor(new Color("#f2c14e"));
  dc.fillEllipse(new Rect(-30, -40, w * 0.85, h * 0.7));
  dc.setFillColor(new Color("#e25b45"));
  dc.fillEllipse(new Rect(w * 0.35, h * 0.25, w * 0.8, h * 0.85));
  dc.setFillColor(new Color("#1f8a70"));
  dc.fillEllipse(new Rect(w * 0.05, h * 0.55, w * 0.55, h * 0.6));
}

function paintScrim(dc, w, h, pal) {
  dc.setFillColor(new Color(pal.dark ? "#0c1218" : "#f4f7fb", pal.dark ? 0.4 : 0.58));
  dc.fillRect(new Rect(0, 0, w, h));
}

function paintMessage(dc, w, h, pal, model) {
  text(dc, "FIT TRACKER", 16, h * 0.28, w - 32, 16, Font.boldSystemFont(11), pal.cal, "center");
  text(dc, model.note || "Open Fit Tracker", 18, h * 0.28 + 26, w - 36, 52, Font.boldRoundedSystemFont(w < 200 ? 15 : 18), pal.text, "center");
  const sub = model.kind === "rules" ? "Then open the app once" : "Tap to open Fit Tracker";
  text(dc, sub, 18, h * 0.28 + 82, w - 36, 18, Font.mediumSystemFont(12), pal.muted, "center");
}

function paintSmall(dc, w, h, pal, model) {
  paintRingPair(dc, 0, 2, w, pal, model, 24);
  paintMacroBars(dc, 12, 78, w - 24, pal, model, false);
  const rem = remainingTone(model, pal);
  if (rem.note) text(dc, rem.note, 8, 100, w - 16, 12, Font.mediumSystemFont(9), pal.warn, "center");
  text(dc, rem.big, 8, rem.note ? 112 : 104, w - 16, 24, Font.boldRoundedSystemFont(22), rem.color, "center");
  text(dc, rem.sub, 8, rem.note ? 136 : 128, w - 16, 14, Font.mediumSystemFont(11), pal.muted, "center");
}

function paintMedium(dc, w, h, pal, model) {
  dc.setFillColor(new Color("#000000", 0.18));
  dc.fillRect(new Rect(150, 14, 1, h - 28));
  paintRingPair(dc, 0, 2, 148, pal, model, 22);
  const rem = remainingTone(model, pal);
  text(dc, rem.big, 4, 70, 142, 20, Font.boldRoundedSystemFont(18), rem.color, "center");
  text(dc, rem.note || rem.sub, 4, 88, 142, 12, Font.mediumSystemFont(9), rem.note ? pal.warn : pal.muted, "center");
  paintMacroBars(dc, 10, 104, 132, pal, model, true);
  drawBars(dc, 158, 6, w - 168, h - 12, weekSeries(model), model.calorieGoal, pal, "calories");
}

function paintLarge(dc, w, h, pal, model) {
  const rem = remainingTone(model, pal);
  text(dc, "FIT TRACKER", 16, 12, 160, 16, Font.boldSystemFont(12), pal.cal, "left");
  text(dc, rem.big + " " + rem.sub, 150, 12, w - 166, 16, Font.boldSystemFont(13), rem.color, "right");
  if (rem.note) text(dc, rem.note, 16, 30, w - 32, 13, Font.mediumSystemFont(11), pal.warn, "left");
  const ringY = rem.note ? 44 : 32;
  paintRingPair(dc, 0, ringY, w, pal, model, 30);
  paintMacroBars(dc, 16, ringY + 78, w - 32, pal, model, false);
  const days = weekSeries(model);
  const chartY = ringY + 104;
  const chartH = Math.floor((h - chartY - 12) / 2);
  drawBars(dc, 16, chartY, w - 32, chartH, days, model.calorieGoal, pal, "calories");
  drawBars(dc, 16, chartY + chartH + 4, w - 32, chartH, days, model.proteinGoal, pal, "protein");
}

function renderFace(family, model, dark, opts) {
  opts = opts || {};
  const fam = family === "small" || family === "large" ? family : "medium";
  const size = faceSize(fam);
  const showWallpaper = !!opts.sampleWallpaper;
  const transparent = !!opts.transparent || showWallpaper;
  const dc = new DrawContext();
  dc.opaque = !transparent;
  dc.respectScreenScale = true;
  dc.size = new Size(size.w, size.h);
  const pal = palette(!!dark);
  if (showWallpaper) paintSampleWallpaper(dc, size.w, size.h);
  else if (!transparent) paintBackground(dc, size.w, size.h, pal);
  // A full-widget tint reads as a pale card and hides the wallpaper.
  // Only the old preview path asks for that scrim. The live widget never does.
  if (opts.scrim) paintScrim(dc, size.w, size.h, pal);
  if (model && model.kind && model.kind !== "ready") paintMessage(dc, size.w, size.h, pal, model);
  else if (fam === "small") paintSmall(dc, size.w, size.h, pal, model);
  else if (fam === "large") paintLarge(dc, size.w, size.h, pal, model);
  else paintMedium(dc, size.w, size.h, pal, model);
  dc._face = fam;
  return dc.getImage();
}

function isDarkMode() {
  try { return !!Device.isUsingDarkAppearance(); } catch (e) { return true; }
}

// Crop table: published iOS home-screen widget measurements used by Scriptable's
// standard transparent-background method (Max Zeryck, MIT). Keyed by screenshot height in pixels.
// https://gist.github.com/mzeryck/3a97ccd1e059b3afa3c6666d27a496c9
function phoneTable() {
  return {
    "2868": { text: { small: 510, medium: 1092, large: 1146, left: 114, right: 696, top: 276, middle: 912, bottom: 1548 }, notext: { small: 530, medium: 1138, large: 1136, left: 91, right: 699, top: 276, middle: 882, bottom: 1488 } },
    "2796": { text: { small: 510, medium: 1092, large: 1146, left: 98, right: 681, top: 252, middle: 888, bottom: 1524 }, notext: { small: 530, medium: 1139, large: 1136, left: 75, right: 684, top: 252, middle: 858, bottom: 1464 } },
    "2622": { text: { small: 486, medium: 1032, large: 1098, left: 87, right: 633, top: 261, middle: 872, bottom: 1485 }, notext: { small: 495, medium: 1037, large: 1035, left: 84, right: 626, top: 270, middle: 810, bottom: 1350 } },
    "2556": { text: { small: 474, medium: 1017, large: 1062, left: 81, right: 624, top: 240, middle: 828, bottom: 1416 }, notext: { small: 495, medium: 1047, large: 1047, left: 66, right: 618, top: 243, middle: 795, bottom: 1347 } },
    "1334": { text: { small: 296, medium: 642, large: 648, left: 54, right: 400, top: 60, middle: 412, bottom: 764 }, notext: { small: 309, medium: 667, large: 667, left: 41, right: 399, top: 67, middle: 425, bottom: 783 } },
    "2778": { small: 510, medium: 1092, large: 1146, left: 96, right: 678, top: 246, middle: 882, bottom: 1518 },
    "2688": { small: 507, medium: 1080, large: 1137, left: 81, right: 654, top: 228, middle: 858, bottom: 1488 },
    "2532": { small: 474, medium: 1014, large: 1062, left: 78, right: 618, top: 231, middle: 819, bottom: 1407 },
    "2436": { x: { small: 465, medium: 987, large: 1035, left: 69, right: 591, top: 213, middle: 783, bottom: 1353 }, mini: { small: 465, medium: 987, large: 1035, left: 69, right: 591, top: 231, middle: 801, bottom: 1371 } },
    "1792": { small: 338, medium: 720, large: 758, left: 55, right: 437, top: 159, middle: 579, bottom: 999 },
    "1624": { small: 310, medium: 658, large: 690, left: 46, right: 394, top: 142, middle: 522, bottom: 902 },
    "2208": { small: 471, medium: 1044, large: 1071, left: 99, right: 672, top: 114, middle: 696, bottom: 1278 },
    "2001": { small: 444, medium: 963, large: 972, left: 81, right: 600, top: 90, middle: 618, bottom: 1146 },
    "1136": { small: 282, medium: 584, large: 622, left: 30, right: 332, top: 59, middle: 399, bottom: 399 },
    // iPhone Air: 420×912 pt @3x = 1260×2736. Frames are the 2796 (Plus / Pro Max class) measurements scaled by 2736/2796.
    "2736": { text: { small: 499, medium: 1069, large: 1121, left: 96, right: 666, top: 247, middle: 869, bottom: 1491 }, notext: { small: 519, medium: 1115, large: 1112, left: 73, right: 669, top: 247, middle: 840, bottom: 1433 } },
    // iPhone 13 mini: 360×780 pt @3x = 1080×2340. Scaled from the 2436 mini measurements.
    "2340": { small: 447, medium: 948, large: 994, left: 66, right: 568, top: 222, middle: 769, bottom: 1317 }
  };
}

// Pixel height → phones that share it (points × scale):
// 2868: 16/17/18 Pro Max (440×956 @3)
// 2796: 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus (430×932 @3)
// 2736: iPhone Air (420×912 @3)
// 2622: 16 Pro, 17, 17 Pro, 18 Pro (402×874 @3)
// 2556: 14 Pro, 15, 15 Pro, 16 (393×852 @3)
// 2532: 12, 12 Pro, 13, 13 Pro, 14, 16e, 17e (390×844 @3)
// 2436: 11 Pro / XS / X, or 12 mini (375×812 @3)
// 2340: 13 mini (360×780 @3)
// 2778: 12 Pro Max, 13 Pro Max, 14 Plus (428×926 @3)
// 2688: 11 Pro Max, XS Max (414×896 @3)
// 1792: 11, XR (414×896 @2)
// 1334: SE 2/3, 8, 7, 6s (375×667 @2)
// 1136: SE 1 (320×568 @2)

function deviceScaleForPixels(pixelHeight) {
  const h = String(Math.round(Number(pixelHeight) || 0));
  if (h === "1334" || h === "1136" || h === "1792" || h === "1624") return 2;
  return 3;
}

function classifyScreenshot(width, height) {
  const table = phoneTable();
  const W = Math.round(Number(width) || 0);
  const H = Math.round(Number(height) || 0);
  const known = function (n) { return !!table[String(Math.round(n))]; };
  if (known(H) || known(W)) {
    if (!known(H) && known(W) && W > H) return { kind: "sideways", width: W, height: H };
    return { kind: "pixels", width: W, height: H };
  }
  if (known(H / 2) || known(W / 2)) return { kind: "doubled", width: W, height: H };
  const scales = [3, 2];
  for (let i = 0; i < scales.length; i++) {
    const s = scales[i];
    if (known(H * s) || known(W * s)) {
      return { kind: "points", width: W, height: H, scale: s, pixelWidth: Math.round(W * s), pixelHeight: Math.round(H * s) };
    }
  }
  return { kind: "unknown", width: W, height: H };
}

function lookupPhone(height, width) {
  const shot = classifyScreenshot(width, height);
  if (!shot || shot.kind === "unknown" || shot.kind === "doubled" || shot.kind === "sideways") return null;
  const table = phoneTable();
  const pixelH = shot.kind === "points" ? shot.pixelHeight : shot.height;
  const pixelW = shot.kind === "points" ? shot.pixelWidth : shot.width;
  const entry = table[String(pixelH)] || table[String(pixelW)];
  if (!entry) return null;
  const matched = table[String(pixelH)] ? pixelH : pixelW;
  return { height: String(matched), entry: entry, shot: shot, scale: deviceScaleForPixels(matched) };
}

function cropPlacement(reportedW, reportedH, crop, deviceScale) {
  const shot = classifyScreenshot(reportedW, reportedH);
  if (!shot || shot.kind === "unknown" || shot.kind === "doubled" || shot.kind === "sideways") return shot;
  const scale = deviceScale || (shot.kind === "points" ? shot.scale : deviceScaleForPixels(shot.height));
  const imageIsPixels = shot.kind === "pixels";
  return {
    kind: shot.kind,
    scale: scale,
    contextW: crop.w / scale,
    contextH: crop.h / scale,
    destX: -crop.x / scale,
    destY: -crop.y / scale,
    destW: imageIsPixels ? reportedW / scale : reportedW,
    destH: imageIsPixels ? reportedH / scale : reportedH,
    pixelW: crop.w,
    pixelH: crop.h
  };
}

function resolvePhone(entry, choices) {
  choices = choices || {};
  if (!entry) return null;
  if (entry.x || entry.mini) return entry[choices.model === "mini" ? "mini" : "x"] || entry.x || entry.mini;
  if (entry.text || entry.notext) return entry[choices.icons === "notext" ? "notext" : "text"] || entry.text || entry.notext;
  if (entry.small) return entry;
  return null;
}

function cropFor(spec, size, position) {
  const words = String(position || "top").toLowerCase().split(/[^a-z]+/);
  let row = words[0] || "top";
  const right = words.indexOf("right") !== -1;
  if (size === "large" && (row === "bottom" || row === "middle")) row = "middle";
  if (row !== "top" && row !== "middle" && row !== "bottom") row = "top";
  return {
    x: size === "small" ? (right ? spec.right : spec.left) : spec.left,
    y: spec[row],
    w: size === "small" ? spec.small : spec.medium,
    h: size === "large" ? spec.large : spec.small
  };
}

function screenScale() {
  try {
    if (typeof Device !== "undefined" && Device.screenScale) return Device.screenScale();
  } catch (e) {}
  return 3;
}

function cropWallpaper(img, crop, deviceScale) {
  const place = cropPlacement(img.size.width, img.size.height, crop, deviceScale || screenScale());
  if (!place || place.kind === "unknown" || place.kind === "doubled") return null;
  const draw = new DrawContext();
  // Point size × screen scale = crop pixels, so the widget does not scale the photo down.
  draw.opaque = true;
  draw.respectScreenScale = true;
  draw.size = new Size(place.contextW, place.contextH);
  const rect = new Rect(place.destX, place.destY, place.destW, place.destH);
  if (draw.drawImageInRect) draw.drawImageInRect(img, rect);
  else draw.drawImageAtPoint(img, new Point(place.destX, place.destY));
  return draw.getImage();
}

function screenshotHelp(shot) {
  const how = "Long-press the home screen until the icons jiggle. Swipe to the last page. That page must be empty, with no widgets on it. Take a normal screenshot (side button and volume up). If this widget is already in the photo, it will look doubled.";
  const w = shot ? shot.width : 0;
  const h = shot ? shot.height : 0;
  if (shot && shot.kind === "doubled") {
    return "This photo is " + w + "×" + h + " pixels, about twice a normal iPhone screenshot, so the crop would be blurry and doubled. " + how;
  }
  if (shot && shot.kind === "sideways") {
    return "This photo is sideways (" + w + "×" + h + "). Hold the phone upright, in jiggle mode, on the empty page, and take the screenshot again. " + how;
  }
  return "This photo is " + w + "×" + h + " pixels, which is not a known iPhone screen. " + how;
}

function bgName(family) {
  return "fit-tracker-bg-" + family + ".png";
}

function openStorage() {
  try {
    const cloud = FileManager.iCloud();
    const dir = cloud.documentsDirectory();
    const probe = cloud.joinPath(dir, ".fit-tracker-probe");
    cloud.writeString(probe, "1");
    try { cloud.remove(probe); } catch (e) {}
    return { fm: cloud, icloud: true };
  } catch (e) {
    return { fm: FileManager.local(), icloud: false };
  }
}

function bgPath(store, family) {
  return store.fm.joinPath(store.fm.documentsDirectory(), bgName(family));
}

async function loadBackground(family) {
  try {
    const store = openStorage();
    const path = bgPath(store, family);
    if (!store.fm.fileExists(path)) return null;
    if (store.icloud && store.fm.downloadFileFromiCloud) {
      try { await store.fm.downloadFileFromiCloud(path); } catch (e) {}
    }
    return store.fm.readImage(path);
  } catch (e) { return null; }
}

function backgroundExists(family) {
  try {
    const store = openStorage();
    return store.fm.fileExists(bgPath(store, family));
  } catch (e) { return false; }
}

function clearBackgrounds() {
  const families = ["small", "medium", "large"];
  try {
    const store = openStorage();
    for (let i = 0; i < families.length; i++) {
      const path = bgPath(store, families[i]);
      if (store.fm.fileExists(path)) store.fm.remove(path);
    }
  } catch (e) {}
}

async function choose(title, message, options) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  for (let i = 0; i < options.length; i++) alert.addAction(options[i].label || options[i]);
  alert.addCancelAction("Cancel");
  const index = await alert.presentAlert();
  if (index == null || index < 0 || index >= options.length) return null;
  return options[index].value || options[index];
}

async function setupBackground() {
  const ready = await choose(
    "Empty page, jiggle mode",
    "Long-press the home screen until the icons jiggle. Swipe to the last page. It must be empty, with no widgets. Take a screenshot, then come back. A page that already shows this widget will look doubled.",
    ["Choose screenshot"]
  );
  if (!ready) return;
  const img = await Photos.fromLibrary();
  const shot = classifyScreenshot(img.size.width, img.size.height);
  if (!shot || shot.kind === "unknown" || shot.kind === "doubled" || shot.kind === "sideways") {
    await choose("Use a different screenshot", screenshotHelp(shot), ["OK"]);
    return;
  }
  const found = lookupPhone(img.size.height, img.size.width);
  if (!found) {
    await choose("Use a different screenshot", screenshotHelp(shot), ["OK"]);
    return;
  }
  const choices = {};
  if (found.entry.x || found.entry.mini) {
    const model = await choose("Which iPhone?", "This screen size is shared by two phones.", [
      { label: "iPhone 12 mini", value: "mini" },
      { label: "iPhone 11 Pro, XS, or X", value: "x" }
    ]);
    if (!model) return;
    choices.model = model;
  }
  if (found.entry.text || found.entry.notext) {
    const icons = await choose("Home screen icons", "Small icons have labels under them. Large icons do not.", [
      { label: "Small (has labels)", value: "text" },
      { label: "Large (no labels)", value: "notext" }
    ]);
    if (!icons) return;
    choices.icons = icons;
  }
  const spec = resolvePhone(found.entry, choices);
  if (!spec) return;
  const size = await choose("Widget size", "Which widget are you placing on that empty page?", ["Small", "Medium", "Large"]);
  if (!size) return;
  const family = size.toLowerCase();
  let positions;
  let positionTitle;
  let positionHelp;
  if (family === "small") {
    positions = ["Top left", "Top right", "Middle left", "Middle right", "Bottom left", "Bottom right"];
    positionTitle = "Small widget position";
    positionHelp = "Top left / Top right / Middle left / Middle right / Bottom left / Bottom right";
  } else if (family === "medium") {
    positions = ["Top", "Middle", "Bottom"];
    positionTitle = "Medium widget position";
    positionHelp = "Top / Middle / Bottom. A medium widget spans both columns.";
  } else {
    positions = ["Top", "Bottom"];
    positionTitle = "Large widget position";
    positionHelp = "Top / Bottom. A large widget covers two rows. Bottom means the lower two rows.";
  }
  if (found.height === "1136") positionHelp += " This phone only has two rows, so middle and bottom match.";
  const position = await choose(positionTitle, positionHelp, positions);
  if (!position) return;
  const crop = cropFor(spec, family, position);
  const image = cropWallpaper(img, crop, found.scale);
  if (!image) {
    await choose("Use a different screenshot", screenshotHelp(shot), ["OK"]);
    return;
  }
  const store = openStorage();
  store.fm.writeImage(bgPath(store, family), image);
  const where = store.icloud ? "iCloud" : "this iPhone";
  await choose(
    "Background saved",
    "Saved in " + where + ". Put the " + family + " Scriptable widget in the " + position.toLowerCase() + " of that same empty page. Run this script again to set another size or to redo it.",
    ["OK"]
  );
}

async function makeWidget(familyOverride) {
  const family = (familyOverride === "small" || familyOverride === "medium" || familyOverride === "large")
    ? familyOverride
    : ((config.widgetFamily === "small" || config.widgetFamily === "large" || config.widgetFamily === "medium") ? config.widgetFamily : "medium");
  let model;
  try { model = modelFrom(await fetchSummary()); }
  catch (e) { model = modelFrom({ error: "network" }); }
  let bg = null;
  try { bg = await loadBackground(family); } catch (e) { bg = null; }
  const widget = new ListWidget();
  widget.url = APP_URL;
  try { widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000); } catch (e) {}
  let image = null;
  try { image = renderFace(family, model, isDarkMode(), { transparent: !!bg }); } catch (e) { image = null; }
  try {
    if (bg) widget.backgroundImage = bg;
    else widget.backgroundColor = palette(isDarkMode()).bgBottom;
  } catch (e) {}
  if (!image) {
    const line = widget.addText((model && model.note) || "Open Fit Tracker");
    line.font = Font.mediumSystemFont(14);
    try { line.textColor = palette(isDarkMode()).text; } catch (e2) {}
    return widget;
  }
  try { widget.setPadding(0, 0, 0, 0); } catch (e) {}
  const el = widget.addImage(image);
  const size = faceSize(family);
  try { el.imageSize = new Size(size.w, size.h); } catch (e) {}
  try { el.centerAlignImage(); } catch (e) {}
  return widget;
}

async function presentFamily(family) {
  const widget = await makeWidget(family);
  if (family === "small") await widget.presentSmall();
  else if (family === "large") await widget.presentLarge();
  else await widget.presentMedium();
}

async function runInApp() {
  const hasBg = backgroundExists("small") || backgroundExists("medium") || backgroundExists("large");
  const choice = await choose(
    "Fit Tracker",
    hasBg
      ? "Set transparent background, clear it, or preview a size."
      : "iOS widgets can't be truly clear. Screenshot an empty home screen page, then this script crops it behind the widget.",
    ["Set transparent background", "Clear background", "Preview small", "Preview medium", "Preview large"]
  );
  if (!choice) return;
  if (choice === "Set transparent background") await setupBackground();
  else if (choice === "Clear background") {
    clearBackgrounds();
    await choose("Background cleared", "The widget will use its solid background until you set a screenshot again.", ["OK"]);
  } else if (choice === "Preview small") await presentFamily("small");
  else if (choice === "Preview medium") await presentFamily("medium");
  else if (choice === "Preview large") await presentFamily("large");
}

if (typeof ListWidget !== "undefined") {
  (async () => {
    try {
      if (!config.runsInWidget) await runInApp();
      else Script.setWidget(await makeWidget());
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
