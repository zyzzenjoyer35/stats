const PALETTE = [
  "#f9e56a",
  "#4ade80",
  "#38bdf8",
  "#fb923c",
  "#c084fc",
  "#f472b6",
  "#34d399",
  "#60a5fa",
  "#facc15",
  "#a78bfa",
];

let allData = [];
let activeModels = new Set();
let chartInstances = {};

function shortName(n) {
  return n
    .replace("openrouter/", "")
    .replace("google/", "")
    .split("-preview")[0]
    .split("/")
    .pop()
    .replace(/-\d{8}$/, "");
}

function loadFiles(files) {
  const readers = Array.from(files).map(
    (f) =>
      new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = (e) => {
          try {
            res({
              filename: f.name,
              model: f.name.replace(".json", ""),
              data: JSON.parse(e.target.result),
            });
          } catch (err) {
            rej(err);
          }
        };
        r.readAsText(f);
      }),
  );
  Promise.all(readers)
    .then((results) => {
      results.forEach((r) => {
        if (!allData.find((x) => x.model === r.model)) {
          allData.push(r);
          activeModels.add(r.model);
        }
      });
      renderDashboard();
    })
    .catch((e) => alert("Błąd: " + e.message));
}

document
  .getElementById("fileInput")
  .addEventListener("change", (e) => loadFiles(e.target.files));
const dz = document.getElementById("dropZone");
dz.addEventListener("dragover", (e) => {
  e.preventDefault();
  dz.classList.add("drag-over");
});
dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
dz.addEventListener("drop", (e) => {
  e.preventDefault();
  dz.classList.remove("drag-over");
  loadFiles(e.dataTransfer.files);
});

function getStats(entry) {
  const d = entry.data;
  const total = d.length;
  const correct = d.filter((q) => q.guessed).length;
  const totalCost = d.reduce(
    (s, q) => s + q.attempts.reduce((a, at) => a + (at.usage?.cost || 0), 0),
    0,
  );
  const totalTokens = d.reduce(
    (s, q) =>
      s + q.attempts.reduce((a, at) => a + (at.usage?.total_tokens || 0), 0),
    0,
  );
  const avgHints = d.reduce((s, q) => s + (q.required_hints || 0), 0) / total;
  const times = d
    .flatMap((q) => q.attempts.map((at) => at.elapsed_ms || 0))
    .filter((t) => t > 0);
  const avgTime = times.length
    ? times.reduce((a, b) => a + b, 0) / times.length
    : 0;
  const totalAttempts = d.reduce((s, q) => s + q.attempts.length, 0);
  return {
    total,
    correct,
    accuracy: (correct / total) * 100,
    totalCost,
    totalTokens,
    avgHints,
    avgTime,
    totalAttempts,
  };
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}
function mkChart(id, cfg) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  chartInstances[id] = new Chart(el, cfg);
}

function renderDashboard() {
  document.getElementById("no-files-hint").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  const active = allData.filter((e) => activeModels.has(e.model));
  const stats = active.map((e) => ({ ...e, stats: getStats(e) }));
  renderModelTags();
  renderSummaryCards(stats);
  renderCharts(stats);
  renderPlot3D(stats);
  renderPlot5D(stats);
  renderRanking(stats);
  renderAttempts(active);
}

function renderModelTags() {
  const c = document.getElementById("modelTags");
  c.innerHTML = "";
  allData.forEach((e, i) => {
    const tag = document.createElement("span");
    tag.className = "model-tag" + (activeModels.has(e.model) ? " active" : "");
    tag.textContent = shortName(e.model);
    tag.style.cursor = "pointer";
    tag.style.borderColor = activeModels.has(e.model)
      ? PALETTE[i % PALETTE.length]
      : "";
    tag.style.color = activeModels.has(e.model)
      ? PALETTE[i % PALETTE.length]
      : "";
    tag.onclick = () => {
      if (activeModels.has(e.model)) activeModels.delete(e.model);
      else activeModels.add(e.model);
      renderDashboard();
    };
    c.appendChild(tag);
  });
}

function renderSummaryCards(stats) {
  if (!stats.length) return;
  const totalQ = stats[0]?.stats.total || 0;
  const avgAcc = stats.reduce((s, e) => s + e.stats.accuracy, 0) / stats.length;
  const totalCost = stats.reduce((s, e) => s + e.stats.totalCost, 0);
  const avgTime = stats.reduce((s, e) => s + e.stats.avgTime, 0) / stats.length;
  document.getElementById("summaryCards").innerHTML = `
    <div class="metric-card c1"><div class="label">Modeli</div><div class="value">${stats.length}<span class="unit">załadowanych</span></div></div>
    <div class="metric-card c2"><div class="label">Pytań / model</div><div class="value">${totalQ}</div></div>
    <div class="metric-card c3"><div class="label">Średnia accuracy</div><div class="value">${avgAcc.toFixed(1)}<span class="unit">%</span></div></div>
    <div class="metric-card c4"><div class="label">Łączny koszt</div><div class="value">$${totalCost.toFixed(4)}</div></div>
  `;
}

function baseOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1a1a1e",
        titleColor: "#f9e56a",
        bodyColor: "#d4d0c8",
        borderColor: "#2e2e34",
        borderWidth: 1,
        padding: 10,
        titleFont: { size: 13, weight: 700 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: "#9b9ba0", font: { size: 12 } },
        grid: { color: "#161618" },
        border: { color: "#2e2e34" },
      },
      y: {
        ticks: { color: "#9b9ba0", font: { size: 12 } },
        grid: { color: "#161618" },
        border: { color: "#2e2e34" },
      },
    },
  };
}

function renderCharts(stats) {
  const labels = stats.map((e) => shortName(e.model));
  const colors = stats.map((_, i) => PALETTE[i % PALETTE.length]);

  mkChart("chartAccuracy", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: stats.map((e) => +e.stats.accuracy.toFixed(1)),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...baseOpts(),
      scales: {
        x: baseOpts().scales.x,
        y: {
          ...baseOpts().scales.y,
          min: 0,
          max: 100,
          ticks: { ...baseOpts().scales.y.ticks, callback: (v) => v + "%" },
        },
      },
    },
  });

  mkChart("chartHints", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: stats.map((e) => +e.stats.avgHints.toFixed(2)),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: baseOpts(),
  });

  mkChart("chartCost", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: stats.map((e) => +e.stats.totalCost.toFixed(5)),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...baseOpts(),
      scales: {
        x: baseOpts().scales.x,
        y: {
          ...baseOpts().scales.y,
          ticks: {
            ...baseOpts().scales.y.ticks,
            callback: (v) => "$" + v.toFixed(4),
          },
        },
      },
    },
  });

  mkChart("chartTime", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: stats.map((e) => Math.round(e.stats.avgTime)),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...baseOpts(),
      scales: {
        x: baseOpts().scales.x,
        y: {
          ...baseOpts().scales.y,
          ticks: { ...baseOpts().scales.y.ticks, callback: (v) => v + " ms" },
        },
      },
    },
  });

  const hintColors = ["#4ade80", "#fbbf24", "#f87171", "#3a3a3e"];
  const hintLabels = [
    "0 podpowiedzi",
    "1 podpowiedź",
    "2+ podpowiedzi",
    "nieudane",
  ];
  const hintData = stats.map((e) => {
    const d = e.data;
    return {
      h0: d.filter((q) => q.guessed && (q.required_hints || 0) === 0).length,
      h1: d.filter((q) => q.guessed && (q.required_hints || 0) === 1).length,
      h2: d.filter((q) => q.guessed && (q.required_hints || 0) >= 2).length,
      fail: d.filter((q) => !q.guessed).length,
    };
  });
  document.getElementById("legendHintDist").innerHTML = hintLabels
    .map(
      (l, i) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${hintColors[i]}"></span>${l}</span>`,
    )
    .join("");
  mkChart("chartHintDist", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "0 podpowiedzi",
          data: hintData.map((h) => h.h0),
          backgroundColor: "#4ade80",
          borderRadius: 0,
        },
        {
          label: "1 podpowiedź",
          data: hintData.map((h) => h.h1),
          backgroundColor: "#fbbf24",
          borderRadius: 0,
        },
        {
          label: "2+ podpowiedzi",
          data: hintData.map((h) => h.h2),
          backgroundColor: "#f87171",
          borderRadius: 0,
        },
        {
          label: "nieudane",
          data: hintData.map((h) => h.fail),
          backgroundColor: "#3a3a3e",
          borderRadius: 0,
        },
      ],
    },
    options: {
      ...baseOpts(),
      scales: {
        x: { ...baseOpts().scales.x, stacked: true },
        y: { ...baseOpts().scales.y, stacked: true },
      },
    },
  });

  mkChart("chartCostPerCorrect", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: stats.map((e) =>
            e.stats.correct > 0
              ? +(e.stats.totalCost / e.stats.correct).toFixed(5)
              : 0,
          ),
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...baseOpts(),
      scales: {
        x: baseOpts().scales.x,
        y: {
          ...baseOpts().scales.y,
          ticks: {
            ...baseOpts().scales.y.ticks,
            callback: (v) => "$" + v.toFixed(5),
          },
        },
      },
    },
  });

  const allQ = stats.flatMap((e) => e.data);
  const byLen = {};
  allQ.forEach((q) => {
    const l = q.correct_answer.length;
    if (!byLen[l]) byLen[l] = { total: 0, ok: 0 };
    byLen[l].total++;
    if (q.guessed) byLen[l].ok++;
  });
  const lenKeys = Object.keys(byLen)
    .map(Number)
    .sort((a, b) => a - b);
  mkChart("chartWordLen", {
    type: "bar",
    data: {
      labels: lenKeys.map((l) => l + " liter"),
      datasets: [
        {
          data: lenKeys.map(
            (l) => +((byLen[l].ok / byLen[l].total) * 100).toFixed(1),
          ),
          backgroundColor: lenKeys.map((l) => {
            const r = byLen[l].ok / byLen[l].total;
            return r > 0.8 ? "#4ade80" : r > 0.5 ? "#fbbf24" : "#f87171";
          }),
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...baseOpts(),
      scales: {
        x: {
          ...baseOpts().scales.x,
          ticks: { ...baseOpts().scales.x.ticks, autoSkip: false },
        },
        y: {
          ...baseOpts().scales.y,
          min: 0,
          max: 100,
          ticks: { ...baseOpts().scales.y.ticks, callback: (v) => v + "%" },
        },
      },
    },
  });
}

function renderPlot3D(stats) {
  const legendEl = document.getElementById("legendBubble");
  legendEl.innerHTML = stats
    .map(
      (e, i) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${PALETTE[i % PALETTE.length]};border-radius:50%"></span>${shortName(e.model)}</span>`,
    )
    .join("");

  const traces = stats.map((e, i) => {
    const s = e.stats;
    return {
      type: "scatter3d",
      mode: "markers+text",
      name: shortName(e.model),
      x: [+s.totalCost.toFixed(5)],
      y: [+s.accuracy.toFixed(1)],
      z: [Math.round(s.avgTime)],
      text: [shortName(e.model)],
      textposition: "top center",
      textfont: {
        color: PALETTE[i % PALETTE.length],
        size: 12,
        family: "Segoe UI",
      },
      marker: {
        size: Math.max(8, Math.sqrt(s.total) * 4),
        color: PALETTE[i % PALETTE.length],
        opacity: 0.85,
        line: { color: "#09090b", width: 1.5 },
      },
      hovertemplate: `<b>${shortName(e.model)}</b><br>Accuracy: %{y:.1f}%<br>Koszt: $%{x:.5f}<br>Czas: %{z} ms<extra></extra>`,
    };
  });

  const layout3d = {
    paper_bgcolor: "#111115",
    plot_bgcolor: "#111115",
    font: { color: "#9b9ba0", family: "Segoe UI, system-ui", size: 11 },
    margin: { l: 0, r: 0, t: 10, b: 0 },
    scene: {
      bgcolor: "#0d0d10",
      xaxis: {
        title: { text: "Koszt USD", font: { color: "#f9e56a", size: 11 } },
        color: "#555",
        gridcolor: "#1e1e24",
        zerolinecolor: "#2e2e34",
      },
      yaxis: {
        title: { text: "Accuracy %", font: { color: "#4ade80", size: 11 } },
        color: "#555",
        gridcolor: "#1e1e24",
        zerolinecolor: "#2e2e34",
        range: [0, 105],
      },
      zaxis: {
        title: { text: "Czas ms", font: { color: "#38bdf8", size: 11 } },
        color: "#555",
        gridcolor: "#1e1e24",
        zerolinecolor: "#2e2e34",
      },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
    },
    legend: {
      x: 0.02,
      y: 0.98,
      bgcolor: "#0d0d10",
      bordercolor: "#2e2e34",
      borderwidth: 1,
      font: { color: "#d4d0c8", size: 11 },
    },
    showlegend: true,
  };

  Plotly.newPlot("plot3d", traces, layout3d, {
    responsive: true,
    displayModeBar: false,
  });
}

function renderPlot5D(stats) {
  if (!stats.length) return;
  const colorScale = stats.map((_, i) => i / Math.max(stats.length - 1, 1));

  const dims = [
    {
      label: "Accuracy (%)",
      values: stats.map((e) => +e.stats.accuracy.toFixed(1)),
      range: [0, 100],
    },
    {
      label: "Koszt total ($)",
      values: stats.map((e) => +e.stats.totalCost.toFixed(5)),
    },
    {
      label: "Czas avg (ms)",
      values: stats.map((e) => Math.round(e.stats.avgTime)),
    },
    {
      label: "Avg podpowiedzi",
      values: stats.map((e) => +e.stats.avgHints.toFixed(2)),
      range: [0, null],
    },
    {
      label: "Koszt / poprawna ($)",
      values: stats.map((e) =>
        e.stats.correct > 0
          ? +(e.stats.totalCost / e.stats.correct).toFixed(5)
          : 0,
      ),
    },
  ];

  const trace5d = {
    type: "parcoords",
    line: {
      color: stats.map((_, i) => i),
      colorscale: stats.map((e, i) => [
        i / Math.max(stats.length - 1, 1),
        PALETTE[i % PALETTE.length],
      ]),
      showscale: false,
      width: 3,
    },
    dimensions: dims.map((d) => ({
      label: d.label,
      values: d.values,
      ...(d.range ? { range: d.range } : {}),
    })),
  };

  const layout5d = {
    paper_bgcolor: "#111115",
    plot_bgcolor: "#111115",
    font: { color: "#9b9ba0", family: "Segoe UI, system-ui", size: 12 },
    margin: { l: 80, r: 80, t: 40, b: 20 },
  };

  Plotly.newPlot("plot5d", [trace5d], layout5d, {
    responsive: true,
    displayModeBar: false,
  });
}

function renderRanking(stats) {
  const sorted = [...stats].sort(
    (a, b) =>
      b.stats.accuracy - a.stats.accuracy ||
      a.stats.totalCost - b.stats.totalCost,
  );
  const maxAcc = Math.max(...sorted.map((s) => s.stats.accuracy));
  document.getElementById("rankingTable").innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Model</th><th>Accuracy</th><th>Poprawne / Łącznie</th><th>Śr. podpowiedzi</th><th>Śr. czas</th><th>Łączny koszt</th><th>Koszt / poprawna</th></tr></thead>
      <tbody>${sorted
        .map((e, i) => {
          const s = e.stats;
          const cpc =
            s.correct > 0 ? "$" + (s.totalCost / s.correct).toFixed(5) : "—";
          return `<tr>
          <td style="color:#555;font-weight:700">${i + 1}</td>
          <td class="model-name">${shortName(e.model)}</td>
          <td class="${s.accuracy === maxAcc ? "good" : s.accuracy >= 70 ? "mid" : "bad"}">
            ${s.accuracy.toFixed(1)}%
            <div class="bar-mini"><div class="bar-mini-fill" style="width:${s.accuracy}%"></div></div>
          </td>
          <td style="color:#d4d0c8">${s.correct} / ${s.total}</td>
          <td class="${s.avgHints < 0.5 ? "good" : s.avgHints < 1 ? "mid" : "bad"}">${s.avgHints.toFixed(2)}</td>
          <td style="color:#38bdf8">${Math.round(s.avgTime)} ms</td>
          <td style="color:#fb923c">$${s.totalCost.toFixed(5)}</td>
          <td style="color:#c084fc">${cpc}</td>
        </tr>`;
        })
        .join("")}</tbody>
    </table>`;
}

function renderAttempts(active) {
  const bar = document.getElementById("filterBar");
  bar.innerHTML = "";
  let cur = "all";
  [
    ["all", "Wszystkie"],
    ["ok", "Poprawne"],
    ["fail", "Błędne"],
    ["hints", "Z podpowiedziami"],
  ].forEach(([key, label]) => {
    const b = document.createElement("button");
    b.className = "filter-btn" + (key === "all" ? " active" : "");
    b.textContent = label;
    b.onclick = () => {
      cur = key;
      bar
        .querySelectorAll(".filter-btn")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      drawAttempts(active, cur);
    };
    bar.appendChild(b);
  });
  drawAttempts(active, "all");
}

function drawAttempts(active, filter) {
  const grid = document.getElementById("attemptsGrid");
  let qs = active.flatMap((e) =>
    e.data.map((q) => ({ ...q, modelLabel: shortName(e.model) })),
  );
  if (filter === "ok") qs = qs.filter((q) => q.guessed);
  if (filter === "fail") qs = qs.filter((q) => !q.guessed);
  if (filter === "hints") qs = qs.filter((q) => (q.required_hints || 0) > 0);
  qs = qs.slice(0, 80);
  if (!qs.length) {
    grid.innerHTML = '<div class="no-data">Brak wyników</div>';
    return;
  }
  grid.innerHTML = qs
    .map((q) => {
      const cost = q.attempts.reduce((s, a) => s + (a.usage?.cost || 0), 0);
      return `<div class="attempt-row">
      <span class="q">[${q.modelLabel}] ${q.question}</span>
      <span class="ans">${q.correct_answer}</span>
      <span class="hints">${q.required_hints || 0} hint${(q.required_hints || 0) !== 1 ? "s" : ""}</span>
      <span class="cost">$${cost.toFixed(5)}</span>
      <span class="dot ${q.guessed ? "ok" : "fail"}"></span>
    </div>`;
    })
    .join("");
}

const realData = [
  {
    question: "Podwodny grunt",
    correct_answer: "DNO",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _",
        raw_answer: "DNO",
        cleaned_answer: "DNO",
        correct: true,
        usage: {
          completion_tokens: 125,
          prompt_tokens: 160,
          total_tokens: 285,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 123,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002275,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002275,
            upstream_inference_prompt_cost: 4e-5,
            upstream_inference_completions_cost: 0.0001875,
          },
        },
        elapsed_ms: 1614,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Kropla smutku",
    correct_answer: "ŁZA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _",
        raw_answer: "ŁZA",
        cleaned_answer: "ŁZA",
        correct: true,
        usage: {
          completion_tokens: 132,
          prompt_tokens: 160,
          total_tokens: 292,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 130,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.000238,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.000238,
            upstream_inference_prompt_cost: 4e-5,
            upstream_inference_completions_cost: 0.000198,
          },
        },
        elapsed_ms: 1221,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Góral z dowcipów",
    correct_answer: "BACA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 2,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _",
        raw_answer: "JANEK",
        cleaned_answer: "JANEK",
        correct: false,
        usage: {
          completion_tokens: 115,
          prompt_tokens: 161,
          total_tokens: 276,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 112,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00021275,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00021275,
            upstream_inference_prompt_cost: 4.025e-5,
            upstream_inference_completions_cost: 0.0001725,
          },
        },
        elapsed_ms: 1657,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
      {
        hints: 1,
        mask: "B _ _ _",
        raw_answer: "BACU",
        cleaned_answer: "BACU",
        correct: false,
        usage: {
          completion_tokens: 133,
          prompt_tokens: 185,
          total_tokens: 318,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 131,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00024575,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00024575,
            upstream_inference_prompt_cost: 4.625e-5,
            upstream_inference_completions_cost: 0.0001995,
          },
        },
        elapsed_ms: 2330,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
      {
        hints: 2,
        mask: "B A _ _",
        raw_answer: "BACA",
        cleaned_answer: "BACA",
        correct: true,
        usage: {
          completion_tokens: 138,
          prompt_tokens: 190,
          total_tokens: 328,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 136,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002545,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002545,
            upstream_inference_prompt_cost: 4.75e-5,
            upstream_inference_completions_cost: 0.000207,
          },
        },
        elapsed_ms: 1437,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Blada u chorego",
    correct_answer: "CERA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _",
        raw_answer: "CERA",
        cleaned_answer: "CERA",
        correct: true,
        usage: {
          completion_tokens: 121,
          prompt_tokens: 162,
          total_tokens: 283,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 119,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.000222,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.000222,
            upstream_inference_prompt_cost: 4.05e-5,
            upstream_inference_completions_cost: 0.0001815,
          },
        },
        elapsed_ms: 1368,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Podróż przez morze",
    correct_answer: "REJS",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _",
        raw_answer: "REJS",
        cleaned_answer: "REJS",
        correct: true,
        usage: {
          completion_tokens: 133,
          prompt_tokens: 161,
          total_tokens: 294,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 131,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00023975,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00023975,
            upstream_inference_prompt_cost: 4.025e-5,
            upstream_inference_completions_cost: 0.0001995,
          },
        },
        elapsed_ms: 2163,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Sala sportowa",
    correct_answer: "HALA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _",
        raw_answer: "HALA",
        cleaned_answer: "HALA",
        correct: true,
        usage: {
          completion_tokens: 128,
          prompt_tokens: 158,
          total_tokens: 286,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 126,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002315,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002315,
            upstream_inference_prompt_cost: 3.95e-5,
            upstream_inference_completions_cost: 0.000192,
          },
        },
        elapsed_ms: 1622,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Połowica władcy zwierząt",
    correct_answer: "LWICA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "LWICA",
        cleaned_answer: "LWICA",
        correct: true,
        usage: {
          completion_tokens: 122,
          prompt_tokens: 163,
          total_tokens: 285,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 120,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00022375,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00022375,
            upstream_inference_prompt_cost: 4.075e-5,
            upstream_inference_completions_cost: 0.000183,
          },
        },
        elapsed_ms: 1819,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Fallon, komik z TV",
    correct_answer: "JIMMY",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "JIMMY",
        cleaned_answer: "JIMMY",
        correct: true,
        usage: {
          completion_tokens: 120,
          prompt_tokens: 162,
          total_tokens: 282,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 118,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002205,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002205,
            upstream_inference_prompt_cost: 4.05e-5,
            upstream_inference_completions_cost: 0.00018,
          },
        },
        elapsed_ms: 1772,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Siostra Balladyny",
    correct_answer: "ALINA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "ALINA",
        cleaned_answer: "ALINA",
        correct: true,
        usage: {
          completion_tokens: 133,
          prompt_tokens: 164,
          total_tokens: 297,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 131,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002405,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002405,
            upstream_inference_prompt_cost: 4.1e-5,
            upstream_inference_completions_cost: 0.0001995,
          },
        },
        elapsed_ms: 1683,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Okrągłe skrzyżowanie",
    correct_answer: "RONDO",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "RONDO",
        cleaned_answer: "RONDO",
        correct: true,
        usage: {
          completion_tokens: 119,
          prompt_tokens: 166,
          total_tokens: 285,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 117,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00022,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00022,
            upstream_inference_prompt_cost: 4.15e-5,
            upstream_inference_completions_cost: 0.0001785,
          },
        },
        elapsed_ms: 1402,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Imię Kurosawy, reżysera",
    correct_answer: "AKIRA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "AKIRA",
        cleaned_answer: "AKIRA",
        correct: true,
        usage: {
          completion_tokens: 129,
          prompt_tokens: 167,
          total_tokens: 296,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 127,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00023525,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00023525,
            upstream_inference_prompt_cost: 4.175e-5,
            upstream_inference_completions_cost: 0.0001935,
          },
        },
        elapsed_ms: 2125,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Nabranie powietrza do płuc",
    correct_answer: "WDECH",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "WDECH",
        cleaned_answer: "WDECH",
        correct: true,
        usage: {
          completion_tokens: 120,
          prompt_tokens: 166,
          total_tokens: 286,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 117,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002215,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002215,
            upstream_inference_prompt_cost: 4.15e-5,
            upstream_inference_completions_cost: 0.00018,
          },
        },
        elapsed_ms: 1561,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Listwa stołu bilardowego",
    correct_answer: "BANDA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "BANDA",
        cleaned_answer: "BANDA",
        correct: true,
        usage: {
          completion_tokens: 123,
          prompt_tokens: 163,
          total_tokens: 286,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 121,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00022525,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00022525,
            upstream_inference_prompt_cost: 4.075e-5,
            upstream_inference_completions_cost: 0.0001845,
          },
        },
        elapsed_ms: 1524,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Naczynie na kakao",
    correct_answer: "KUBEK",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _",
        raw_answer: "KUBEK",
        cleaned_answer: "KUBEK",
        correct: true,
        usage: {
          completion_tokens: 143,
          prompt_tokens: 162,
          total_tokens: 305,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 140,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.000255,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.000255,
            upstream_inference_prompt_cost: 4.05e-5,
            upstream_inference_completions_cost: 0.0002145,
          },
        },
        elapsed_ms: 2273,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Kaczor z kreskówek",
    correct_answer: "DONALD",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _ _",
        raw_answer: "DONALD",
        cleaned_answer: "DONALD",
        correct: true,
        usage: {
          completion_tokens: 128,
          prompt_tokens: 165,
          total_tokens: 293,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 126,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00023325,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00023325,
            upstream_inference_prompt_cost: 4.125e-5,
            upstream_inference_completions_cost: 0.000192,
          },
        },
        elapsed_ms: 1887,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Buduje igloo",
    correct_answer: "ESKIMOS",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _ _ _",
        raw_answer: "ESKIMOS",
        cleaned_answer: "ESKIMOS",
        correct: true,
        usage: {
          completion_tokens: 133,
          prompt_tokens: 164,
          total_tokens: 297,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 129,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002405,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002405,
            upstream_inference_prompt_cost: 4.1e-5,
            upstream_inference_completions_cost: 0.0001995,
          },
        },
        elapsed_ms: 1812,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Internetowa sprzedaż",
    correct_answer: "EHANDEL",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 0,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _ _ _",
        raw_answer: "EHANDEL",
        cleaned_answer: "EHANDEL",
        correct: true,
        usage: {
          completion_tokens: 121,
          prompt_tokens: 164,
          total_tokens: 285,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 118,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.0002225,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.0002225,
            upstream_inference_prompt_cost: 4.1e-5,
            upstream_inference_completions_cost: 0.0001815,
          },
        },
        elapsed_ms: 1541,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Naprawa uszkodzenia",
    correct_answer: "REPARACJA",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 2,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _ _ _ _ _",
        raw_answer: "REPERACJA",
        cleaned_answer: "REPERACJA",
        correct: false,
        usage: {
          completion_tokens: 120,
          prompt_tokens: 167,
          total_tokens: 287,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 116,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00022175,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00022175,
            upstream_inference_prompt_cost: 4.175e-5,
            upstream_inference_completions_cost: 0.00018,
          },
        },
        elapsed_ms: 1860,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
      {
        hints: 1,
        mask: "R _ _ _ _ _ _ _ _",
        raw_answer: "REMONTOWA",
        cleaned_answer: "REMONTOWA",
        correct: false,
        usage: {
          completion_tokens: 136,
          prompt_tokens: 192,
          total_tokens: 328,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 132,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.000252,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.000252,
            upstream_inference_prompt_cost: 4.8e-5,
            upstream_inference_completions_cost: 0.000204,
          },
        },
        elapsed_ms: 1993,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
      {
        hints: 2,
        mask: "R E _ _ _ _ _ _ _",
        raw_answer: "REPARACJA",
        cleaned_answer: "REPARACJA",
        correct: true,
        usage: {
          completion_tokens: 125,
          prompt_tokens: 194,
          total_tokens: 319,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 121,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.000236,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.000236,
            upstream_inference_prompt_cost: 4.85e-5,
            upstream_inference_completions_cost: 0.0001875,
          },
        },
        elapsed_ms: 2105,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
  {
    question: "Obcy wtręt językowy",
    correct_answer: "MAKARONIZM",
    model: "openrouter/google/gemini-3.1-flash-lite-preview",
    guessed: true,
    required_hints: 1,
    attempts: [
      {
        hints: 0,
        mask: "_ _ _ _ _ _ _ _ _ _",
        raw_answer: "BARBARYZM",
        cleaned_answer: "BARBARYZM",
        correct: false,
        usage: {
          completion_tokens: 143,
          prompt_tokens: 169,
          total_tokens: 312,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 139,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00025675,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00025675,
            upstream_inference_prompt_cost: 4.225e-5,
            upstream_inference_completions_cost: 0.0002145,
          },
        },
        elapsed_ms: 2789,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
      {
        hints: 1,
        mask: "M _ _ _ _ _ _ _ _ _",
        raw_answer: "MAKARONIZM",
        cleaned_answer: "MAKARONIZM",
        correct: true,
        usage: {
          completion_tokens: 154,
          prompt_tokens: 196,
          total_tokens: 350,
          completion_tokens_details: {
            audio_tokens: 0,
            reasoning_tokens: 150,
            image_tokens: 0,
          },
          prompt_tokens_details: {
            audio_tokens: 0,
            cached_tokens: 0,
            video_tokens: 0,
            cache_write_tokens: 0,
          },
          cost: 0.00028,
          is_byok: false,
          cost_details: {
            upstream_inference_cost: 0.00028,
            upstream_inference_prompt_cost: 4.9e-5,
            upstream_inference_completions_cost: 0.000231,
          },
        },
        elapsed_ms: 1404,
        response_model: "google/gemini-3.1-flash-lite-preview-20260303",
      },
    ],
  },
];
window.addEventListener("load", () => {
  allData = [
    {
      filename: "google_gemini-3_1-flash-lite-preview.json",
      model: "google/gemini-3.1-flash-lite-preview",
      data: realData,
    },
  ];
  activeModels.add("google/gemini-3.1-flash-lite-preview");
  renderDashboard();
});
