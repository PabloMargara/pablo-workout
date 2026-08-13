// ---- Objetivos nutricionales diarios ----
const TARGETS = {
  kcal: 2180,
  protein: 175,
  fat: 70,
  carbs: 210,
};

// ---- Plantillas de entrenamiento (full-body 3x/semana) ----
// Cada ejercicio: scheme (series x reps a mostrar), rest (descanso por defecto en segundos,
// editable luego en la app), type ("reps" = peso+reps, "time" = duración+rondas, para isométricos).
const WORKOUTS = {
  A: {
    name: "Día A",
    exercises: [
      { name: "Sentadilla o prensa", scheme: "4 x 6-8", rest: 120, type: "reps" },
      { name: "Press banca", scheme: "4 x 6-8", rest: 120, type: "reps" },
      { name: "Remo con barra o máquina", scheme: "4 x 8-10", rest: 90, type: "reps" },
      { name: "Press militar mancuerna", scheme: "3 x 8-10", rest: 90, type: "reps" },
      { name: "Curl femoral", scheme: "3 x 10-12", rest: 60, type: "reps" },
      { name: "Plancha", scheme: "3 rondas x 30-45 seg", rest: 45, type: "time" },
    ],
  },
  B: {
    name: "Día B",
    exercises: [
      { name: "Peso muerto (rumano o convencional)", scheme: "4 x 6-8", rest: 150, type: "reps" },
      { name: "Dominadas o jalón al pecho", scheme: "4 x 8-10", rest: 90, type: "reps" },
      { name: "Press inclinado mancuerna", scheme: "3 x 8-10", rest: 90, type: "reps" },
      { name: "Zancadas", scheme: "3 x 10/pierna", rest: 75, type: "reps" },
      { name: "Face pull", scheme: "3 x 12-15", rest: 60, type: "reps" },
      { name: "Curl bíceps + extensión tríceps", scheme: "3 x 10-12", rest: 60, type: "reps" },
    ],
  },
  C: {
    name: "Día C",
    exercises: [
      { name: "Sentadilla frontal o hack squat", scheme: "4 x 8-10", rest: 120, type: "reps" },
      { name: "Press banca agarre cerrado", scheme: "3 x 8-10", rest: 90, type: "reps" },
      { name: "Remo unilateral mancuerna", scheme: "3 x 10-12", rest: 75, type: "reps" },
      { name: "Elevaciones laterales", scheme: "3 x 12-15", rest: 60, type: "reps" },
      { name: "Hip thrust", scheme: "3 x 10-12", rest: 90, type: "reps" },
      { name: "Core (rueda o cable)", scheme: "3 x 12-15", rest: 60, type: "reps" },
    ],
  },
};

// ---- Plan de comidas: 7 días, cada uno intercambiable con cualquier otro ----
const MEALS = {
  Lunes: {
    Desayuno: {
      text: "Tostadas integrales (2) con aguacate y 2 huevos revueltos + café",
      kcal: 480, protein: 28,
      ingredients: [
        { name: "Pan integral", qty: 2, unit: "rebanada", cat: "carbo" },
        { name: "Aguacate", qty: 0.5, unit: "unidad", cat: "verdura" },
        { name: "Huevos", qty: 2, unit: "unidad", cat: "proteina" },
      ],
    },
    Comida: {
      text: "Pechuga de pollo plancha (180g), arroz integral (80g crudo), verduras salteadas, AOVE",
      kcal: 700, protein: 52,
      ingredients: [
        { name: "Pechuga de pollo", qty: 180, unit: "g", cat: "proteina" },
        { name: "Arroz integral", qty: 80, unit: "g", cat: "carbo" },
        { name: "Verduras salteadas (pimiento/calabacín)", qty: 200, unit: "g", cat: "verdura" },
        { name: "Aceite de oliva virgen extra", qty: 15, unit: "ml", cat: "otros" },
      ],
    },
    Merienda: {
      text: "Yogur griego (200g) con nueces y miel",
      kcal: 280, protein: 18,
      ingredients: [
        { name: "Yogur griego", qty: 200, unit: "g", cat: "lacteo" },
        { name: "Nueces", qty: 20, unit: "g", cat: "otros" },
        { name: "Miel", qty: 10, unit: "g", cat: "otros" },
      ],
    },
    Cena: {
      text: "Salmón al horno (150g), boniato asado, ensalada verde",
      kcal: 560, protein: 38,
      ingredients: [
        { name: "Salmón", qty: 150, unit: "g", cat: "proteina" },
        { name: "Boniato", qty: 200, unit: "g", cat: "carbo" },
        { name: "Ensalada verde (lechuga/tomate)", qty: 150, unit: "g", cat: "verdura" },
      ],
    },
    Extra: {
      text: "Batido de proteína (1 scoop) — opcional si te falta proteína",
      kcal: 120, protein: 25,
      ingredients: [{ name: "Proteína en polvo", qty: 30, unit: "g", cat: "otros" }],
    },
  },
  Martes: {
    Desayuno: {
      text: "Porridge de avena (60g) con leche, plátano y crema de cacahuete (1 cda)",
      kcal: 470, protein: 20,
      ingredients: [
        { name: "Avena", qty: 60, unit: "g", cat: "carbo" },
        { name: "Leche", qty: 200, unit: "ml", cat: "lacteo" },
        { name: "Plátano", qty: 1, unit: "unidad", cat: "verdura" },
        { name: "Crema de cacahuete", qty: 15, unit: "g", cat: "otros" },
      ],
    },
    Comida: {
      text: "Ternera magra picada (180g) con pasta integral (80g crudo) y tomate/verduras",
      kcal: 720, protein: 48,
      ingredients: [
        { name: "Ternera picada magra", qty: 180, unit: "g", cat: "proteina" },
        { name: "Pasta integral", qty: 80, unit: "g", cat: "carbo" },
        { name: "Tomate triturado / verduras", qty: 200, unit: "g", cat: "verdura" },
      ],
    },
    Merienda: {
      text: "2 huevos duros + fruta",
      kcal: 260, protein: 16,
      ingredients: [
        { name: "Huevos", qty: 2, unit: "unidad", cat: "proteina" },
        { name: "Fruta (manzana/pera)", qty: 1, unit: "unidad", cat: "verdura" },
      ],
    },
    Cena: {
      text: "Merluza a la plancha (200g), patata cocida, espárragos",
      kcal: 520, protein: 42,
      ingredients: [
        { name: "Merluza", qty: 200, unit: "g", cat: "proteina" },
        { name: "Patata", qty: 200, unit: "g", cat: "carbo" },
        { name: "Espárragos", qty: 150, unit: "g", cat: "verdura" },
      ],
    },
    Extra: {
      text: "Batido de proteína (1 scoop) — opcional",
      kcal: 120, protein: 25,
      ingredients: [{ name: "Proteína en polvo", qty: 30, unit: "g", cat: "otros" }],
    },
  },
  Miércoles: {
    Desayuno: {
      text: "Tostadas con queso fresco batido, tomate y jamón (2 lonchas)",
      kcal: 440, protein: 30,
      ingredients: [
        { name: "Pan integral", qty: 2, unit: "rebanada", cat: "carbo" },
        { name: "Queso fresco batido", qty: 100, unit: "g", cat: "lacteo" },
        { name: "Tomate", qty: 1, unit: "unidad", cat: "verdura" },
        { name: "Jamón (cocido o serrano)", qty: 2, unit: "loncha", cat: "proteina" },
      ],
    },
    Comida: {
      text: "Lentejas estofadas con verduras (plato generoso) + huevo duro",
      kcal: 680, protein: 38,
      ingredients: [
        { name: "Lentejas (crudas)", qty: 90, unit: "g", cat: "carbo" },
        { name: "Verduras para estofado (zanahoria/cebolla/pimiento)", qty: 150, unit: "g", cat: "verdura" },
        { name: "Huevos", qty: 1, unit: "unidad", cat: "proteina" },
      ],
    },
    Merienda: {
      text: "Yogur griego con fruta y granola (30g)",
      kcal: 300, protein: 16,
      ingredients: [
        { name: "Yogur griego", qty: 150, unit: "g", cat: "lacteo" },
        { name: "Fruta", qty: 1, unit: "unidad", cat: "verdura" },
        { name: "Granola", qty: 30, unit: "g", cat: "carbo" },
      ],
    },
    Cena: {
      text: "Pechuga de pavo plancha (180g), quinoa (60g cruda), pimientos asados",
      kcal: 560, protein: 46,
      ingredients: [
        { name: "Pechuga de pavo", qty: 180, unit: "g", cat: "proteina" },
        { name: "Quinoa", qty: 60, unit: "g", cat: "carbo" },
        { name: "Pimientos", qty: 150, unit: "g", cat: "verdura" },
      ],
    },
    Extra: {
      text: "Batido de proteína (1 scoop) — opcional",
      kcal: 120, protein: 25,
      ingredients: [{ name: "Proteína en polvo", qty: 30, unit: "g", cat: "otros" }],
    },
  },
  Jueves: {
    Desayuno: {
      text: "Tortitas de avena y claras (3) con fruta",
      kcal: 450, protein: 26,
      ingredients: [
        { name: "Avena", qty: 50, unit: "g", cat: "carbo" },
        { name: "Claras de huevo", qty: 5, unit: "unidad", cat: "proteina" },
        { name: "Fruta", qty: 1, unit: "unidad", cat: "verdura" },
      ],
    },
    Comida: {
      text: "Salmón al horno (180g), arroz basmati (80g crudo), brócoli",
      kcal: 700, protein: 44,
      ingredients: [
        { name: "Salmón", qty: 180, unit: "g", cat: "proteina" },
        { name: "Arroz basmati", qty: 80, unit: "g", cat: "carbo" },
        { name: "Brócoli", qty: 200, unit: "g", cat: "verdura" },
      ],
    },
    Merienda: {
      text: "Batido de proteína + puñado de almendras",
      kcal: 280, protein: 30,
      ingredients: [
        { name: "Proteína en polvo", qty: 30, unit: "g", cat: "otros" },
        { name: "Almendras", qty: 20, unit: "g", cat: "otros" },
      ],
    },
    Cena: {
      text: "Revuelto de 3 huevos con champiñones y jamón + pan integral",
      kcal: 520, protein: 34,
      ingredients: [
        { name: "Huevos", qty: 3, unit: "unidad", cat: "proteina" },
        { name: "Champiñones", qty: 100, unit: "g", cat: "verdura" },
        { name: "Jamón (cocido o serrano)", qty: 50, unit: "g", cat: "proteina" },
        { name: "Pan integral", qty: 1, unit: "rebanada", cat: "carbo" },
      ],
    },
    Extra: {
      text: "Fruta o yogur si queda margen calórico",
      kcal: 100, protein: 5,
      ingredients: [{ name: "Fruta", qty: 1, unit: "unidad", cat: "verdura" }],
    },
  },
  Viernes: {
    Desayuno: {
      text: "Tostadas integrales con aguacate, huevo poché y salmón ahumado",
      kcal: 500, protein: 30,
      ingredients: [
        { name: "Pan integral", qty: 2, unit: "rebanada", cat: "carbo" },
        { name: "Aguacate", qty: 0.5, unit: "unidad", cat: "verdura" },
        { name: "Huevos", qty: 1, unit: "unidad", cat: "proteina" },
        { name: "Salmón ahumado", qty: 50, unit: "g", cat: "proteina" },
      ],
    },
    Comida: {
      text: "Garbanzos con espinacas y bacalao (o pollo), plato generoso",
      kcal: 690, protein: 42,
      ingredients: [
        { name: "Garbanzos cocidos", qty: 200, unit: "g", cat: "carbo" },
        { name: "Espinacas", qty: 100, unit: "g", cat: "verdura" },
        { name: "Bacalao (o pollo)", qty: 150, unit: "g", cat: "proteina" },
      ],
    },
    Merienda: {
      text: "Yogur griego con miel y nueces",
      kcal: 280, protein: 18,
      ingredients: [
        { name: "Yogur griego", qty: 200, unit: "g", cat: "lacteo" },
        { name: "Miel", qty: 10, unit: "g", cat: "otros" },
        { name: "Nueces", qty: 20, unit: "g", cat: "otros" },
      ],
    },
    Cena: {
      text: "Pollo al curry con verduras y arroz integral (60g crudo)",
      kcal: 580, protein: 40,
      ingredients: [
        { name: "Pechuga de pollo", qty: 180, unit: "g", cat: "proteina" },
        { name: "Verduras para curry (cebolla/pimiento/calabacín)", qty: 200, unit: "g", cat: "verdura" },
        { name: "Arroz integral", qty: 60, unit: "g", cat: "carbo" },
      ],
    },
    Extra: {
      text: "Batido de proteína (1 scoop) — opcional",
      kcal: 120, protein: 25,
      ingredients: [{ name: "Proteína en polvo", qty: 30, unit: "g", cat: "otros" }],
    },
  },
  Sábado: {
    Desayuno: {
      text: "Tortilla francesa (3 huevos) con pan integral y tomate",
      kcal: 460, protein: 30,
      ingredients: [
        { name: "Huevos", qty: 3, unit: "unidad", cat: "proteina" },
        { name: "Pan integral", qty: 2, unit: "rebanada", cat: "carbo" },
        { name: "Tomate", qty: 1, unit: "unidad", cat: "verdura" },
      ],
    },
    Comida: {
      text: "Comida libre/flexible — apunta a ~700 kcal, prioriza proteína (carne, pescado o legumbre + verdura)",
      kcal: 700, protein: 45,
      ingredients: [],
    },
    Merienda: {
      text: "Fruta + puñado de frutos secos",
      kcal: 250, protein: 8,
      ingredients: [
        { name: "Fruta", qty: 1, unit: "unidad", cat: "verdura" },
        { name: "Frutos secos mix", qty: 25, unit: "g", cat: "otros" },
      ],
    },
    Cena: {
      text: "Poke bowl casero: atún, arroz, edamame, aguacate",
      kcal: 600, protein: 40,
      ingredients: [
        { name: "Atún (fresco o en conserva)", qty: 150, unit: "g", cat: "proteina" },
        { name: "Arroz", qty: 80, unit: "g", cat: "carbo" },
        { name: "Edamame", qty: 80, unit: "g", cat: "verdura" },
        { name: "Aguacate", qty: 0.5, unit: "unidad", cat: "verdura" },
      ],
    },
    Extra: {
      text: "Margen social (cena fuera, alguna copa) — el plan aguanta un desvío puntual",
      kcal: 150, protein: 0,
      ingredients: [],
    },
  },
  Domingo: {
    Desayuno: {
      text: "Yogur griego con avena, fruta y miel",
      kcal: 420, protein: 24,
      ingredients: [
        { name: "Yogur griego", qty: 200, unit: "g", cat: "lacteo" },
        { name: "Avena", qty: 40, unit: "g", cat: "carbo" },
        { name: "Fruta", qty: 1, unit: "unidad", cat: "verdura" },
        { name: "Miel", qty: 10, unit: "g", cat: "otros" },
      ],
    },
    Comida: {
      text: "Arroz con pollo y verduras (estilo paella ligera)",
      kcal: 720, protein: 44,
      ingredients: [
        { name: "Arroz", qty: 80, unit: "g", cat: "carbo" },
        { name: "Pechuga de pollo", qty: 180, unit: "g", cat: "proteina" },
        { name: "Verduras (pimiento/guisantes)", qty: 150, unit: "g", cat: "verdura" },
      ],
    },
    Merienda: {
      text: "Queso fresco (100g) con tomate y AOVE",
      kcal: 220, protein: 18,
      ingredients: [
        { name: "Queso fresco", qty: 100, unit: "g", cat: "lacteo" },
        { name: "Tomate", qty: 1, unit: "unidad", cat: "verdura" },
        { name: "Aceite de oliva virgen extra", qty: 10, unit: "ml", cat: "otros" },
      ],
    },
    Cena: {
      text: "Crema de verduras + tortilla de 2 huevos con espinacas",
      kcal: 480, protein: 28,
      ingredients: [
        { name: "Verduras para crema (calabacín/puerro/patata)", qty: 300, unit: "g", cat: "verdura" },
        { name: "Huevos", qty: 2, unit: "unidad", cat: "proteina" },
        { name: "Espinacas", qty: 50, unit: "g", cat: "verdura" },
      ],
    },
    Extra: {
      text: "Batido de proteína (1 scoop) — opcional",
      kcal: 120, protein: 25,
      ingredients: [{ name: "Proteína en polvo", qty: 30, unit: "g", cat: "otros" }],
    },
  },
};

const DAY_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const CAT_LABELS = {
  proteina: "Proteína",
  lacteo: "Lácteos",
  carbo: "Carbohidratos y legumbres",
  verdura: "Verduras y fruta",
  otros: "Grasas y otros",
};
const CAT_ORDER = ["proteina", "lacteo", "carbo", "verdura", "otros"];

// ---- Genera lista de la compra agregada a partir de una lista de días ----
function buildShoppingList(dayNames) {
  const totals = {};
  dayNames.forEach((day) => {
    const plan = MEALS[day];
    Object.values(plan).forEach((meal) => {
      (meal.ingredients || []).forEach((ing) => {
        const key = ing.name + "|" + ing.unit;
        if (!totals[key]) totals[key] = { name: ing.name, unit: ing.unit, qty: 0, cat: ing.cat };
        totals[key].qty += ing.qty;
      });
    });
  });
  const byCat = {};
  CAT_ORDER.forEach((c) => (byCat[c] = []));
  Object.values(totals).forEach((item) => {
    item.qty = Math.round(item.qty * 10) / 10;
    byCat[item.cat].push(item);
  });
  CAT_ORDER.forEach((c) => byCat[c].sort((a, b) => a.name.localeCompare(b.name, "es")));
  return byCat;
}
