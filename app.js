// ================= Utilidades de almacenamiento =================
const STORE_KEY = "fitlog_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw);
  } catch {
    return { weights: [], workouts: {} }; // workouts: { "2025-08-12": { day:"A", exercises:[{name,sets:[{w,r}]}] } }
  }
}
function saveStore(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}
let store = loadStore();

// Iconos SVG inline (sin dependencias externas) — sustituyen a los emoji como iconos funcionales.
const ICON_X = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const ICON_PLAY = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

// Inicializa la plantilla editable de ejercicios (copia de WORKOUTS la primera vez,
// luego vive en store y el usuario puede añadir/quitar libremente).
if (!store.workoutPlan) store.workoutPlan = {};
Object.keys(WORKOUTS).forEach((k) => {
  if (!store.workoutPlan[k]) {
    store.workoutPlan[k] = WORKOUTS[k].exercises.map((e) => ({ ...e }));
  } else {
    // Migración: rellena campos que puedan faltar en datos guardados con una versión
    // anterior de la app (ej. setsCount no existía todavía). Nunca toca las series
    // ya registradas (viven en store.workouts, no aquí).
    store.workoutPlan[k].forEach((ex) => {
      const template = WORKOUTS[k].exercises.find((t) => t.name === ex.name);
      if (ex.setsCount === undefined) ex.setsCount = template ? template.setsCount : 3;
      if (ex.rest === undefined) ex.rest = template ? template.rest : 60;
      if (ex.type === undefined) ex.type = template ? template.type : "reps";
    });
  }
});
saveStore(store);

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
};

// ================= Navegación =================
const views = ["hoy", "entreno", "peso", "comidas", "compra"];
document.querySelectorAll("nav.tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});
function setView(name) {
  views.forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("active", v === name);
  });
  document.querySelectorAll("nav.tabbar button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  if (name === "peso") drawWeightChart();
  if (name === "compra") renderCompraView();
}

// ================= Vista: HOY =================
function dayNameEs(date) {
  const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return names[date.getDay()];
}

function renderHoy() {
  const now = new Date();
  const dName = dayNameEs(now);

  // resumen semana: nº entrenos últimos 7 días
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const workoutsThisWeek = Object.keys(store.workouts).filter((iso) => new Date(iso) >= cutoff).length;

  const lastWeight = store.weights.length ? store.weights[store.weights.length - 1] : null;

  document.getElementById("hoy-resumen").innerHTML = `
    <h2>${dName} <span class="tag">${now.toLocaleDateString("es-ES", { day: "2-digit", month: "long" })}</span></h2>
    <div class="macro-grid">
      <div class="macro-box"><div class="val">${workoutsThisWeek}/3</div><div class="lbl">Entrenos 7d</div></div>
      <div class="macro-box"><div class="val">${lastWeight ? lastWeight.w : "—"}</div><div class="lbl">Último peso</div></div>
      <div class="macro-box"><div class="val">${TARGETS.kcal}</div><div class="lbl">Kcal objetivo</div></div>
      <div class="macro-box"><div class="val">${TARGETS.protein}g</div><div class="lbl">Prot. objetivo</div></div>
    </div>
  `;

  document.getElementById("hoy-comidas").innerHTML = renderMealCardHTML(dName, true);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tName = dayNameEs(tomorrow);
  const tPlan = MEALS[tName];
  const items = Object.entries(tPlan)
    .filter(([mealName]) => mealName !== "Extra")
    .map(([mealName, m]) => `<div><b>${mealName}:</b> ${m.text}</div>`)
    .join("");
  document.getElementById("hoy-manana").innerHTML = `
    <h2>Mañana (${tName}) <span class="tag">para preparar hoy</span></h2>
    <div class="tomorrow-list">${items}</div>
  `;
}

// ================= Vista: COMIDAS =================
function renderMealCardHTML(dayName, isToday) {
  const plan = MEALS[dayName];
  let totalKcal = 0, totalProt = 0;
  const rows = Object.entries(plan).map(([mealName, m]) => {
    totalKcal += m.kcal;
    totalProt += m.protein;
    return `
      <div class="meal-row">
        <div class="meal-head">
          <span class="meal-name">${mealName}</span>
          <span class="meal-macro">${m.kcal} kcal · ${m.protein}g prot</span>
        </div>
        <div class="meal-text">${m.text}</div>
      </div>`;
  }).join("");

  return `
    <h2>${isToday ? "Comidas de hoy" : dayName} <span class="tag">${dayName}</span></h2>
    <div class="macro-grid" style="margin-bottom:14px;">
      <div class="macro-box kcal-box"><div class="val">${totalKcal}</div><div class="lbl">Kcal día</div></div>
      <div class="macro-box protein-box"><div class="val">${totalProt}g</div><div class="lbl">Proteína</div></div>
      <div class="macro-box"><div class="val">${TARGETS.kcal}</div><div class="lbl">Objetivo</div></div>
      <div class="macro-box"><div class="val">${TARGETS.protein}g</div><div class="lbl">Objetivo</div></div>
    </div>
    ${rows}
    <p class="empty-note" style="text-align:left;padding-top:10px;">Cualquier día es intercambiable por otro — todos rondan el mismo objetivo calórico y proteico. Ajusta cantidades según hambre y progreso.</p>
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
        <div class="wd-head">
          <span class="wd-name">${day}</span>
          <span class="wd-macro">${totalKcal} kcal · ${totalProt}g prot</span>
        </div>
        <div class="wd-meals">${mealsLine}</div>
      </div>`;
  }).join("");
  return `<h2>Semana completa <span class="tag">de un vistazo</span></h2>${blocks}`;
}

function renderMealsView() {
  document.getElementById("meal-mode-pills").querySelectorAll(".pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.mode === mealMode);
  });
  document.getElementById("meal-day-pills-wrap").style.display = mealMode === "dia" ? "block" : "none";

  if (mealMode === "semana") {
    document.getElementById("meal-card").innerHTML = renderWeekCardHTML();
    return;
  }

  document.getElementById("meal-pills").innerHTML = DAY_ORDER.map(
    (d) => `<button class="pill ${d === mealSelectedDay ? "active" : ""}" data-day="${d}">${d.slice(0, 3)}</button>`
  ).join("");
  document.getElementById("meal-card").innerHTML = renderMealCardHTML(mealSelectedDay, false);

  document.querySelectorAll("#meal-pills .pill").forEach((p) => {
    p.addEventListener("click", () => {
      mealSelectedDay = p.dataset.day;
      renderMealsView();
    });
  });
}

document.querySelectorAll("#meal-mode-pills .pill").forEach((p) => {
  p.addEventListener("click", () => {
    mealMode = p.dataset.mode;
    renderMealsView();
  });
});

// ================= Vista: COMPRA =================
let compraChecked = new Set(DAY_ORDER);

function renderCompraView() {
  const wrap = document.getElementById("compra-daychecks");
  wrap.innerHTML = DAY_ORDER.map((d) => `
    <label class="daycheck ${compraChecked.has(d) ? "checked" : ""}" data-day="${d}">
      <span class="box"></span>${d.slice(0, 3)}
    </label>
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
    <div class="shop-cat">
      <h3>${CAT_LABELS[c]}</h3>
      ${byCat[c].map((item) => `
        <div class="shop-item">
          <span>${item.name}</span>
          <span class="qty">${item.qty} ${item.unit}${item.qty !== 1 ? (item.unit === "unidad" ? "es" : "") : ""}</span>
        </div>
      `).join("")}
    </div>
  `).join("");

  document.getElementById("compra-list").innerHTML = `
    <h2>Lista de la compra <span class="tag">${compraChecked.size} días</span></h2>
    ${sections}
    <p class="empty-note" style="text-align:left;padding-top:6px;">Los platos "libres" (sábado) no suman ingredientes fijos — decide sobre la marcha.</p>
  `;
}

// ================= Vista: ENTRENO =================
let currentWorkoutDay = "A";
let setTimers = {};        // "exIdx-setIdx" -> { start, interval }
let globalRestTimer = null; // { endsAt, interval, exerciseName }
let audioCtx = null;

const ICON_CHECK = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Truco estándar para desbloquear audio en iOS: reproducir un buffer silencioso
// DENTRO del propio gesto táctil. resume() solo no siempre basta en WebKit.
function unlockAudio() {
  const ctx = getAudioContext();
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) { /* seguimos sin sonido */ }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (!document.hidden && globalRestTimer) {
    renderGlobalRestBar(); // recalcula contra el reloj real al volver
  }
});

function playBeep() {
  try {
    const ctx = getAudioContext();
    const mk = (freq, delayMs, dur) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start();
        osc.stop(ctx.currentTime + dur + 0.05);
      }, delayMs);
    };
    mk(880, 0, 0.5);
    mk(1046, 250, 0.4);
  } catch (e) { /* audio no disponible, seguimos sin sonido */ }
}

function getLastSession(dayKey, exerciseName) {
  const entries = Object.entries(store.workouts)
    .filter(([iso, w]) => w.day === dayKey)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  for (const [iso, w] of entries) {
    const savedEx = w.exercises && w.exercises[exerciseName];
    if (savedEx && savedEx.sets && savedEx.sets.some(Boolean)) {
      const doneSets = savedEx.sets.filter(Boolean);
      return { iso, lastSet: doneSets[doneSets.length - 1], sets: doneSets };
    }
  }
  return null;
}

// Sesión de hoy: se crea solo si no existe, nunca se pisa por completo.
// Cada serie se guarda de forma independiente -> añadir/quitar ejercicios nunca borra lo ya hecho.
function ensureTodaySession(dayKey) {
  const today = todayISO();
  if (!store.workouts[today]) {
    store.workouts[today] = { day: dayKey, exercises: {} };
    saveStore(store);
  }
  return store.workouts[today];
}

function adjustRest(dayKey, idx, delta) {
  const ex = store.workoutPlan[dayKey][idx];
  ex.rest = Math.min(300, Math.max(15, (ex.rest || 60) + delta));
  saveStore(store);
  const valEl = document.getElementById(`rest-value-${idx}`);
  if (valEl) valEl.textContent = `${ex.rest}s`;
}

// ---- Barra fija de descanso (global, no depende de qué tarjeta esté visible) ----
function startGlobalRestTimer(seconds, exerciseName) {
  unlockAudio();
  if (globalRestTimer) clearInterval(globalRestTimer.interval);
  globalRestTimer = { endsAt: Date.now() + seconds * 1000, exerciseName };
  saveGlobalRestTimer();
  document.getElementById("global-rest-bar").style.display = "block";
  renderGlobalRestBar();
  globalRestTimer.interval = setInterval(renderGlobalRestBar, 1000);
}

function saveGlobalRestTimer() {
  if (globalRestTimer) {
    localStorage.setItem("fitlog_rest_timer", JSON.stringify({ endsAt: globalRestTimer.endsAt, exerciseName: globalRestTimer.exerciseName }));
  } else {
    localStorage.removeItem("fitlog_rest_timer");
  }
}

function renderGlobalRestBar() {
  if (!globalRestTimer) return;
  const remaining = Math.round((globalRestTimer.endsAt - Date.now()) / 1000);
  const timeEl = document.getElementById("grb-time");
  const labelEl = document.getElementById("grb-label");
  if (!timeEl) return;
  if (remaining <= 0) {
    clearInterval(globalRestTimer.interval);
    timeEl.textContent = "¡Listo!";
    labelEl.textContent = globalRestTimer.exerciseName || "Descanso";
    playBeep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => {
      document.getElementById("global-rest-bar").style.display = "none";
      globalRestTimer = null;
      saveGlobalRestTimer();
    }, 3000);
    return;
  }
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  timeEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
  labelEl.textContent = globalRestTimer.exerciseName || "Descanso";
}

function cancelGlobalRestTimer() {
  if (globalRestTimer) clearInterval(globalRestTimer.interval);
  globalRestTimer = null;
  saveGlobalRestTimer();
  document.getElementById("global-rest-bar").style.display = "none";
}
document.getElementById("grb-cancel").addEventListener("click", cancelGlobalRestTimer);
document.getElementById("grb-plus30").addEventListener("click", () => {
  if (globalRestTimer) {
    globalRestTimer.endsAt += 30000;
    saveGlobalRestTimer();
    renderGlobalRestBar();
  }
});

// Al cargar la app: si había un descanso en marcha (aunque se recargara la página), lo recupera.
(function restoreRestTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem("fitlog_rest_timer"));
    if (saved && saved.endsAt > Date.now()) {
      globalRestTimer = { endsAt: saved.endsAt, exerciseName: saved.exerciseName };
      document.getElementById("global-rest-bar").style.display = "block";
      renderGlobalRestBar();
      globalRestTimer.interval = setInterval(renderGlobalRestBar, 1000);
    } else {
      localStorage.removeItem("fitlog_rest_timer");
    }
  } catch (e) { /* nada que recuperar */ }
})();

// ---- Timer por serie (mide cuánto tarda cada serie; en ejercicios de tiempo ES la duración) ----
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
  if (isTime) {
    setData = { duration: elapsedSec };
  } else {
    const wInput = document.querySelector(`[data-set-weight="${key}"]`);
    const rInput = document.querySelector(`[data-set-reps="${key}"]`);
    setData = {
      w: parseFloat(wInput?.value) || 0,
      r: parseInt(rInput?.value, 10) || 0,
      roundTime: elapsedSec,
    };
  }
  savedEx.sets[setIdx] = setData;
  const setsCount = ex.setsCount || 3;
  savedEx.completed = savedEx.sets.filter(Boolean).length >= setsCount;
  saveStore(store);

  startGlobalRestTimer(ex.rest || 60, ex.name);
  renderExerciseCard(dayKey, exIdx); // solo repinta ESTA tarjeta, no toca timers de otras
}

function getDefaultWeight(savedSets, si, last) {
  for (let k = si - 1; k >= 0; k--) {
    if (savedSets[k]) return savedSets[k].w;
  }
  if (last && last.lastSet && typeof last.lastSet.w === "number") return last.lastSet.w;
  return "";
}

function renderSetRow(exIdx, setIdx, ex, savedSet, defaultWeight) {
  const key = `${exIdx}-${setIdx}`;
  const isTime = ex.type === "time";

  if (savedSet) {
    const resultText = isTime
      ? `${savedSet.duration}s`
      : `${savedSet.w}kg × ${savedSet.r}`;
    return `
      <div class="set-row done" data-set="${key}">
        <span class="set-num">S${setIdx + 1}</span>
        <span class="set-result">${resultText}</span>
        <span class="set-check-badge">${ICON_CHECK}</span>
      </div>`;
  }

  const startBtn = `<button class="set-start-btn" data-set-start="${key}" aria-label="Empezar serie ${setIdx + 1}">${ICON_PLAY}</button>`;

  if (isTime) {
    return `
      <div class="set-row" data-set="${key}">
        <span class="set-num">S${setIdx + 1}</span>
        <span class="set-hint">Mantener</span>
        ${startBtn}
      </div>`;
  }

  return `
    <div class="set-row" data-set="${key}">
      <span class="set-num">S${setIdx + 1}</span>
      <input type="number" step="0.5" inputmode="decimal" class="set-weight" data-set-weight="${key}" placeholder="kg" value="${defaultWeight}">
      <input type="number" inputmode="numeric" class="set-reps" data-set-reps="${key}" placeholder="reps">
      ${startBtn}
    </div>`;
}

function buildExerciseCardHTML(dayKey, exIdx) {
  const exList = store.workoutPlan[dayKey];
  const ex = exList[exIdx];
  const isTime = ex.type === "time";
  const restVal = ex.rest || 60;
  const setsCount = ex.setsCount || 3;

  const session = store.workouts[todayISO()];
  const savedEx = (session && session.exercises[ex.name]) || { completed: false, sets: [] };
  const last = getLastSession(dayKey, ex.name);

  const doneCount = savedEx.sets.filter(Boolean).length;
  const isCompleted = doneCount >= setsCount;

  let lastText;
  if (!last) {
    lastText = "Sin registros previos — anota tu primera marca";
  } else if (isTime) {
    lastText = `Última vez (${fmtDate(last.iso)}): ${last.lastSet.duration}s · ${last.sets.length} series`;
  } else {
    lastText = `Última vez (${fmtDate(last.iso)}): ${last.lastSet.w}kg x ${last.lastSet.r}`;
  }

  const setsHtml = Array.from({ length: setsCount }).map((_, si) => {
    const savedSet = savedEx.sets[si];
    const defaultWeight = getDefaultWeight(savedEx.sets, si, last);
    return renderSetRow(exIdx, si, ex, savedSet, defaultWeight);
  }).join("");

  return `
    <button class="ex-remove" data-remove="${exIdx}" aria-label="Quitar ejercicio">${ICON_X}</button>
    <div class="ex-name">${ex.name}${isCompleted ? `<span class="ex-done-badge">${ICON_CHECK} Hecho</span>` : ""}</div>
    <div class="ex-scheme">${ex.scheme}</div>
    <div class="ex-last">${lastText}</div>
    <div class="ex-rest-row">
      <span class="ex-rest-label">Descanso</span>
      <div class="ex-rest-stepper">
        <button type="button" data-rest-minus="${exIdx}" aria-label="Menos descanso">−</button>
        <span class="ex-rest-value" id="rest-value-${exIdx}">${restVal}s</span>
        <button type="button" data-rest-plus="${exIdx}" aria-label="Más descanso">+</button>
      </div>
    </div>
    <div class="sets-list">${setsHtml}</div>
  `;
}

function attachExerciseCardListeners(dayKey, exIdx) {
  const card = document.querySelector(`.exercise-row[data-ex="${exIdx}"]`);
  if (!card) return;

  card.querySelector(`[data-remove="${exIdx}"]`)?.addEventListener("click", () => {
    store.workoutPlan[dayKey].splice(exIdx, 1);
    saveStore(store);
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
  const ex = store.workoutPlan[dayKey][exIdx];
  const session = store.workouts[todayISO()];
  const savedEx = (session && session.exercises[ex.name]) || { completed: false, sets: [] };
  const isCompleted = savedEx.sets.filter(Boolean).length >= (ex.setsCount || 3);
  if (!card) return;
  card.classList.toggle("completed", isCompleted);
  card.innerHTML = buildExerciseCardHTML(dayKey, exIdx);
  attachExerciseCardListeners(dayKey, exIdx);
}

function renderWorkoutView(dayKey) {
  currentWorkoutDay = dayKey;
  document.getElementById("workout-pills").innerHTML = Object.keys(WORKOUTS).map(
    (k) => `<button class="pill ${k === dayKey ? "active" : ""}" data-day="${k}">${WORKOUTS[k].name}</button>`
  ).join("");

  const dayName = WORKOUTS[dayKey].name;
  const exList = store.workoutPlan[dayKey];
  ensureTodaySession(dayKey);

  const cardsHtml = exList.map((ex, i) => `<div class="exercise-row" data-ex="${i}"></div>`).join("");

  document.getElementById("workout-card").innerHTML = `
    <h2>${dayName} <span class="tag">${todayISO()}</span></h2>
    ${cardsHtml || '<p class="empty-note">Sin ejercicios en este día — añade alguno abajo.</p>'}

    <div class="add-exercise">
      <div class="add-exercise-inputs">
        <input type="text" id="new-ex-name" placeholder="Nombre del ejercicio">
        <input type="text" id="new-ex-scheme" placeholder="Series x reps (ej. 3 x 10-12)">
        <select id="new-ex-type">
          <option value="reps">Reps y peso</option>
          <option value="time">Tiempo (ej. plancha)</option>
        </select>
        <div class="add-exercise-row2">
          <input type="number" id="new-ex-sets" placeholder="Nº series" value="3" min="1" max="10">
          <input type="number" id="new-ex-rest" placeholder="Descanso (seg)" value="60">
        </div>
      </div>
      <button class="ghost" id="add-exercise-btn" style="width:100%;">+ Añadir ejercicio</button>
    </div>
    <button class="ghost" id="reset-day-btn" style="width:100%;margin-top:8px;">Restaurar plantilla original de ${dayName}</button>
  `;

  exList.forEach((_, i) => renderExerciseCard(dayKey, i));

  document.querySelectorAll("#workout-pills .pill").forEach((p) => {
    p.addEventListener("click", () => renderWorkoutView(p.dataset.day));
  });

  document.getElementById("add-exercise-btn").addEventListener("click", () => {
    const nameInput = document.getElementById("new-ex-name");
    const schemeInput = document.getElementById("new-ex-scheme");
    const typeSel = document.getElementById("new-ex-type");
    const setsInput = document.getElementById("new-ex-sets");
    const restInput = document.getElementById("new-ex-rest");
    const name = nameInput.value.trim();
    const scheme = schemeInput.value.trim() || "3 x 10-12";
    const type = typeSel.value;
    const setsCount = parseInt(setsInput.value, 10) || 3;
    const rest = parseInt(restInput.value, 10) || 60;
    if (!name) { nameInput.focus(); return; }
    // Solo modifica la plantilla (workoutPlan); las series ya guardadas de otros
    // ejercicios viven en session.exercises por nombre y no se tocan aquí.
    store.workoutPlan[dayKey].push({ name, scheme, type, rest, setsCount });
    saveStore(store);
    renderWorkoutView(dayKey);
  });

  document.getElementById("reset-day-btn").addEventListener("click", () => {
    store.workoutPlan[dayKey] = WORKOUTS[dayKey].exercises.map((e) => ({ ...e }));
    saveStore(store);
    renderWorkoutView(dayKey);
  });
}
// ================= Vista: PESO =================
function renderWeightView() {
  const input = document.getElementById("weight-input");
  document.getElementById("weight-save").onclick = () => {
    const v = parseFloat(input.value);
    if (isNaN(v) || v <= 0) return;
    store.weights.push({ date: todayISO(), w: v });
    store.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
    saveStore(store);
    input.value = "";
    drawWeightChart();
    renderWeightHistory();
    renderHoy();
  };
  drawWeightChart();
  renderWeightHistory();
}

function renderWeightHistory() {
  const el = document.getElementById("weight-history");
  if (!store.weights.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v4l3 2"/></svg></div>
        <p class="empty-note">Aún no hay pesadas registradas.</p>
      </div>`;
    return;
  }
  const rows = [...store.weights].reverse().slice(0, 20).map(
    (w) => `<div class="wh-row"><span>${fmtDate(w.date)}</span><span>${w.w} kg</span></div>`
  ).join("");
  el.innerHTML = rows;
}

function movingAverage(arr, windowSize) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = arr.slice(start, i + 1);
    const avg = slice.reduce((s, p) => s + p.w, 0) / slice.length;
    return avg;
  });
}

function drawWeightChart() {
  const canvas = document.getElementById("weight-chart");
  const ctx = canvas.getContext("2d");
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const data = store.weights;
  const trendEl = document.getElementById("weight-trend");

  if (data.length < 2) {
    ctx.fillStyle = "#8891a8";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("Registra al menos 2 pesadas para ver la tendencia", 10, rect.height / 2);
    trendEl.innerHTML = "";
    return;
  }

  const avg = movingAverage(data, 5);
  const pad = 16;
  const w = rect.width - pad * 2;
  const h = rect.height - pad * 2;

  const allVals = data.map((p) => p.w).concat(avg);
  const min = Math.min(...allVals) - 0.3;
  const max = Math.max(...allVals) + 0.3;
  const xStep = w / (data.length - 1);
  const yPos = (v) => pad + h - ((v - min) / (max - min)) * h;

  // raw points (dim)
  ctx.strokeStyle = "#2a324a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  data.forEach((p, i) => {
    const x = pad + i * xStep;
    const y = yPos(p.w);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // moving average (accent)
  ctx.strokeStyle = "#e8a33d";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  avg.forEach((v, i) => {
    const x = pad + i * xStep;
    const y = yPos(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // last point dot
  const lastX = pad + (data.length - 1) * xStep;
  const lastY = yPos(avg[avg.length - 1]);
  ctx.fillStyle = "#e8a33d";
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  const first = avg[0];
  const last = avg[avg.length - 1];
  const delta = (last - first).toFixed(1);
  const sign = delta >= 0 ? "+" : "";
  trendEl.innerHTML = `
    <span>Media móvil (5 pesadas): <b>${last.toFixed(1)} kg</b></span>
    <span>Cambio en el periodo: <b>${sign}${delta} kg</b></span>
  `;
}

window.addEventListener("resize", () => {
  if (document.getElementById("view-peso").classList.contains("active")) drawWeightChart();
});

// ================= Init =================
document.addEventListener("touchstart", () => unlockAudio(), { once: true, passive: true });
document.addEventListener("click", () => unlockAudio(), { once: true });
mealSelectedDay = dayNameEs(new Date());
renderHoy();
renderWorkoutView("A");
renderWeightView();
renderMealsView();
