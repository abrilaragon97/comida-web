/* =============================================
   COOLFOOD LAB — app.js
   Motor de simulación: Ley de Newton + RK4
   Visualización interactiva con Chart.js
   ============================================= */

"use strict";

// ─────────────────────────────────────────────
// 1. DATOS DE ALIMENTOS
// ─────────────────────────────────────────────
const FOODS = {
  pizza: {
    name: "Pizza",
    emoji: "🍕",
    T0: 95,          // Temperatura inicial °C
    k: 0.035,        // Constante de enfriamiento min⁻¹
    color: "#e8341a",
    colorGlow: "rgba(232,52,26,0.25)",
    svgId: "anim-pizza",
    stageGradient: "radial-gradient(circle at 50% 70%, rgba(232,52,26,0.18), transparent 70%)",
    safeTempTarget: 40,
  },
  pollo: {
    name: "Pollo Asado",
    emoji: "🍗",
    T0: 88,
    k: 0.028,
    color: "#f4a940",
    colorGlow: "rgba(244,169,64,0.25)",
    svgId: "anim-pollo",
    stageGradient: "radial-gradient(circle at 50% 70%, rgba(244,169,64,0.18), transparent 70%)",
    safeTempTarget: 40,
  },
  sopa: {
    name: "Sopa",
    emoji: "🍜",
    T0: 98,
    k: 0.045,
    color: "#e07b39",
    colorGlow: "rgba(224,123,57,0.25)",
    svgId: "anim-sopa",
    stageGradient: "radial-gradient(circle at 50% 70%, rgba(224,123,57,0.18), transparent 70%)",
    safeTempTarget: 40,
  },
  cafe: {
    name: "Café",
    emoji: "☕",
    T0: 92,
    k: 0.052,
    color: "#8b5e3c",
    colorGlow: "rgba(139,94,60,0.25)",
    svgId: "anim-cafe",
    stageGradient: "radial-gradient(circle at 50% 70%, rgba(139,94,60,0.18), transparent 70%)",
    safeTempTarget: 40,
  }
};

// ─────────────────────────────────────────────
// 2. ESTADO GLOBAL
// ─────────────────────────────────────────────
let state = {
  selectedFood: "pizza",
  ambientTemp: 22,
  simTime: 120,
  kMultiplier: 1.0,
  isCompareMode: false,
  animationId: null,
  animationFrame: 0,
  simData: null,
  coolingChart: null,
  rateChart: null,
  comparisonChart: null,
};

// ─────────────────────────────────────────────
// 3. MODELOS MATEMÁTICOS
// ─────────────────────────────────────────────

/**
 * Solución analítica de la Ley de Newton:
 * T(t) = T_amb + (T0 - T_amb) * e^(-k*t)
 */
function analyticalSolution(t, T0, Tamb, k) {
  return Tamb + (T0 - Tamb) * Math.exp(-k * t);
}

/**
 * Derivada f(t, T) = -k*(T - Tamb)
 */
function dTdt(T, Tamb, k) {
  return -k * (T - Tamb);
}

/**
 * Método Runge-Kutta 4 para una EDO
 * Devuelve array de {t, T, dT}
 */
function rungeKutta4(T0, Tamb, k, tMax, h = 0.5) {
  const results = [];
  let t = 0;
  let T = T0;

  while (t <= tMax + h * 0.5) {
    const dT = dTdt(T, Tamb, k);
    results.push({ t: parseFloat(t.toFixed(4)), T: parseFloat(T.toFixed(6)), dT: parseFloat(dT.toFixed(6)) });

    const k1 = h * dTdt(T, Tamb, k);
    const k2 = h * dTdt(T + k1 / 2, Tamb, k);
    const k3 = h * dTdt(T + k2 / 2, Tamb, k);
    const k4 = h * dTdt(T + k3, Tamb, k);
    T = T + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    t = t + h;
  }
  return results;
}

/**
 * Calcula los tiempos críticos (analíticamente)
 */
function criticalTime(T0, Tamb, k, Tstar) {
  if (T0 <= Tamb || Tstar <= Tamb || Tstar >= T0) return null;
  return (1 / k) * Math.log((T0 - Tamb) / (Tstar - Tamb));
}

// ─────────────────────────────────────────────
// 4. SELECCIÓN DE ALIMENTO
// ─────────────────────────────────────────────
function selectFood(foodId) {
  if (state.selectedFood === foodId && !state.isCompareMode) return;
  state.selectedFood = foodId;

  // Actualizar tarjetas
  document.querySelectorAll(".food-card").forEach(c => {
    c.classList.remove("selected");
    c.setAttribute("aria-checked", "false");
  });
  const card = document.getElementById(`card-${foodId}`);
  card.classList.add("selected");
  card.setAttribute("aria-checked", "true");

  // Actualizar stage
  updateFoodStage();

  // Auto-simular si ya hay datos
  if (state.simData) runSimulation();
}

function updateFoodStage() {
  const food = FOODS[state.selectedFood];
  const svgSource = document.getElementById(food.svgId).querySelector("svg");
  const display = document.getElementById("foodDisplay");
  const stageBg = document.getElementById("stageBg");

  if (svgSource) {
    display.innerHTML = svgSource.outerHTML;
    // Agrandar un poco el SVG en el stage
    display.querySelector("svg").style.cssText = `width:180px;height:180px;filter:drop-shadow(0 8px 24px ${food.colorGlow})`;
  }

  stageBg.style.background = food.stageGradient;
  document.getElementById("tempBadge").style.background =
    `linear-gradient(135deg, ${food.color}, ${shiftColor(food.color, 30)})`;
  document.getElementById("currentTempDisplay").textContent = food.T0;
}

function shiftColor(hex, amount) {
  // Aclara un color hexadecimal
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

// ─────────────────────────────────────────────
// 5. CONTROLES DE SLIDER
// ─────────────────────────────────────────────
function updateSliderLabel(sliderId, labelId, suffix) {
  const val = document.getElementById(sliderId).value;
  document.getElementById(labelId).textContent = val + suffix;
  state[sliderId === "ambientTemp" ? "ambientTemp" :
        sliderId === "simTime"     ? "simTime"     : "kMultiplier"] = parseFloat(val);
}

// ─────────────────────────────────────────────
// 6. EJECUTAR SIMULACIÓN
// ─────────────────────────────────────────────
function runSimulation() {
  const food = FOODS[state.selectedFood];
  const Tamb = state.ambientTemp;
  const tMax = state.simTime;
  const k    = food.k * state.kMultiplier;
  const T0   = food.T0;

  // Calcular con RK4
  const data = rungeKutta4(T0, Tamb, k, tMax, 0.5);
  state.simData = data;

  // Renderizar gráficas
  renderCoolingChart(data, food, Tamb);
  renderRateChart(data, food);

  // Animar el alimento
  animateFood(data, tMax);

  // Actualizar temperaturas críticas en la sección math
  updateCriticalTemps(T0, Tamb, k);

  // Actualizar la gráfica de comparación (sección math)
  renderComparisonChart(T0, Tamb, k, tMax);
}

// ─────────────────────────────────────────────
// 7. GRÁFICA PRINCIPAL: CURVA DE ENFRIAMIENTO
// ─────────────────────────────────────────────
function renderCoolingChart(data, food, Tamb) {
  const ctx = document.getElementById("coolingChart").getContext("2d");

  const labels = data.map(d => d.t.toFixed(1));
  const temps  = data.map(d => d.T.toFixed(2));

  if (state.coolingChart) state.coolingChart.destroy();

  // Crear gradiente
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0,   food.color + "cc");
  grad.addColorStop(0.5, food.color + "44");
  grad.addColorStop(1,   food.color + "00");

  state.coolingChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: food.name,
          data: temps,
          borderColor: food.color,
          backgroundColor: grad,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
        {
          label: `T amb (${Tamb}°C)`,
          data: data.map(() => Tamb),
          borderColor: "#42a5f5",
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
        }
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200, easing: "easeInOutQuart" },
      plugins: {
        legend: {
          labels: { color: "#a89a8a", font: { family: "Outfit", size: 12 } }
        },
        tooltip: {
          backgroundColor: "#1a1714",
          borderColor: food.color,
          borderWidth: 1,
          titleColor: "#f5ede4",
          bodyColor: "#a89a8a",
          callbacks: {
            label: ctx => `  ${ctx.parsed.y.toFixed(1)}°C`,
            title: ctxArr => `  t = ${parseFloat(ctxArr[0].label).toFixed(1)} min`
          }
        },
        // Anotaciones de zonas de peligro
        annotation: undefined,
      },
      scales: {
        x: {
          title: { display: true, text: "Tiempo (min)", color: "#6b5e52", font: { family: "Outfit", size: 11 } },
          ticks: {
            color: "#6b5e52",
            maxTicksLimit: 10,
            callback: (v, i, ticks) => {
              const val = parseFloat(labels[i]);
              return Number.isInteger(val) ? val : "";
            }
          },
          grid: { color: "rgba(255,255,255,0.04)" },
        },
        y: {
          title: { display: true, text: "Temperatura (°C)", color: "#6b5e52", font: { family: "Outfit", size: 11 } },
          ticks: { color: "#6b5e52", font: { family: "JetBrains Mono", size: 10 } },
          grid: { color: "rgba(255,255,255,0.04)" },
          min: Math.max(0, Tamb - 5),
          max: food.T0 + 5,
        }
      },
      interaction: { mode: "index", intersect: false },
    },
    plugins: [dangerZonePlugin(Tamb, food.T0)],
  });

  // Leyenda manual
  const legendEl = document.getElementById("chartLegend");
  legendEl.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:${food.color}"></span>${food.name}</span>
    <span class="legend-item"><span class="legend-dot" style="background:#42a5f5"></span>T ambiente</span>
  `;
}

// Plugin para dibujar zonas de temperatura peligrosa
function dangerZonePlugin(Tamb, T0) {
  return {
    id: "dangerZone",
    afterDraw(chart) {
      const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
      if (!y) return;

      const zones = [
        { min: 60, max: T0 + 5, color: "rgba(255,87,34,0.07)" },
        { min: 40, max: 60,     color: "rgba(244,169,64,0.07)" },
        { min: Tamb, max: 40,   color: "rgba(76,175,80,0.06)" },
      ];

      zones.forEach(z => {
        const yTop    = y.getPixelForValue(Math.min(z.max, T0 + 5));
        const yBottom = y.getPixelForValue(Math.max(z.min, Tamb - 5));
        if (yTop > bottom || yBottom < top) return;
        ctx.save();
        ctx.fillStyle = z.color;
        ctx.fillRect(left, Math.max(top, yTop), right - left, Math.min(bottom, yBottom) - Math.max(top, yTop));
        ctx.restore();
      });
    }
  };
}

// ─────────────────────────────────────────────
// 8. GRÁFICA DE TASA dT/dt
// ─────────────────────────────────────────────
function renderRateChart(data, food) {
  const ctx = document.getElementById("rateChart").getContext("2d");

  const labels = data.map(d => d.t.toFixed(1));
  const rates  = data.map(d => d.dT.toFixed(4));

  if (state.rateChart) state.rateChart.destroy();

  state.rateChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "dT/dt (°C/min)",
        data: rates,
        borderColor: "#26c6da",
        backgroundColor: "rgba(38,198,218,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      plugins: {
        legend: { labels: { color: "#a89a8a", font: { family: "Outfit", size: 11 } } },
        tooltip: {
          backgroundColor: "#1a1714",
          borderColor: "#26c6da",
          borderWidth: 1,
          titleColor: "#f5ede4",
          bodyColor: "#a89a8a",
          callbacks: {
            label: ctx => `  dT/dt = ${parseFloat(ctx.parsed.y).toFixed(3)} °C/min`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#6b5e52", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,0.03)" },
        },
        y: {
          ticks: { color: "#6b5e52", font: { family: "JetBrains Mono", size: 10 } },
          grid: { color: "rgba(255,255,255,0.03)" },
          title: { display: true, text: "dT/dt (°C/min)", color: "#6b5e52", font: { size: 10 } },
        }
      }
    }
  });
}

// ─────────────────────────────────────────────
// 9. GRÁFICA COMPARACIÓN (sección math)
// ─────────────────────────────────────────────
function renderComparisonChart(T0, Tamb, k, tMax) {
  const ctx = document.getElementById("comparisonChart");
  if (!ctx) return;
  const context = ctx.getContext("2d");

  const h = 0.5;
  const rk4data = rungeKutta4(T0, Tamb, k, tMax, h);
  const labels  = rk4data.map(d => d.t.toFixed(1));
  const rk4vals = rk4data.map(d => d.T.toFixed(6));
  const anavals = rk4data.map(d => analyticalSolution(d.t, T0, Tamb, k).toFixed(6));
  const errors  = rk4data.map(d => Math.abs(d.T - analyticalSolution(d.t, T0, Tamb, k)).toExponential(2));

  if (state.comparisonChart) state.comparisonChart.destroy();

  state.comparisonChart = new Chart(context, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Analítica",
          data: anavals,
          borderColor: "#f4a940",
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
        {
          label: "Runge-Kutta 4",
          data: rk4vals,
          borderColor: "#42a5f5",
          borderDash: [5, 3],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: { labels: { color: "#a89a8a", font: { family: "Outfit", size: 11 } } },
        tooltip: {
          backgroundColor: "#1a1714",
          borderColor: "#f4a940",
          borderWidth: 1,
          titleColor: "#f5ede4",
          bodyColor: "#a89a8a",
        }
      },
      scales: {
        x: { ticks: { color: "#6b5e52", maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,0.03)" } },
        y: { ticks: { color: "#6b5e52", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "rgba(255,255,255,0.03)" } }
      }
    }
  });
}

// ─────────────────────────────────────────────
// 10. ANIMACIÓN DEL ALIMENTO EN EL STAGE
// ─────────────────────────────────────────────
function animateFood(data, tMax) {
  if (state.animationId) cancelAnimationFrame(state.animationId);
  const food = FOODS[state.selectedFood];

  const totalFrames = 200;
  let frame = 0;

  function step() {
    const progress = frame / totalFrames;
    const dataIdx  = Math.min(Math.floor(progress * (data.length - 1)), data.length - 1);
    const point    = data[dataIdx];

    // Temperatura actual
    const T = point.T;
    const t = point.t;

    // 1. Actualizar display de temperatura
    document.getElementById("currentTempDisplay").textContent = T.toFixed(1);

    // 2. Color del badge según temperatura
    const tempBadge = document.getElementById("tempBadge");
    const tempColor = getTempColor(T);
    tempBadge.style.background = tempColor;
    tempBadge.classList.toggle("hot", T > 60);

    // 3. Vapor (steam): intensidad según temperatura
    const steamIntensity = Math.max(0, (T - 40) / (food.T0 - 40));
    const particles = document.querySelectorAll(".steam-particle");
    particles.forEach(p => {
      p.style.opacity = steamIntensity;
      p.style.animationDuration = `${2.5 - steamIntensity * 1.2}s`;
    });

    // 4. Fondo del stage (caliente → frío)
    const stageBg = document.getElementById("stageBg");
    const hotOpacity = Math.max(0, (T - 22) / (food.T0 - 22));
    stageBg.style.background =
      `radial-gradient(circle at 50% 70%, rgba(255,87,34,${hotOpacity * 0.2}), transparent 70%)`;

    // 5. Timeline
    document.getElementById("timelineFill").style.width = `${progress * 100}%`;
    document.getElementById("timeLabel").textContent = `t = ${t.toFixed(1)} min`;

    // 6. Fase / etiqueta
    const phaseLabel = document.getElementById("phaseLabel");
    if (T > 70) { phaseLabel.textContent = "🔥 Muy Caliente"; phaseLabel.className = "phase-hot"; }
    else if (T > 55) { phaseLabel.textContent = "♨️ Caliente"; phaseLabel.className = "phase-hot"; }
    else if (T > 40) { phaseLabel.textContent = "⚠️ Zona de riesgo"; phaseLabel.className = "phase-warm"; }
    else if (T > 30) { phaseLabel.textContent = "🌡️ Tibio"; phaseLabel.className = "phase-warm"; }
    else { phaseLabel.textContent = "✅ Seguro"; phaseLabel.className = "phase-cool"; }

    // 7. Stats
    document.getElementById("statCurrent").textContent = T.toFixed(1) + "°C";
    document.getElementById("statRate").textContent = point.dT.toFixed(3);
    const safeTime = criticalTime(food.T0, state.ambientTemp, food.k * state.kMultiplier, 40);
    document.getElementById("statSafe").textContent = safeTime ? safeTime.toFixed(1) + " min" : "< T0";

    // 8. Story cards
    updateStoryCards(T, food.T0);

    // 9. Escala del SVG del alimento (se "encoge" un poco al enfriarse)
    const scaleFood = 0.92 + hotOpacity * 0.08;
    const displaySvg = document.querySelector("#foodDisplay svg");
    if (displaySvg) {
      displaySvg.style.transform = `scale(${scaleFood})`;
    }

    frame++;
    if (frame <= totalFrames) {
      state.animationId = requestAnimationFrame(step);
    }
  }

  step();
}

function getTempColor(T) {
  // Interpola colores: rojo (caliente) → amarillo → azul (frío)
  if (T > 70) return "linear-gradient(135deg, #ff3a00, #ff7b00)";
  if (T > 55) return "linear-gradient(135deg, #ff7b00, #f4a940)";
  if (T > 40) return "linear-gradient(135deg, #f4a940, #f5c842)";
  if (T > 30) return "linear-gradient(135deg, #f5c842, #67d8ef)";
  return "linear-gradient(135deg, #42a5f5, #26c6da)";
}

function updateStoryCards(T, T0) {
  const sc1 = document.getElementById("sc1");
  const sc2 = document.getElementById("sc2");
  const sc3 = document.getElementById("sc3");
  const sc4 = document.getElementById("sc4");
  sc1.classList.toggle("active", T > T0 * 0.85);
  sc2.classList.toggle("active", T <= T0 * 0.85 && T > 55);
  sc3.classList.toggle("active", T <= 60 && T > 38);
  sc4.classList.toggle("active", T <= 38);
}

// ─────────────────────────────────────────────
// 11. TEMPERATURAS CRÍTICAS (sección math)
// ─────────────────────────────────────────────
function updateCriticalTemps(T0, Tamb, k) {
  const targets = [
    { label: "🍽️ Servir caliente", temp: 74, color: "#e8341a", bg: "rgba(232,52,26,0.08)" },
    { label: "⚠️ Zona peligrosa", temp: 60, color: "#f4a940", bg: "rgba(244,169,64,0.08)" },
    { label: "🦠 Proliferación max.", temp: 40, color: "#f5c842", bg: "rgba(245,200,66,0.08)" },
    { label: "✅ Temperatura segura", temp: 30, color: "#4caf50", bg: "rgba(76,175,80,0.08)" },
  ];

  const container = document.getElementById("criticalTemps");
  container.innerHTML = targets.map(tgt => {
    const t = criticalTime(T0, Tamb, k, tgt.temp);
    const timeStr = t ? `${t.toFixed(1)} min` : "—";
    return `
      <div class="crit-row" style="background:${tgt.bg};border:1px solid ${tgt.color}22;">
        <span class="crit-label" style="color:${tgt.color}">${tgt.label} (${tgt.temp}°C)</span>
        <span class="crit-time">${timeStr}</span>
      </div>`;
  }).join("");
}

// ─────────────────────────────────────────────
// 12. COMPARAR TODOS LOS ALIMENTOS
// ─────────────────────────────────────────────
function toggleCompare() {
  state.isCompareMode = !state.isCompareMode;
  const btn = document.getElementById("btnCompare");

  if (state.isCompareMode) {
    btn.innerHTML = '<span class="btn-icon">✕</span> Ocultar comparación';
    renderCompareAllFoods();
  } else {
    btn.innerHTML = '<span class="btn-icon">⚖️</span> Comparar Alimentos';
    if (state.simData) runSimulation(); // Volver a single-food
  }
}

function renderCompareAllFoods() {
  const ctx = document.getElementById("coolingChart").getContext("2d");
  const Tamb = state.ambientTemp;
  const tMax = state.simTime;

  const datasets = Object.entries(FOODS).map(([id, food]) => {
    const k    = food.k * state.kMultiplier;
    const data = rungeKutta4(food.T0, Tamb, k, tMax, 0.5);
    return {
      label: `${food.emoji} ${food.name}`,
      data: data.map(d => ({ x: d.t, y: parseFloat(d.T.toFixed(2)) })),
      borderColor: food.color,
      backgroundColor: food.color + "18",
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2.5,
    };
  });

  // Línea ambiente
  datasets.push({
    label: `T ambiente (${Tamb}°C)`,
    data: rungeKutta4(100, Tamb, 0.035, tMax, 0.5).map(d => ({ x: d.t, y: Tamb })),
    borderColor: "#42a5f5",
    borderDash: [6, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
  });

  if (state.coolingChart) state.coolingChart.destroy();

  state.coolingChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      plugins: {
        legend: { labels: { color: "#a89a8a", font: { family: "Outfit", size: 12 } } },
        tooltip: {
          backgroundColor: "#1a1714", borderColor: "#2e2a26", borderWidth: 1,
          titleColor: "#f5ede4", bodyColor: "#a89a8a",
          callbacks: {
            label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}°C`,
            title: ctxArr => `  t = ${parseFloat(ctxArr[0].parsed.x).toFixed(1)} min`
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Tiempo (min)", color: "#6b5e52" },
          ticks: { color: "#6b5e52" },
          grid: { color: "rgba(255,255,255,0.04)" },
        },
        y: {
          title: { display: true, text: "Temperatura (°C)", color: "#6b5e52" },
          ticks: { color: "#6b5e52", font: { family: "JetBrains Mono", size: 10 } },
          grid: { color: "rgba(255,255,255,0.04)" },
        }
      },
      interaction: { mode: "index", intersect: false },
    },
    plugins: [dangerZonePlugin(Tamb, 105)]
  });

  document.getElementById("chartLegend").innerHTML = Object.entries(FOODS).map(([id, f]) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${f.color}"></span>${f.emoji} ${f.name}</span>`
  ).join("");
}

// ─────────────────────────────────────────────
// 13. REINICIAR
// ─────────────────────────────────────────────
function resetSimulation() {
  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.simData = null;
  state.isCompareMode = false;

  // Restaurar controles a default
  document.getElementById("ambientTemp").value  = 22;
  document.getElementById("simTime").value      = 120;
  document.getElementById("kMultiplier").value  = 1.0;
  document.getElementById("ambientTempVal").textContent = "22°C";
  document.getElementById("simTimeVal").textContent     = "120 min";
  document.getElementById("kMultVal").textContent       = "1.0×";
  state.ambientTemp  = 22;
  state.simTime      = 120;
  state.kMultiplier  = 1.0;

  // Limpiar charts
  if (state.coolingChart) { state.coolingChart.destroy(); state.coolingChart = null; }
  if (state.rateChart)    { state.rateChart.destroy();    state.rateChart = null; }

  // Restaurar badge
  updateFoodStage();
  document.getElementById("timelineFill").style.width = "0%";
  document.getElementById("timeLabel").textContent = "t = 0 min";
  document.getElementById("phaseLabel").textContent = "🔥 Muy Caliente";
  document.getElementById("phaseLabel").className  = "phase-hot";
  document.getElementById("statCurrent").textContent = "--";
  document.getElementById("statRate").textContent    = "--";
  document.getElementById("statSafe").textContent    = "--";

  // Steam al máximo
  document.querySelectorAll(".steam-particle").forEach(p => { p.style.opacity = 1; });

  // Botón comparar
  document.getElementById("btnCompare").innerHTML = '<span class="btn-icon">⚖️</span> Comparar Alimentos';

  // Story cards
  document.querySelectorAll(".story-card").forEach(c => c.classList.remove("active"));
  document.getElementById("sc1").classList.add("active");
}

// ─────────────────────────────────────────────
// 14. NAVEGACIÓN DE PESTAÑAS
// ─────────────────────────────────────────────
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });

  document.getElementById(sectionId).classList.add("active");
  const tabEl = document.getElementById(`tab-${sectionId === "simulator" ? "sim" : sectionId === "math" ? "math" : "story"}`);
  tabEl.classList.add("active");
  tabEl.setAttribute("aria-selected", "true");

  // Si va a sección math, render comparison chart con parámetros actuales
  if (sectionId === "math") {
    const food = FOODS[state.selectedFood];
    const k    = food.k * state.kMultiplier;
    setTimeout(() => {
      updateCriticalTemps(food.T0, state.ambientTemp, k);
      renderComparisonChart(food.T0, state.ambientTemp, k, state.simTime);
    }, 100);
  }
}

// ─────────────────────────────────────────────
// 15. PARTÍCULAS DE FONDO (emojis de comida)
// ─────────────────────────────────────────────
function createParticles() {
  const container = document.getElementById("particles");
  const emojis = ["🌡️", "🔥", "❄️", "💨", "♨️", "⚡"];
  const colors  = ["#ff5722", "#f4a940", "#42a5f5", "#26c6da", "#ff8c42"];

  for (let i = 0; i < 18; i++) {
    const el = document.createElement("div");
    el.className = "particle";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${14 + Math.random() * 14}px;
      height: ${14 + Math.random() * 14}px;
      font-size: ${10 + Math.random() * 12}px;
      animation-duration: ${8 + Math.random() * 15}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: 0;
    `;
    container.appendChild(el);
  }
}

// ─────────────────────────────────────────────
// 16. INIT
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  createParticles();
  updateFoodStage();

  // Story card 1 activa por defecto
  document.getElementById("sc1").classList.add("active");

  // Render inicial del stage
  const food = FOODS[state.selectedFood];
  document.getElementById("currentTempDisplay").textContent = food.T0;

  // Simular automáticamente al cargar
  setTimeout(() => runSimulation(), 500);

  // Renderizar math section de fondo
  setTimeout(() => {
    updateCriticalTemps(food.T0, state.ambientTemp, food.k);
    renderComparisonChart(food.T0, state.ambientTemp, food.k, state.simTime);
  }, 300);
});
