// ================= Almacenamiento =================
const STORE_KEY = "fitlog_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw);
  } catch {
    return { weights: [], workouts: {} };
  }
}
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
let store = loadStore();
if (!store.weights) store.weights = [];
if (!store.workouts) store.workouts = {};

// Plantilla editable de ejercicios (copia de WORKOUTS la primera vez).
if (!store.workoutPlan) store.workoutPlan = {};
Object.keys(WORKOUTS).forEach((k) => {
  if (!store.workoutPlan[k]) {
    store.workoutPlan[k] = WORKOUTS[k].exercises.map((e) => ({ ...e }));
  } else {
    store.workoutPlan[k].forEach((ex) => {
      const t = WORKOUTS[k].exercises.find((x) => x.name === ex.name);
      if (ex.setsCount === undefined) ex.setsCount = t ? t.setsCount : 3;
      if (ex.rest === undefined) ex.rest = t ? t.rest : 60;
      if (ex.type === undefined) ex.type = t ? t.type : "reps";
    });
  }
});

// ================= Fechas =================
const todayISO = () => localISO(new Date());
function localISO(d) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}
const parseISO = (iso) => new Date(iso + "T00:00:00");
const fmtDate = (iso) => parseISO(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "");
const fmtLong = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "long" });
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function dayNameEs(date) { return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][date.getDay()]; }

// Limpieza: sesiones vacías de días pasados (las creaba la versión anterior al abrir Entreno).
Object.keys(store.workouts).forEach((iso) => {
  if (iso !== todayISO() && !hasSets(store.workouts[iso])) delete store.workouts[iso];
});
saveStore(store);

// ================= Consultas de historial =================
function hasSets(w) {
  return !!(w && w.exercises && Object.values(w.exercises).some((e) => e.sets && e.sets.some(Boolean)));
}
// Sesiones reales (con al menos una serie), ascendentes por fecha.
function realSessions() {
  return Object.entries(store.workouts)
    .filter(([, w]) => hasSets(w))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([iso, w]) => ({ iso, day: w.day, exercises: w.exercises }));
}
function cycleStartISO() {
  const s = realSessions();
  return s.length ? s[0].iso : todayISO();
}
function cycleWeek() {
  const start = mondayOf(parseISO(cycleStartISO()));
  const now = mondayOf(new Date());
  return Math.min(99, Math.floor((now - start) / (7 * 86400000)) + 1);
}
// Todas las apariciones de un ejercicio (por nombre, en cualquier día A/B/C), ascendentes.
function exerciseHistory(name, { excludeToday = false } = {}) {
  const out = [];
  realSessions().forEach((s) => {
    if (excludeToday && s.iso === todayISO()) return;
    const ex = s.exercises[name];
    if (ex && ex.sets && ex.sets.some(Boolean)) out.push({ iso: s.iso, day: s.day, sets: ex.sets.filter(Boolean), rawSets: ex.sets });
  });
  return out;
}
function isTimeExercise(name) {
  for (const k of Object.keys(store.workoutPlan)) {
    const ex = store.workoutPlan[k].find((e) => e.name === name);
    if (ex) return ex.type === "time";
  }
  return false;
}
function setValue(set, isTime) { return isTime ? (set.duration || 0) : (set.w || 0); }
function maxOfSets(sets, isTime) { return sets.reduce((m, s) => Math.max(m, setValue(s, isTime)), 0); }
function volumeOfSets(sets) { return sets.reduce((v, s) => v + (s.w || 0) * (s.r || 0), 0); }
function getLastSession(name) {
  const h = exerciseHistory(name, { excludeToday: true });
  if (!h.length) return null;
  const last = h[h.length - 1];
  return { iso: last.iso, sets: last.sets, rawSets: last.rawSets, lastSet: last.sets[last.sets.length - 1] };
}
function prevMax(name) {
  const isTime = isTimeExercise(name);
  return exerciseHistory(name, { excludeToday: true }).reduce((m, h) => Math.max(m, maxOfSets(h.sets, isTime)), 0);
}
function fmtSet(s, isTime) { return isTime ? `${s.duration}s` : `${s.w} × ${s.r}`; }
function fmtKg(v) { return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ""); }

// Día sugerido: rota A → B → C según la última sesión real.
function suggestedDay() {
  const today = store.workouts[todayISO()];
  if (today && hasSets(today)) return today.day;
  const s = realSessions().filter((x) => x.iso !== todayISO());
  const keys = Object.keys(WORKOUTS);
  if (!s.length) return keys[0];
  const idx = keys.indexOf(s[s.length - 1].day);
  return keys[(idx + 1) % keys.length];
}
function sessionsInWeek(monday) {
  const a = localISO(monday), b = localISO(addDays(monday, 6));
  return realSessions().filter((s) => s.iso >= a && s.iso <= b);
}
// Semanas consecutivas (hasta la actual o la anterior) con al menos 1 sesión.
function weekStreak() {
  let m = mondayOf(new Date());
  let streak = 0;
  if (!sessionsInWeek(m).length) m = addDays(m, -7); // la semana actual aún puede estar empezando
  while (sessionsInWeek(m).length && streak < 99) { streak++; m = addDays(m, -7); }
  return streak;
}

// ================= Iconos =================
const ICON_X = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const ICON_PLAY = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_CHECK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function ringSVG(t, size = 30) {
  const r = 12, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, t)));
  return `<div class="ring"><svg viewBox="0 0 30 30"><circle class="track" cx="15" cy="15" r="${r}"/><circle class="fill" cx="15" cy="15" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg></div>`;
}

// ================= Navegación =================
const views = ["hoy", "entreno", "historial", "peso", "comidas"];
document.querySelectorAll("nav.tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
function setView(name) {
  views.forEach((v) => document.getElementById("view-" + v).classList.toggle("active", v === name));
  document.querySelectorAll("nav.tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  window.scrollTo({ top: 0 });
  if (name === "hoy") renderHoy();
  if (name === "entreno") renderWorkoutView(currentWorkoutDay);
  if (name === "historial") renderHistorial();
  if (name === "peso") drawWeightChart();
  if (name === "comidas") renderMealsView();
}

// ================= Vista: HOY =================
function renderHoy() {
  const now = new Date();
  const dName = dayNameEs(now);
  const day = suggestedDay();
  const todaySession = store.workouts[todayISO()];
  const doneToday = hasSets(todaySession);

  document.getElementById("hoy-header").innerHTML = `
    <span class="eyebrow">Semana ${cycleWeek()} / 12 · ${dName} ${fmtLong(now)}</span>
    <h1 class="display"><span class="soft">${doneToday ? "Hecho hoy" : "Hoy toca"}</span><br>${WORKOUTS[day].name}</h1>
  `;

  // Tira de semana
  const monday = mondayOf(now);
  const weekSessions = sessionsInWeek(monday);
  const labels = ["L", "M", "X", "J", "V", "S", "D"];
  document.getElementById("hoy-week").innerHTML = labels.map((l, i) => {
    const iso = localISO(addDays(monday, i));
    const s = weekSessions.find((x) => x.iso === iso);
    const isToday = iso === todayISO();
    return `<div class="week-day ${s ? "done" : ""} ${isToday ? "today" : ""}">
      <div class="week-dot">${s ? s.day : ""}</div>
      <span class="week-lbl">${l}</span>
    </div>`;
  }).join("");

  // Stats
  const total = realSessions().length;
  const thisWeek = weekSessions.length;
  const streak = weekStreak();
  const lastW = store.weights.length ? store.weights[store.weights.length - 1] : null;
  let deltaTxt = "";
  if (lastW) {
    const cutoff = localISO(addDays(now, -28));
    const older = store.weights.filter((w) => w.date <= cutoff);
    const ref = older.length ? older[older.length - 1] : store.weights[0];
    const d = lastW.w - ref.w;
    if (ref !== lastW) deltaTxt = ` · ${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`;
  }
  document.getElementById("hoy-stats").innerHTML = `
    <div class="stat">${ringSVG(thisWeek / 3)}<div class="val">${total}</div><div class="lbl">entrenos · ${thisWeek}/3 sem</div></div>
    <div class="stat">${ringSVG(Math.min(1, streak / 12))}<div class="val">${streak}</div><div class="lbl">racha sem.</div></div>
    <div class="stat">${ringSVG(Math.min(1, total / 36))}<div class="val">${lastW ? fmtKg(lastW.w) : "—"}</div><div class="lbl">kg${deltaTxt}</div></div>
  `;

  // Entreno de hoy
  const plan = store.workoutPlan[day];
  const rows = plan.map((ex) => {
    const last = getLastSession(ex.name);
    const isTime = ex.type === "time";
    const lastTxt = last ? fmtSet(last.sets.reduce((a, b) => (setValue(b, isTime) >= setValue(a, isTime) ? b : a)), isTime) : "—";
    return `<div class="ex-list-row"><span>${ex.name}</span><span class="last ${last ? "" : "none"}">${lastTxt}</span></div>`;
  }).join("");
  document.getElementById("hoy-entreno").innerHTML = `
    <div class="card-head"><span class="card-label">Entreno de hoy</span><span class="aside">${plan.length} ejercicios</span></div>
    ${rows}
    <button class="btn-accent" id="hoy-start" style="margin-top:14px;">${doneToday ? ICON_CHECK + " Continuar " : ICON_PLAY + " Empezar "}${WORKOUTS[day].name}</button>
  `;
  document.getElementById("hoy-start").addEventListener("click", () => {
    currentWorkoutDay = day;
    setView("entreno");
  });

  // Progreso últimas 4 semanas
  const since = localISO(addDays(now, -28));
  const names = new Set();
  Object.values(store.workoutPlan).forEach((l) => l.forEach((e) => { if (e.type !== "time") names.add(e.name); }));
  const prog = [];
  names.forEach((n) => {
    const h = exerciseHistory(n).filter((x) => x.iso >= since);
    if (h.length < 2) return;
    const first = maxOfSets(h[0].sets, false), last = maxOfSets(h[h.length - 1].sets, false);
    const allMax = exerciseHistory(n).reduce((m, x) => Math.max(m, maxOfSets(x.sets, false)), 0);
    prog.push({ n, delta: last - first, last, allMax });
  });
  prog.sort((a, b) => b.delta - a.delta);
  const top = prog.slice(0, 3);
  document.getElementById("hoy-progreso").innerHTML = `
    <div class="card-head"><span class="card-label">Progreso · últimas 4 semanas</span></div>
    ${top.length ? top.map((p) => `
      <div class="prog-row">
        <div class="prog-head"><span>${p.n}</span><span class="delta ${p.delta === 0 ? "flat" : ""}">${p.delta > 0 ? "+" : ""}${fmtKg(p.delta)} kg</span></div>
        <div class="bar"><i style="width:${p.allMax ? Math.round((p.last / p.allMax) * 100) : 0}%"></i></div>
      </div>`).join("")
      : `<p class="empty-note">Cuando repitas un ejercicio dos veces en un mes, aquí verás cuánto ha subido.</p>`}
  `;

  document.getElementById("hoy-comidas").innerHTML = renderMealCardHTML(dName, true);
  const tomorrow = addDays(now, 1);
  const tName = dayNameEs(tomorrow);
  const items = Object.entries(MEALS[tName])
    .filter(([m]) => m !== "Extra")
    .map(([m, v]) => `<div><b>${m}:</b> ${v.text}</div>`).join("");
  document.getElementById("hoy-manana").innerHTML = `
    <div class="card-head"><span class="card-label">Mañana · ${tName}</span><span class="aside">para preparar hoy</span></div>
    <div class="tomorrow-list">${items}</div>
  `;
}

// ================= Vista: COMIDAS =================
function renderMealCardHTML(dayName, isToday) {
  const plan = MEALS[dayName];
  let totalKcal = 0, totalProt = 0;
  const rows = Object.entries(plan).map(([mealName, m]) => {
    totalKcal += m.kcal; totalProt += m.protein;
    return `
      <div class="meal-row">
        <div class="meal-head"><span class="meal-name">${mealName}</span><span class="meal-macro">${m.kcal} kcal · ${m.protein}g prot</span></div>
        <div class="meal-text">${m.text}</div>
      </div>`;
  }).join("");
  return `
    <div class="card-head"><span class="card-label">${isToday ? "Comidas de hoy" : dayName}</span><span class="aside">${isToday ? dayName : ""}</span></div>
    <div class="macro-grid">
      <div class="macro-box kcal-box"><div class="val">${totalKcal}</div><div class="lbl">Kcal día</div></div>
      <div class="macro-box protein-box"><div class="val">${totalProt}g</div><div class="lbl">Proteína</div></div>
      <div class="macro-box"><div class="val">${TARGETS.kcal}</div><div class="lbl">Objetivo</div></div>
      <div class="macro-box"><div class="val">${TARGETS.protein}g</div><div class="lbl">Objetivo</div></div>
    </div>
    ${rows}
  `;
}

let mealMode = "dia";
let mealSelectedDay = "Lunes";

function renderWeekCardHTML() {
  const blocks = DAY_ORDER.map((day) => {
    const plan = MEALS[day];
    const totalKcal = Object.values(plan).reduce((s, m) => s + m.kcal, 0);
    const totalProt = Object.values(plan).reduce((s, m) => s + m.protein, 0);
    const mealsLine = Object.entries(plan)
      .filter(([name]) => name !== "Extra")
      .map(([name, m]) => `<b>${name}:</b> ${m.text.split(",")[0].split("—")[0].trim()}`)
      .join(" · ");
    return `
      <div class="week-day-block">
        <div class="wd-head"><span class="wd-name">${day}</span><span class="wd-macro">${totalKcal} kcal · ${totalProt}g prot</span></div>
        <div class="wd-meals">${mealsLine}</div>
      </div>`;
  }).join("");
  return `<div class="card-head"><span class="card-label">Semana completa</span><span class="aside">todos los días son intercambiables</span></div>${blocks}`;
}

function renderMealsView() {
  document.querySelectorAll("#meal-mode-pills .pill").forEach((p) => p.classList.toggle("active", p.dataset.mode === mealMode));
  const isCompra = mealMode === "compra";
  document.getElementById("meal-day-pills-wrap").style.display = mealMode === "dia" ? "block" : "none";
  document.getElementById("meal-card").style.display = isCompra ? "none" : "block";
  document.getElementById("compra-wrap").style.display = isCompra ? "block" : "none";
  document.getElementById("comidas-eyebrow").textContent = isCompra ? "Lista de la compra" : `Plan de comidas · ${TARGETS.kcal} kcal · ${TARGETS.protein}g prot`;

  if (isCompra) { renderCompraView(); return; }
  if (mealMode === "semana") { document.getElementById("meal-card").innerHTML = renderWeekCardHTML(); return; }

  document.getElementById("meal-pills").innerHTML = DAY_ORDER.map(
    (d) => `<button class="pill ${d === mealSelectedDay ? "active" : ""}" data-day="${d}">${d.slice(0, 3)}</button>`
  ).join("");
  document.getElementById("meal-card").innerHTML = renderMealCardHTML(mealSelectedDay, false);
  document.querySelectorAll("#meal-pills .pill").forEach((p) => {
    p.addEventListener("click", () => { mealSelectedDay = p.dataset.day; renderMealsView(); });
  });
}
document.querySelectorAll("#meal-mode-pills .pill").forEach((p) => {
  p.addEventListener("click", () => { mealMode = p.dataset.mode; renderMealsView(); });
});

// ================= Compra =================
let compraChecked = new Set(DAY_ORDER);
function renderCompraView() {
  const wrap = document.getElementById("compra-daychecks");
  wrap.innerHTML = DAY_ORDER.map((d) => `
    <label class="daycheck ${compraChecked.has(d) ? "checked" : ""}" data-day="${d}"><span class="box"></span>${d.slice(0, 3)}</label>
  `).join("");
  wrap.querySelectorAll(".daycheck").forEach((el) => {
    el.addEventListener("click", () => {
      const d = el.dataset.day;
      compraChecked.has(d) ? compraChecked.delete(d) : compraChecked.add(d);
      renderCompraView();
    });
  });
  document.getElementById("compra-select-all").onclick = () => {
    compraChecked = compraChecked.size === DAY_ORDER.length ? new Set() : new Set(DAY_ORDER);
    renderCompraView();
  };
  const byCat = buildShoppingList([...compraChecked]);
  const hasItems = CAT_ORDER.some((c) => byCat[c].length);
  if (!hasItems) {
    document.getElementById("compra-list").innerHTML = `<p class="empty-note">Marca al menos un día para generar la lista.</p>`;
    return;
  }
  const sections = CAT_ORDER.filter((c) => byCat[c].length).map((c) => `
    <div class="shop-cat"><h3>${CAT_LABELS[c]}</h3>
      ${byCat[c].map((item) => `<div class="shop-item"><span>${item.name}</span><span class="qty">${item.qty} ${item.unit}${item.qty !== 1 && item.unit === "unidad" ? "es" : ""}</span></div>`).join("")}
    </div>`).join("");
  document.getElementById("compra-list").innerHTML = `
    <div class="card-head"><span class="card-label">Lista de la compra</span><span class="aside">${compraChecked.size} días</span></div>
    ${sections}
    <p class="empty-note" style="text-align:left;padding-bottom:0;">Los platos "libres" (sábado) no suman ingredientes fijos.</p>
  `;
}

// ================= Vista: ENTRENO =================
let currentWorkoutDay = suggestedDay();
let setTimers = {};
let globalRestTimer = null;
let audioCtx = null;
let expandedOverride = {}; // exIdx -> true/false (tap del usuario)
let editMode = false;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function unlockAudio() {
  try {
    const ctx = getAudioContext();
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch (e) { /* sin sonido */ }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  if (!document.hidden && globalRestTimer) renderGlobalRestBar();
});
function playBeep() {
  try {
    const ctx = getAudioContext();
    const mk = (freq, delayMs, dur) => setTimeout(() => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur + 0.05);
    }, delayMs);
    mk(880, 0, 0.5); mk(1046, 250, 0.4);
  } catch (e) { /* sin sonido */ }
}

function ensureTodaySession(dayKey) {
  const today = todayISO();
  if (!store.workouts[today]) {
    store.workouts[today] = { day: dayKey, exercises: {} };
    saveStore(store);
  } else if (!hasSets(store.workouts[today]) && store.workouts[today].day !== dayKey) {
    store.workouts[today].day = dayKey; // aún vacía: se puede cambiar de día sin perder nada
    saveStore(store);
  }
  return store.workouts[today];
}

function adjustRest(dayKey, idx, delta) {
  const ex = store.workoutPlan[dayKey][idx];
  ex.rest = Math.min(300, Math.max(15, (ex.rest || 60) + delta));
  saveStore(store);
  const el = document.getElementById(`rest-value-${idx}`);
  if (el) el.textContent = `${ex.rest}s`;
}

// ---- Barra de descanso ----
function startGlobalRestTimer(seconds, exerciseName, nextLabel) {
  unlockAudio();
  if (globalRestTimer) clearInterval(globalRestTimer.interval);
  globalRestTimer = { endsAt: Date.now() + seconds * 1000, exerciseName, nextLabel };
  saveGlobalRestTimer();
  document.getElementById("global-rest-bar").style.display = "block";
  renderGlobalRestBar();
  globalRestTimer.interval = setInterval(renderGlobalRestBar, 1000);
}
function saveGlobalRestTimer() {
  if (globalRestTimer) localStorage.setItem("fitlog_rest_timer", JSON.stringify({ endsAt: globalRestTimer.endsAt, exerciseName: globalRestTimer.exerciseName, nextLabel: globalRestTimer.nextLabel }));
  else localStorage.removeItem("fitlog_rest_timer");
}
function renderGlobalRestBar() {
  if (!globalRestTimer) return;
  const remaining = Math.round((globalRestTimer.endsAt - Date.now()) / 1000);
  const timeEl = document.getElementById("grb-time");
  document.getElementById("grb-label").textContent = `Descanso · ${globalRestTimer.exerciseName || ""}`;
  document.getElementById("grb-sub").textContent = globalRestTimer.nextLabel || "";
  if (remaining <= 0) {
    clearInterval(globalRestTimer.interval);
    timeEl.textContent = "¡Ya!";
    playBeep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => {
      document.getElementById("global-rest-bar").style.display = "none";
      globalRestTimer = null;
      saveGlobalRestTimer();
    }, 3000);
    return;
  }
  timeEl.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
}
function cancelGlobalRestTimer() {
  if (globalRestTimer) clearInterval(globalRestTimer.interval);
  globalRestTimer = null;
  saveGlobalRestTimer();
  document.getElementById("global-rest-bar").style.display = "none";
}
document.getElementById("grb-cancel").addEventListener("click", cancelGlobalRestTimer);
document.getElementById("grb-plus30").addEventListener("click", () => {
  if (globalRestTimer) { globalRestTimer.endsAt += 30000; saveGlobalRestTimer(); renderGlobalRestBar(); }
});
(function restoreRestTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem("fitlog_rest_timer"));
    if (saved && saved.endsAt > Date.now()) {
      globalRestTimer = { endsAt: saved.endsAt, exerciseName: saved.exerciseName, nextLabel: saved.nextLabel };
      document.getElementById("global-rest-bar").style.display = "block";
      renderGlobalRestBar();
      globalRestTimer.interval = setInterval(renderGlobalRestBar, 1000);
    } else localStorage.removeItem("fitlog_rest_timer");
  } catch (e) { /* nada */ }
})();

// ---- Timer por serie ----
function startSetTimer(exIdx, setIdx, dayKey) {
  unlockAudio();
  const key = `${exIdx}-${setIdx}`;
  const row = document.querySelector(`[data-set="${key}"]`);
  if (!row) return;
  const startBtn = row.querySelector(".set-start-btn");
  const start = Date.now();
  setTimers[key] = { start };
  const doneBtn = document.createElement("button");
  doneBtn.className = "set-done-btn";
  doneBtn.innerHTML = `<span class="set-elapsed" id="elapsed-${key}">0:00</span>${ICON_CHECK}`;
  doneBtn.addEventListener("click", () => finishSet(exIdx, setIdx, dayKey));
  startBtn.replaceWith(doneBtn);
  setTimers[key].interval = setInterval(() => {
    const el = document.getElementById(`elapsed-${key}`);
    if (!el) { clearInterval(setTimers[key].interval); return; }
    const secs = Math.floor((Date.now() - start) / 1000);
    el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  }, 250);
}

function finishSet(exIdx, setIdx, dayKey) {
  const key = `${exIdx}-${setIdx}`;
  if (setTimers[key]) clearInterval(setTimers[key].interval);
  const elapsedSec = setTimers[key] ? Math.floor((Date.now() - setTimers[key].start) / 1000) : 0;
  delete setTimers[key];

  const ex = store.workoutPlan[dayKey][exIdx];
  const isTime = ex.type === "time";
  const session = ensureTodaySession(dayKey);
  if (!session.exercises[ex.name]) session.exercises[ex.name] = { completed: false, sets: [] };
  const savedEx = session.exercises[ex.name];

  let setData;
  if (isTime) setData = { duration: elapsedSec };
  else {
    const wInput = document.querySelector(`[data-set-weight="${key}"]`);
    const rInput = document.querySelector(`[data-set-reps="${key}"]`);
    setData = { w: parseFloat(wInput?.value) || 0, r: parseInt(rInput?.value, 10) || 0, roundTime: elapsedSec };
  }
  savedEx.sets[setIdx] = setData;
  const setsCount = ex.setsCount || 3;
  savedEx.completed = savedEx.sets.filter(Boolean).length >= setsCount;
  saveStore(store);

  const nextLabel = savedEx.completed
    ? (store.workoutPlan[dayKey][exIdx + 1] ? `siguiente: ${store.workoutPlan[dayKey][exIdx + 1].name}` : "último ejercicio hecho")
    : `siguiente: serie ${setIdx + 2}`;
  startGlobalRestTimer(ex.rest || 60, ex.name, nextLabel);
  renderWorkoutView(dayKey); // repinta todo: la tarjeta completada se pliega y la siguiente se abre
}

function getDefaultWeight(savedSets, si, last) {
  for (let k = si - 1; k >= 0; k--) if (savedSets[k]) return savedSets[k].w;
  if (last && last.rawSets && last.rawSets[si] && typeof last.rawSets[si].w === "number") return last.rawSets[si].w;
  if (last && last.lastSet && typeof last.lastSet.w === "number") return last.lastSet.w;
  return "";
}
function getDefaultReps(savedSets, si, last) {
  if (last && last.rawSets && last.rawSets[si] && typeof last.rawSets[si].r === "number") return last.rawSets[si].r;
  return "";
}

function renderSetRow(exIdx, setIdx, ex, savedSet, last, state) {
  const key = `${exIdx}-${setIdx}`;
  const isTime = ex.type === "time";
  const lastSet = last && last.rawSets ? last.rawSets[setIdx] : null;
  const lastHtml = lastSet ? `<span class="set-last">${fmtSet(lastSet, isTime)}</span>` : `<span class="set-last none">—</span>`;

  if (savedSet) {
    const up = lastSet && setValue(savedSet, isTime) > setValue(lastSet, isTime);
    return `
      <div class="set-row done" data-set="${key}">
        <span class="set-num">S${setIdx + 1}</span>
        ${lastHtml}
        <div class="set-now"><span class="set-result">${fmtSet(savedSet, isTime)}${up ? `<span class="up">▲</span>` : ""}</span><span class="set-check-badge">${ICON_CHECK}</span></div>
      </div>`;
  }
  if (state === "pending") {
    return `
      <div class="set-row pending" data-set="${key}">
        <span class="set-num">S${setIdx + 1}</span>
        ${lastHtml}
        <div class="set-now"><span class="set-dash">—</span></div>
      </div>`;
  }
  const startBtn = `<button class="set-start-btn" data-set-start="${key}" aria-label="Empezar serie ${setIdx + 1}">${ICON_PLAY}</button>`;
  if (isTime) {
    return `
      <div class="set-row active" data-set="${key}">
        <span class="set-num">S${setIdx + 1}</span>
        ${lastHtml}
        <div class="set-now"><span class="set-hint">Mantener</span>${startBtn}</div>
      </div>`;
  }
  const session = store.workouts[todayISO()];
  const savedSets = (session && session.exercises[ex.name] && session.exercises[ex.name].sets) || [];
  return `
    <div class="set-row active" data-set="${key}">
      <span class="set-num">S${setIdx + 1}</span>
      ${lastHtml}
      <div class="set-now">
        <label class="set-input-wrap"><input type="number" step="0.5" inputmode="decimal" data-set-weight="${key}" placeholder="kg" value="${getDefaultWeight(savedSets, setIdx, last)}"><small>kg</small></label>
        <label class="set-input-wrap"><input type="number" inputmode="numeric" data-set-reps="${key}" placeholder="reps" value="${getDefaultReps(savedSets, setIdx, last)}"><small>reps</small></label>
        ${startBtn}
      </div>
    </div>`;
}

function exerciseState(dayKey, exIdx) {
  const ex = store.workoutPlan[dayKey][exIdx];
  const session = store.workouts[todayISO()];
  const savedEx = (session && session.exercises[ex.name]) || { sets: [] };
  const done = savedEx.sets.filter(Boolean).length;
  return { ex, savedEx, done, total: ex.setsCount || 3, completed: done >= (ex.setsCount || 3) };
}
function firstActiveIdx(dayKey) {
  const list = store.workoutPlan[dayKey];
  for (let i = 0; i < list.length; i++) if (!exerciseState(dayKey, i).completed) return i;
  return -1;
}

function buildExerciseCardHTML(dayKey, exIdx) {
  const { ex, savedEx, done, total, completed } = exerciseState(dayKey, exIdx);
  const isTime = ex.type === "time";
  const last = getLastSession(ex.name);
  const activeIdx = firstActiveIdx(dayKey);
  const expanded = expandedOverride[exIdx] !== undefined ? expandedOverride[exIdx] : exIdx === activeIdx;

  const doneSets = savedEx.sets.filter(Boolean);
  const todayMax = maxOfSets(doneSets, isTime);
  const before = prevMax(ex.name);
  const isPR = doneSets.length > 0 && todayMax > before && before > 0;
  const isFirstEver = !last;

  const removeBtn = editMode ? `<button class="ex-remove" data-remove="${exIdx}" aria-label="Quitar ejercicio">${ICON_X}</button>` : "";

  // Cabecera
  let head;
  if (completed) {
    head = `
      <div class="ex-head" data-toggle="${exIdx}">
        <div class="ex-title"><span class="ex-check">${ICON_CHECK}</span><div><div class="ex-name">${ex.name}</div>
          <div class="ex-summary">${doneSets.map((s) => fmtSet(s, isTime)).join(" · ")}</div></div></div>
        <div class="ex-meta">${isPR ? `<span class="pr-badge">PR</span>` : ""}${removeBtn}</div>
      </div>`;
  } else if (!expanded) {
    head = `
      <div class="ex-head" data-toggle="${exIdx}">
        <div class="ex-title"><div><div class="ex-name">${ex.name}</div>
          <div class="ex-summary dim">${last ? `última vez ${fmtSet(last.lastSet, isTime)} · ${fmtDate(last.iso)}` : "sin registros previos"}</div></div></div>
        <div class="ex-meta"><span class="ex-index">${exIdx + 1} / ${store.workoutPlan[dayKey].length}</span>${removeBtn}</div>
      </div>`;
  } else {
    head = `
      <div class="ex-head" data-toggle="${exIdx}">
        <div class="ex-title"><div class="ex-name">${ex.name}</div></div>
        <div class="ex-meta">${ex.scheme} · ${ex.rest || 60}s${isPR ? ` <span class="pr-badge">PR</span>` : ""}${removeBtn}</div>
      </div>`;
  }

  if (!expanded) return head;

  // Cuerpo expandido: serie | última vez | hoy
  const nextActive = savedEx.sets.findIndex((s, i) => !s && i < total);
  const firstUndone = nextActive === -1 ? (done < total ? done : -1) : nextActive;
  const setsHtml = Array.from({ length: total }).map((_, si) => {
    const savedSet = savedEx.sets[si];
    const state = savedSet ? "done" : si === firstUndone ? "active" : "pending";
    return renderSetRow(exIdx, si, ex, savedSet, last, state);
  }).join("");

  let note = "";
  if (isFirstEver) note = `<div class="ex-note first">Primera vez que registras este ejercicio. Anota tu marca base.</div>`;
  else if (doneSets.length) {
    const lastMax = maxOfSets(last.sets, isTime);
    const d = todayMax - lastMax;
    const unit = isTime ? "s" : " kg";
    if (d > 0) note = `<div class="ex-note">+${fmtKg(d)}${unit} respecto al ${fmtDate(last.iso)}${isPR ? " · récord personal" : ""}</div>`;
    else if (d === 0) note = `<div class="ex-note flat">Mismo peso que el ${fmtDate(last.iso)}. Si salieron todas las reps, sube 2.5 kg la próxima.</div>`;
    else note = `<div class="ex-note flat">${fmtKg(d)}${unit} respecto al ${fmtDate(last.iso)}</div>`;
  }

  return `
    ${head}
    <div class="sets-grid">
      <div class="sets-head"><span>Serie</span><span class="last">${last ? fmtDate(last.iso) : "última vez"}</span><span class="now">Hoy</span></div>
      ${setsHtml}
    </div>
    ${note}
    <div class="ex-rest-row">
      <span class="ex-rest-label">Descanso</span>
      <div class="ex-rest-stepper">
        <button type="button" data-rest-minus="${exIdx}" aria-label="Menos descanso">−</button>
        <span class="ex-rest-value" id="rest-value-${exIdx}">${ex.rest || 60}s</span>
        <button type="button" data-rest-plus="${exIdx}" aria-label="Más descanso">+</button>
      </div>
    </div>
  `;
}

function attachExerciseCardListeners(dayKey, exIdx) {
  const card = document.querySelector(`.exercise-row[data-ex="${exIdx}"]`);
  if (!card) return;
  card.querySelector(`[data-toggle="${exIdx}"]`)?.addEventListener("click", (e) => {
    if (e.target.closest(".ex-remove")) return;
    const activeIdx = firstActiveIdx(dayKey);
    const cur = expandedOverride[exIdx] !== undefined ? expandedOverride[exIdx] : exIdx === activeIdx;
    expandedOverride[exIdx] = !cur;
    renderExerciseCard(dayKey, exIdx);
  });
  card.querySelector(`[data-remove="${exIdx}"]`)?.addEventListener("click", () => {
    store.workoutPlan[dayKey].splice(exIdx, 1);
    saveStore(store);
    expandedOverride = {};
    renderWorkoutView(dayKey);
  });
  card.querySelector(`[data-rest-minus="${exIdx}"]`)?.addEventListener("click", () => adjustRest(dayKey, exIdx, -15));
  card.querySelector(`[data-rest-plus="${exIdx}"]`)?.addEventListener("click", () => adjustRest(dayKey, exIdx, 15));
  card.querySelectorAll("[data-set-start]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [ei, si] = btn.dataset.setStart.split("-").map(Number);
      startSetTimer(ei, si, dayKey);
    });
  });
}

function renderExerciseCard(dayKey, exIdx) {
  const card = document.querySelector(`.exercise-row[data-ex="${exIdx}"]`);
  if (!card) return;
  const { completed } = exerciseState(dayKey, exIdx);
  const activeIdx = firstActiveIdx(dayKey);
  const expanded = expandedOverride[exIdx] !== undefined ? expandedOverride[exIdx] : exIdx === activeIdx;
  card.classList.toggle("completed", completed);
  card.classList.toggle("collapsed", !expanded);
  card.classList.toggle("pending-collapsed", !expanded && !completed);
  card.innerHTML = buildExerciseCardHTML(dayKey, exIdx);
  attachExerciseCardListeners(dayKey, exIdx);
}

function renderWorkoutView(dayKey) {
  if (dayKey !== currentWorkoutDay) expandedOverride = {};
  currentWorkoutDay = dayKey;
  const todaySession = store.workouts[todayISO()];
  const lockedDay = todaySession && hasSets(todaySession) ? todaySession.day : null;

  document.getElementById("workout-pills").innerHTML = Object.keys(WORKOUTS).map(
    (k) => `<button class="pill ${k === dayKey ? "active" : ""}" data-day="${k}">${WORKOUTS[k].name}${lockedDay === k ? " ·" : ""}</button>`
  ).join("");

  const exList = store.workoutPlan[dayKey];
  ensureTodaySession(dayKey);

  const doneCount = exList.filter((_, i) => exerciseState(dayKey, i).completed).length;
  const sessionNum = realSessions().filter((s) => s.iso !== todayISO()).length + 1;
  const lastOfDay = realSessions().filter((s) => s.day === dayKey && s.iso !== todayISO()).pop();
  document.getElementById("entreno-header").innerHTML = `
    <span class="eyebrow">${WORKOUTS[dayKey].name} · ${fmtDate(todayISO())} · ${doneCount} de ${exList.length} hechos</span>
    <div class="header-row"><h1 class="display">Sesión ${sessionNum}</h1>${lastOfDay ? `<span class="header-aside">vs. ${fmtDate(lastOfDay.iso)}</span>` : ""}</div>
  `;
  document.getElementById("session-bar-fill").style.width = `${exList.length ? Math.round((doneCount / exList.length) * 100) : 0}%`;

  const cardsHtml = exList.map((_, i) => `<div class="exercise-row" data-ex="${i}"></div>`).join("");
  document.getElementById("workout-card").innerHTML = `
    ${lockedDay && lockedDay !== dayKey ? `<p class="empty-note" style="padding-top:0;">Hoy ya registraste series en ${WORKOUTS[lockedDay].name}. Las de aquí se guardan en la misma sesión.</p>` : ""}
    ${cardsHtml || '<p class="empty-note">Sin ejercicios en este día — añade alguno en "Editar rutina".</p>'}
    ${doneCount === exList.length && exList.length ? `<div class="card alt" style="text-align:center;"><div class="display" style="font-size:26px;color:var(--accent);margin-bottom:6px;">Sesión completa</div><p class="empty-note" style="padding:0;">Descansa, come y vuelve. El historial ya está guardado.</p></div>` : ""}
    <div class="edit-plan">
      <button class="ghost" id="edit-plan-btn" style="width:100%;">${editMode ? "Cerrar edición" : "Editar rutina"}</button>
      <div class="edit-plan-body" id="edit-plan-body" style="display:${editMode ? "block" : "none"};">
        <div class="add-exercise-inputs">
          <input type="text" id="new-ex-name" placeholder="Nombre del ejercicio">
          <input type="text" id="new-ex-scheme" placeholder="Series x reps (ej. 3 x 10-12)">
          <select id="new-ex-type"><option value="reps">Reps y peso</option><option value="time">Tiempo (ej. plancha)</option></select>
          <div class="add-exercise-row2">
            <input type="number" id="new-ex-sets" placeholder="Nº series" value="3" min="1" max="10">
            <input type="number" id="new-ex-rest" placeholder="Descanso (seg)" value="60">
          </div>
        </div>
        <button class="ghost" id="add-exercise-btn" style="width:100%;">+ Añadir ejercicio</button>
        <button class="ghost" id="reset-day-btn" style="width:100%;margin-top:8px;">Restaurar plantilla original de ${WORKOUTS[dayKey].name}</button>
      </div>
    </div>
  `;
  exList.forEach((_, i) => renderExerciseCard(dayKey, i));

  document.querySelectorAll("#workout-pills .pill").forEach((p) => p.addEventListener("click", () => renderWorkoutView(p.dataset.day)));
  document.getElementById("edit-plan-btn").addEventListener("click", () => { editMode = !editMode; renderWorkoutView(dayKey); });
  document.getElementById("add-exercise-btn").addEventListener("click", () => {
    const name = document.getElementById("new-ex-name").value.trim();
    if (!name) { document.getElementById("new-ex-name").focus(); return; }
    store.workoutPlan[dayKey].push({
      name,
      scheme: document.getElementById("new-ex-scheme").value.trim() || "3 x 10-12",
      type: document.getElementById("new-ex-type").value,
      setsCount: parseInt(document.getElementById("new-ex-sets").value, 10) || 3,
      rest: parseInt(document.getElementById("new-ex-rest").value, 10) || 60,
    });
    saveStore(store);
    renderWorkoutView(dayKey);
  });
  document.getElementById("reset-day-btn").addEventListener("click", () => {
    store.workoutPlan[dayKey] = WORKOUTS[dayKey].exercises.map((e) => ({ ...e }));
    saveStore(store);
    expandedOverride = {};
    renderWorkoutView(dayKey);
  });
}

// ================= Vista: HISTORIAL =================
let histExercise = null;
let openSessions = new Set();

function allExerciseNames() {
  const names = [];
  Object.values(store.workoutPlan).forEach((l) => l.forEach((e) => { if (!names.includes(e.name)) names.push(e.name); }));
  realSessions().forEach((s) => Object.keys(s.exercises).forEach((n) => { if (!names.includes(n)) names.push(n); }));
  return names;
}

function renderHistorial() {
  const sessions = realSessions();
  document.getElementById("hist-header").innerHTML = `
    <span class="eyebrow">${sessions.length} ${sessions.length === 1 ? "sesión" : "sesiones"}${sessions.length ? ` · desde ${fmtDate(sessions[0].iso)}` : ""}</span>
    <h1 class="display">Historial</h1>
  `;
  renderCalendar(sessions);
  renderExerciseProgress(sessions);
  renderSessionList(sessions);
  renderDataCard();
}

function renderCalendar(sessions) {
  const WEEKS = 8;
  const thisMonday = mondayOf(new Date());
  const byIso = Object.fromEntries(sessions.map((s) => [s.iso, s]));
  const today = todayISO();
  const streak = weekStreak();
  const thisWeek = sessionsInWeek(thisMonday).length;

  let cells = `<div></div>${["L", "M", "X", "J", "V", "S", "D"].map((l) => `<div class="cal-head">${l}</div>`).join("")}`;
  for (let w = WEEKS - 1; w >= 0; w--) {
    const monday = addDays(thisMonday, -7 * w);
    cells += `<div class="cal-week-lbl">${fmtDate(localISO(monday)).split(" ")[0]} ${fmtDate(localISO(monday)).split(" ")[1]}</div>`;
    for (let d = 0; d < 7; d++) {
      const iso = localISO(addDays(monday, d));
      const s = byIso[iso];
      const cls = [s ? s.day : "", iso > today ? "future" : "", iso === today ? "today" : ""].join(" ");
      cells += `<div class="cal-cell ${cls}">${s ? s.day : ""}</div>`;
    }
  }
  document.getElementById("hist-calendar").innerHTML = `
    <div class="card-head"><span class="card-label">Últimas ${WEEKS} semanas</span><span class="aside">${thisWeek}/3 esta semana · ${streak} sem. seguidas</span></div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend">${Object.keys(WORKOUTS).map((k) => `<span><i class="cal-cell ${k}" style="display:inline-block;width:8px;height:8px;aspect-ratio:auto;box-shadow:none;border-radius:2px;"></i>${WORKOUTS[k].name}</span>`).join("")}</div>
  `;
}

function renderExerciseProgress(sessions) {
  const names = allExerciseNames();
  const withData = names.filter((n) => exerciseHistory(n).length);
  if (!histExercise || !names.includes(histExercise)) histExercise = withData[0] || names[0];
  const el = document.getElementById("hist-progress");
  if (!names.length) { el.innerHTML = `<p class="empty-note">Sin ejercicios.</p>`; return; }

  const isTime = isTimeExercise(histExercise);
  const h = exerciseHistory(histExercise);
  const select = `<select class="hist-ex-select" id="hist-ex-select">${names.map((n) => `<option value="${n}" ${n === histExercise ? "selected" : ""}>${n}${exerciseHistory(n).length ? "" : " (sin datos)"}</option>`).join("")}</select>`;

  if (!h.length) {
    el.innerHTML = `<div class="card-head"><span class="card-label">Progreso por ejercicio</span></div>${select}<p class="empty-note">Aún no has registrado series de este ejercicio.</p>`;
    bindHistSelect();
    return;
  }
  const maxes = h.map((x) => maxOfSets(x.sets, isTime));
  const pr = Math.max(...maxes);
  const first = maxes[0], last = maxes[maxes.length - 1];
  const delta = last - first;
  const unit = isTime ? "s" : "kg";
  const log = [...h].reverse().slice(0, 12).map((x) => {
    const m = maxOfSets(x.sets, isTime);
    return `<div class="prog-log-row"><span class="d">${fmtDate(x.iso)} · ${x.day}</span><span class="s">${x.sets.map((s) => (setValue(s, isTime) === m && m === pr ? `<b>${fmtSet(s, isTime)}</b>` : fmtSet(s, isTime))).join(" · ")}</span></div>`;
  }).join("");

  el.innerHTML = `
    <div class="card-head"><span class="card-label">Progreso por ejercicio</span><span class="aside">${h.length} ${h.length === 1 ? "sesión" : "sesiones"}</span></div>
    ${select}
    <div class="prog-stats">
      <div class="prog-stat"><div class="val accent">${fmtKg(pr)}<small style="font-size:11px;font-weight:500;"> ${unit}</small></div><div class="lbl">Récord</div></div>
      <div class="prog-stat"><div class="val">${delta > 0 ? "+" : ""}${fmtKg(delta)}<small style="font-size:11px;font-weight:500;"> ${unit}</small></div><div class="lbl">Desde ${fmtDate(h[0].iso)}</div></div>
      <div class="prog-stat"><div class="val">${isTime ? fmtKg(last) + "s" : fmtKg(volumeOfSets(h[h.length - 1].sets))}</div><div class="lbl">${isTime ? "Última" : "Volumen últ. (kg)"}</div></div>
    </div>
    <div class="chart-wrap"><canvas id="hist-chart"></canvas></div>
    ${log}
  `;
  bindHistSelect();
  requestAnimationFrame(() => drawLineChart(document.getElementById("hist-chart"), h.map((x) => x.iso), maxes, { unit, highlightMax: true }));
}
function bindHistSelect() {
  document.getElementById("hist-ex-select")?.addEventListener("change", (e) => { histExercise = e.target.value; renderExerciseProgress(realSessions()); });
}

function renderSessionList(sessions) {
  const el = document.getElementById("hist-sessions");
  if (!sessions.length) {
    el.innerHTML = `<div class="card-label">Sesiones</div><div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-5 3 3 5-7"/></svg></div><p class="empty-note">Tu primera sesión aparecerá aquí en cuanto registres una serie.</p></div>`;
    return;
  }
  const recent = [...sessions].reverse().slice(0, 20);
  el.innerHTML = `
    <div class="card-head"><span class="card-label">Sesiones</span><span class="aside">toca para ver series</span></div>
    ${recent.map((s) => {
      const exs = Object.entries(s.exercises).filter(([, e]) => e.sets && e.sets.some(Boolean));
      const setsN = exs.reduce((n, [, e]) => n + e.sets.filter(Boolean).length, 0);
      const vol = exs.reduce((v, [, e]) => v + volumeOfSets(e.sets.filter(Boolean)), 0);
      const d = parseISO(s.iso);
      return `
        <div class="sess-row ${openSessions.has(s.iso) ? "open" : ""}" data-sess="${s.iso}">
          <div class="sess-head">
            <div class="sess-title"><span class="sess-day ${s.day}">${s.day}</span><div><div class="t">${dayNameEs(d)} ${fmtDate(s.iso)}</div><div class="d">${exs.length} ejercicios · ${setsN} series</div></div></div>
            <span class="sess-meta">${vol ? fmtKg(vol) + " kg" : ""}</span>
          </div>
          <div class="sess-body">
            ${exs.map(([n, e]) => `<div class="sess-ex"><span class="n">${n}</span><span class="s">${e.sets.filter(Boolean).map((x) => fmtSet(x, isTimeExercise(n))).join(" · ")}</span></div>`).join("")}
          </div>
        </div>`;
    }).join("")}
  `;
  el.querySelectorAll(".sess-head").forEach((hd) => hd.addEventListener("click", () => {
    const row = hd.parentElement, iso = row.dataset.sess;
    openSessions.has(iso) ? openSessions.delete(iso) : openSessions.add(iso);
    row.classList.toggle("open");
  }));
}

function renderDataCard() {
  const el = document.getElementById("hist-data");
  el.innerHTML = `
    <div class="card-label">Copia de seguridad</div>
    <div class="data-row">
      <button class="ghost small" id="export-btn">Exportar JSON</button>
      <button class="ghost small" id="import-btn">Importar</button>
      <input type="file" id="import-file" accept="application/json" style="display:none;">
    </div>
    <p class="data-note">Los datos viven en este navegador. Exporta de vez en cuando por si cambias de móvil o borras el historial del navegador.</p>
  `;
  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `entreno-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.workouts || !data.weights) throw new Error("formato");
        if (!confirm("Esto reemplaza los datos actuales por los del archivo. ¿Seguir?")) return;
        store = data;
        saveStore(store);
        location.reload();
      } catch { alert("No se pudo leer el archivo."); }
    };
    r.readAsText(f);
  });
}

// ================= Gráficos =================
function setupCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}
const C = {
  accent: "#38f0b0", accent2: "#3fd0ff", history: "#b48cff", muted: "#7f8aa6", dim: "#3a4460", grid: "rgba(140,170,255,0.10)", text: "#eef3ff",
};

function drawLineChart(canvas, labels, values, { unit = "", highlightMax = false } = {}) {
  if (!canvas) return;
  const { ctx, w, h } = setupCanvas(canvas);
  if (values.length < 2) {
    ctx.fillStyle = C.muted; ctx.font = "12px Outfit, sans-serif";
    ctx.fillText(values.length === 1 ? `Una sesión: ${fmtKg(values[0])} ${unit}. Con la segunda verás la línea.` : "Sin datos", 10, h / 2);
    return;
  }
  const padL = 34, padR = 14, padT = 18, padB = 24;
  const cw = w - padL - padR, ch = h - padT - padB;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(max - min, isFinite(max) ? Math.max(2.5, max * 0.1) : 1);
  const lo = min - span * 0.25, hi = max + span * 0.25;
  const X = (i) => padL + (i / (values.length - 1)) * cw;
  const Y = (v) => padT + ch - ((v - lo) / (hi - lo)) * ch;

  // grid + ejes
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.fillStyle = C.muted; ctx.font = "10px JetBrains Mono, monospace"; ctx.textAlign = "right";
  [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].forEach((v) => {
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(fmtKg(Math.round(v * 2) / 2), padL - 6, y + 3);
  });
  ctx.textAlign = "center";
  const step = Math.ceil(values.length / 6);
  labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) ctx.fillText(fmtDate(l), X(i), h - 6); });

  // área
  const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
  grad.addColorStop(0, "rgba(56,240,176,0.25)"); grad.addColorStop(1, "rgba(56,240,176,0)");
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.lineTo(X(values.length - 1), padT + ch); ctx.lineTo(X(0), padT + ch); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // línea con gradiente
  const lg = ctx.createLinearGradient(padL, 0, w - padR, 0);
  lg.addColorStop(0, C.accent); lg.addColorStop(1, C.accent2);
  ctx.strokeStyle = lg; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(56,240,176,0.5)"; ctx.shadowBlur = 8;
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // puntos
  values.forEach((v, i) => {
    const isMax = highlightMax && v === max;
    ctx.beginPath(); ctx.arc(X(i), Y(v), isMax ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isMax ? C.text : "#0f1523"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = isMax ? C.accent : C.accent2; ctx.stroke();
  });
  // etiqueta del último valor
  const li = values.length - 1;
  ctx.fillStyle = C.text; ctx.font = "600 11px Outfit, sans-serif"; ctx.textAlign = "right";
  ctx.fillText(`${fmtKg(values[li])} ${unit}`, X(li) - 2, Y(values[li]) - 10);
}

// ================= Vista: PESO =================
function renderWeightView() {
  const input = document.getElementById("weight-input");
  document.getElementById("weight-save").onclick = () => {
    const v = parseFloat(input.value);
    if (isNaN(v) || v <= 0) return;
    const t = todayISO();
    const existing = store.weights.find((w) => w.date === t);
    if (existing) existing.w = v; else store.weights.push({ date: t, w: v });
    store.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
    saveStore(store);
    input.value = "";
    drawWeightChart();
    renderWeightHistory();
  };
  drawWeightChart();
  renderWeightHistory();
}
function renderWeightHistory() {
  const el = document.getElementById("weight-history");
  if (!store.weights.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v4l3 2"/></svg></div><p class="empty-note">Aún no hay pesadas registradas.</p></div>`;
    return;
  }
  el.innerHTML = [...store.weights].reverse().slice(0, 30).map((w) => `<div class="wh-row"><span>${fmtDate(w.date)}</span><span>${w.w} kg</span></div>`).join("");
}
function movingAverage(arr, n) {
  return arr.map((_, i) => { const s = arr.slice(Math.max(0, i - n + 1), i + 1); return s.reduce((a, p) => a + p.w, 0) / s.length; });
}
function drawWeightChart() {
  const canvas = document.getElementById("weight-chart");
  const { ctx, w, h } = setupCanvas(canvas);
  const data = store.weights;
  const trendEl = document.getElementById("weight-trend");
  if (data.length < 2) {
    ctx.fillStyle = C.muted; ctx.font = "12px Outfit, sans-serif";
    ctx.fillText("Registra al menos 2 pesadas para ver la tendencia", 10, h / 2);
    trendEl.innerHTML = "";
    return;
  }
  const avg = movingAverage(data, 5);
  const pad = 16, cw = w - pad * 2, ch = h - pad * 2;
  const all = data.map((p) => p.w).concat(avg);
  const min = Math.min(...all) - 0.3, max = Math.max(...all) + 0.3;
  const X = (i) => pad + (i / (data.length - 1)) * cw;
  const Y = (v) => pad + ch - ((v - min) / (max - min)) * ch;

  ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5; ctx.beginPath();
  data.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p.w)) : ctx.moveTo(X(i), Y(p.w)))); ctx.stroke();

  const lg = ctx.createLinearGradient(pad, 0, w - pad, 0);
  lg.addColorStop(0, C.accent); lg.addColorStop(1, C.accent2);
  ctx.strokeStyle = lg; ctx.lineWidth = 2.5; ctx.shadowColor = "rgba(56,240,176,0.5)"; ctx.shadowBlur = 8; ctx.beginPath();
  avg.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(X(data.length - 1), Y(avg[avg.length - 1]), 4, 0, Math.PI * 2); ctx.fill();

  const delta = (avg[avg.length - 1] - avg[0]).toFixed(1);
  trendEl.innerHTML = `<span>Media 5 pesadas: <b>${avg[avg.length - 1].toFixed(1)} kg</b></span><span>Periodo: <b>${delta >= 0 ? "+" : ""}${delta} kg</b></span>`;
}
window.addEventListener("resize", () => {
  if (document.getElementById("view-peso").classList.contains("active")) drawWeightChart();
  if (document.getElementById("view-historial").classList.contains("active")) renderExerciseProgress(realSessions());
});

// ================= Init =================
document.addEventListener("touchstart", () => unlockAudio(), { once: true, passive: true });
document.addEventListener("click", () => unlockAudio(), { once: true });
mealSelectedDay = dayNameEs(new Date());
renderHoy();
renderWorkoutView(currentWorkoutDay);
renderWeightView();
renderMealsView();
