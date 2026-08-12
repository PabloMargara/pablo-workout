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

// Inicializa la plantilla editable de ejercicios (copia de WORKOUTS la primera vez,
// luego vive en store y el usuario puede añadir/quitar libremente).
if (!store.workoutPlan) store.workoutPlan = {};
Object.keys(WORKOUTS).forEach((k) => {
  if (!store.workoutPlan[k]) {
    store.workoutPlan[k] = WORKOUTS[k].exercises.map((e) => ({ ...e }));
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

  const kcalClass = Math.abs(totalKcal - TARGETS.kcal) <= 150 ? "on-target" : "off-target";
  const protClass = totalProt >= TARGETS.protein - 10 ? "on-target" : "off-target";

  return `
    <h2>${isToday ? "Comidas de hoy" : dayName} <span class="tag">${dayName}</span></h2>
    <div class="macro-grid" style="margin-bottom:14px;">
      <div class="macro-box ${kcalClass}"><div class="val">${totalKcal}</div><div class="lbl">Kcal día</div></div>
      <div class="macro-box ${protClass}"><div class="val">${totalProt}g</div><div class="lbl">Proteína</div></div>
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

function getLastSession(dayKey, exerciseName) {
  const entries = Object.entries(store.workouts)
    .filter(([iso, w]) => w.day === dayKey)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  for (const [iso, w] of entries) {
    const ex = w.exercises.find((e) => e.name === exerciseName);
    if (ex && ex.sets.length) {
      const best = ex.sets.reduce((a, b) => (b.w > a.w ? b : a), ex.sets[0]);
      return { iso, best };
    }
  }
  return null;
}

function renderWorkoutView(dayKey) {
  currentWorkoutDay = dayKey;
  document.getElementById("workout-pills").innerHTML = Object.keys(WORKOUTS).map(
    (k) => `<button class="pill ${k === dayKey ? "active" : ""}" data-day="${k}">${WORKOUTS[k].name}</button>`
  ).join("");

  const dayName = WORKOUTS[dayKey].name;
  const exList = store.workoutPlan[dayKey]; // editable: nombre + esquema
  const existing = store.workouts[todayISO()];
  const alreadyLoggedToday = existing && existing.day === dayKey;

  const rows = exList.map((ex, i) => {
    const last = getLastSession(dayKey, ex.name);
    const lastText = last
      ? `Última vez (${fmtDate(last.iso)}): ${last.best.w}kg x ${last.best.r}`
      : "Sin registros previos — anota tu primera marca";
    const savedSets = alreadyLoggedToday
      ? existing.exercises.find((e) => e.name === ex.name)
      : null;
    const w0 = savedSets && savedSets.sets[0] ? savedSets.sets[0].w : "";
    const r0 = savedSets && savedSets.sets[0] ? savedSets.sets[0].r : "";

    return `
      <div class="exercise-row" data-ex="${i}">
        <button class="ex-remove" data-remove="${i}" aria-label="Quitar ejercicio">×</button>
        <div class="ex-name">${ex.name}</div>
        <div class="ex-scheme">${ex.scheme}</div>
        <div class="ex-last">${lastText}</div>
        <div class="set-inputs">
          <input type="number" step="0.5" inputmode="decimal" placeholder="Peso (kg)" class="in-weight" value="${w0}">
          <input type="number" inputmode="numeric" placeholder="Reps" class="in-reps" value="${r0}">
        </div>
      </div>`;
  }).join("");

  document.getElementById("workout-card").innerHTML = `
    <h2>${dayName} <span class="tag">${alreadyLoggedToday ? "guardado hoy" : todayISO()}</span></h2>
    ${rows || '<p class="empty-note">Sin ejercicios en este día — añade alguno abajo.</p>'}
    <button class="primary" id="save-workout">Guardar sesión de hoy</button>

    <div class="add-exercise">
      <div class="add-exercise-inputs">
        <input type="text" id="new-ex-name" placeholder="Nombre del ejercicio">
        <input type="text" id="new-ex-scheme" placeholder="Series x reps (ej. 3 x 10-12)">
      </div>
      <button class="ghost" id="add-exercise-btn" style="width:100%;">+ Añadir ejercicio</button>
    </div>
    <button class="ghost" id="reset-day-btn" style="width:100%;margin-top:8px;">Restaurar plantilla original de ${dayName}</button>
  `;

  document.querySelectorAll("#workout-pills .pill").forEach((p) => {
    p.addEventListener("click", () => renderWorkoutView(p.dataset.day));
  });

  document.querySelectorAll(".ex-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.remove, 10);
      store.workoutPlan[dayKey].splice(idx, 1);
      saveStore(store);
      renderWorkoutView(dayKey);
    });
  });

  document.getElementById("add-exercise-btn").addEventListener("click", () => {
    const nameInput = document.getElementById("new-ex-name");
    const schemeInput = document.getElementById("new-ex-scheme");
    const name = nameInput.value.trim();
    const scheme = schemeInput.value.trim() || "3 x 10-12";
    if (!name) { nameInput.focus(); return; }
    store.workoutPlan[dayKey].push({ name, scheme });
    saveStore(store);
    renderWorkoutView(dayKey);
  });

  document.getElementById("reset-day-btn").addEventListener("click", () => {
    store.workoutPlan[dayKey] = WORKOUTS[dayKey].exercises.map((e) => ({ ...e }));
    saveStore(store);
    renderWorkoutView(dayKey);
  });

  document.getElementById("save-workout").addEventListener("click", () => {
    const exercises = [];
    document.querySelectorAll("#workout-card .exercise-row").forEach((row, i) => {
      const wVal = parseFloat(row.querySelector(".in-weight").value);
      const rVal = parseInt(row.querySelector(".in-reps").value, 10);
      exercises.push({
        name: exList[i].name,
        sets: (!isNaN(wVal) && !isNaN(rVal)) ? [{ w: wVal, r: rVal }] : [],
      });
    });
    store.workouts[todayISO()] = { day: dayKey, exercises };
    saveStore(store);
    renderWorkoutView(dayKey);
    renderHoy();
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
    el.innerHTML = `<p class="empty-note">Aún no hay pesadas registradas.</p>`;
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
mealSelectedDay = dayNameEs(new Date());
renderHoy();
renderWorkoutView("A");
renderWeightView();
renderMealsView();
