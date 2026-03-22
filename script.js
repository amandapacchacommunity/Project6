let rcsaData = [];
let residualRiskChart;
let cosoChart;
let frameworkCosoChart;
let isoStageChart;

async function loadData() {
  const response = await fetch("data.json");
  return await response.json();
}

function currentPage() {
  return document.body.dataset.page || "home";
}

function formatPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function getInherentRisk(impact, likelihood) {
  return impact * likelihood;
}

function getResidualRisk(inherentRisk, controlEffectiveness) {
  const residual = Math.round(inherentRisk * (1 - controlEffectiveness / 5));
  return Math.max(residual, 1);
}

function getRiskBand(score) {
  if (score >= 10) return "High";
  if (score >= 5) return "Moderate";
  return "Low";
}

function getRiskBandClass(score) {
  if (score >= 10) return "risk-high";
  if (score >= 5) return "risk-moderate";
  return "risk-low";
}

function buildKPIs(records) {
  const totalRisks = records.length;
  const highResidual = records.filter(r => getResidualRisk(getInherentRisk(r.impact, r.likelihood), r.control_effectiveness) >= 10).length;
  const avgControl = (records.reduce((sum, r) => sum + r.control_effectiveness, 0) / records.length).toFixed(1);
  const departments = [...new Set(records.map(r => r.department))].length;

  const kpis = [
    { label: "Total RCSA entries", value: totalRisks, detail: "Synthetic risk-control records" },
    { label: "High residual risks", value: highResidual, detail: "After control effectiveness applied" },
    { label: "Average control rating", value: `${avgControl}/5`, detail: "Synthetic operating effectiveness score" },
    { label: "Departments modeled", value: departments, detail: "Decentralized higher-ed structure" }
  ];

  const grid = document.getElementById("kpiGrid");
  if (!grid) return;

  grid.innerHTML = "";
  kpis.forEach(kpi => {
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `
      <div class="kpi-label">${kpi.label}</div>
      <div class="kpi-value">${kpi.value}</div>
      <div class="kpi-detail">${kpi.detail}</div>
    `;
    grid.appendChild(card);
  });
}

function renderTopRisks(records) {
  const root = document.getElementById("topRisks");
  if (!root) return;

  root.innerHTML = "";

  const ranked = [...records]
    .map(record => {
      const inherent = getInherentRisk(record.impact, record.likelihood);
      const residual = getResidualRisk(inherent, record.control_effectiveness);
      return { ...record, inherent, residual };
    })
    .sort((a, b) => b.residual - a.residual)
    .slice(0, 5);

  ranked.forEach(item => {
    const card = document.createElement("div");
    card.className = "top-risk-card";
    card.innerHTML = `
      <h3>${item.risk_name}</h3>
      <div class="top-risk-meta">${item.department} · ${item.risk_category}</div>
      <p><strong>Residual risk:</strong> ${item.residual} | <strong>COSO:</strong> ${item.coso_component}</p>
      <p class="muted"><strong>Owner:</strong> ${item.owner_role}</p>
    `;
    root.appendChild(card);
  });
}

function renderDeptSummary(records) {
  const root = document.getElementById("deptSummary");
  if (!root) return;

  root.innerHTML = "";

  const grouped = {};
  records.forEach(r => {
    const inherent = getInherentRisk(r.impact, r.likelihood);
    const residual = getResidualRisk(inherent, r.control_effectiveness);
    if (!grouped[r.department]) grouped[r.department] = [];
    grouped[r.department].push(residual);
  });

  Object.entries(grouped).forEach(([dept, scores]) => {
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const row = document.createElement("div");
    row.className = "metric-row";
    row.innerHTML = `<span>${dept}</span><strong>Avg residual: ${avg}</strong>`;
    root.appendChild(row);
  });
}

function renderExecutiveSummary(records) {
  const el = document.getElementById("executiveSummary");
  if (!el) return;

  const residuals = records.map(r => getResidualRisk(getInherentRisk(r.impact, r.likelihood), r.control_effectiveness));
  const highCount = residuals.filter(v => v >= 10).length;
  const avgResidual = (residuals.reduce((a, b) => a + b, 0) / residuals.length).toFixed(1);
  const weakest = [...records]
    .sort((a, b) => a.control_effectiveness - b.control_effectiveness)
    .slice(0, 2)
    .map(r => r.department)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  el.textContent = `This synthetic dashboard suggests a moderate overall control environment with ${highCount} higher-residual exposures remaining, an average residual risk of ${avgResidual}, and improvement priorities concentrated in ${weakest.join(" and ")}.`;
}

function renderResidualRiskChart(records, elementId = "residualRiskChart") {
  const el = document.getElementById(elementId);
  if (!el || typeof Chart === "undefined") return;

  const counts = { Low: 0, Moderate: 0, High: 0 };
  records.forEach(record => {
    const residual = getResidualRisk(getInherentRisk(record.impact, record.likelihood), record.control_effectiveness);
    counts[getRiskBand(residual)]++;
  });

  const chartData = {
    labels: ["Low", "Moderate", "High"],
    datasets: [{ label: "Residual risk count", data: [counts.Low, counts.Moderate, counts.High] }]
  };

  if (residualRiskChart) residualRiskChart.destroy();
  residualRiskChart = new Chart(el, {
    type: "bar",
    data: chartData,
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderCosoChart(records, elementId = "cosoChart", store = "cosoChart") {
  const el = document.getElementById(elementId);
  if (!el || typeof Chart === "undefined") return;

  const grouped = {};
  records.forEach(record => {
    grouped[record.coso_component] = (grouped[record.coso_component] || 0) + 1;
  });

  const chartData = {
    labels: Object.keys(grouped),
    datasets: [{ data: Object.values(grouped) }]
  };

  if (store === "cosoChart" && cosoChart) cosoChart.destroy();
  if (store === "frameworkCosoChart" && frameworkCosoChart) frameworkCosoChart.destroy();

  const chart = new Chart(el, {
    type: "doughnut",
    data: chartData,
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });

  if (store === "cosoChart") cosoChart = chart;
  if (store === "frameworkCosoChart") frameworkCosoChart = chart;
}

function renderIsoStageChart(records) {
  const el = document.getElementById("isoStageChart");
  if (!el || typeof Chart === "undefined") return;

  const grouped = {};
  records.forEach(record => {
    grouped[record.iso_stage] = (grouped[record.iso_stage] || 0) + 1;
  });

  if (isoStageChart) isoStageChart.destroy();

  isoStageChart = new Chart(el, {
    type: "bar",
    data: {
      labels: Object.keys(grouped),
      datasets: [{ label: "Entries", data: Object.values(grouped) }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function populateFilters(data) {
  const deptFilter = document.getElementById("departmentFilter");
  const cosoFilter = document.getElementById("cosoFilter");
  const riskTypeFilter = document.getElementById("riskTypeFilter");

  if (!deptFilter || !cosoFilter || !riskTypeFilter) return;

  const departments = [...new Set(data.records.map(r => r.department))].sort();
  const cosoComponents = [...new Set(data.records.map(r => r.coso_component))].sort();
  const riskTypes = [...new Set(data.records.map(r => r.risk_category))].sort();

  departments.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    deptFilter.appendChild(option);
  });

  cosoComponents.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    cosoFilter.appendChild(option);
  });

  riskTypes.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    riskTypeFilter.appendChild(option);
  });
}

function getFilteredRecords() {
  const dept = document.getElementById("departmentFilter")?.value || "All";
  const coso = document.getElementById("cosoFilter")?.value || "All";
  const category = document.getElementById("riskTypeFilter")?.value || "All";
  const query = document.getElementById("searchBox")?.value.trim().toLowerCase() || "";

  return rcsaData.filter(record => {
    const matchesDept = dept === "All" || record.department === dept;
    const matchesCoso = coso === "All" || record.coso_component === coso;
    const matchesCategory = category === "All" || record.risk_category === category;
    const text = Object.values(record).join(" ").toLowerCase();
    const matchesSearch = !query || text.includes(query);
    return matchesDept && matchesCoso && matchesCategory && matchesSearch;
  });
}

function renderTable(records) {
  const tbody = document.querySelector("#rcsaTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  records.forEach(record => {
    const inherentRisk = getInherentRisk(record.impact, record.likelihood);
    const residualRisk = getResidualRisk(inherentRisk, record.control_effectiveness);
    const band = getRiskBand(residualRisk);
    const bandClass = getRiskBandClass(residualRisk);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.department}</td>
      <td>${record.risk_category}</td>
      <td>${record.risk_name}</td>
      <td>${record.control_name}</td>
      <td>${record.impact}</td>
      <td>${record.likelihood}</td>
      <td>${inherentRisk}</td>
      <td>${record.control_effectiveness}/5</td>
      <td><span class="risk-pill ${bandClass}">${residualRisk} (${band})</span></td>
      <td>${record.coso_component}</td>
      <td>${record.coso_principle}</td>
      <td>${record.iso_stage}</td>
      <td>${record.owner_role}</td>
      <td><span class="status-pill">${record.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateRegisterPage() {
  const filtered = getFilteredRecords();
  renderTable(filtered);
}

function updateForecast() {
  const incidentShiftEl = document.getElementById("incidentShift");
  const controlShiftEl = document.getElementById("controlShift");
  const budgetStressEl = document.getElementById("budgetStress");
  const complianceChangeEl = document.getElementById("complianceChange");

  if (!incidentShiftEl || !controlShiftEl || !budgetStressEl || !complianceChangeEl) return;

  const incidentShift = Number(incidentShiftEl.value);
  const controlShift = Number(controlShiftEl.value);
  const budgetStress = Number(budgetStressEl.value);
  const complianceChange = Number(complianceChangeEl.value);

  document.getElementById("incidentShiftValue").textContent = formatPercent(incidentShift);
  document.getElementById("controlShiftValue").textContent = formatPercent(controlShift);
  document.getElementById("budgetStressValue").textContent = formatPercent(budgetStress);
  document.getElementById("complianceChangeValue").textContent = formatPercent(complianceChange);

  const projectedImpact = Math.max(20, Math.min(95, Math.round(48 + incidentShift * 1.1 + budgetStress * 0.8 + complianceChange * 0.7 - controlShift * 0.9)));
  const projectedLikelihood = Math.max(20, Math.min(95, Math.round(45 + incidentShift * 1.0 + complianceChange * 0.8 + budgetStress * 0.5 - controlShift * 1.0)));
  const residualRiskShift = Math.round(incidentShift * 0.8 + budgetStress * 0.6 + complianceChange * 0.5 - controlShift * 1.1);
  const controlEnvironmentShift = Math.round(controlShift * 0.7 - budgetStress * 0.3);

  let impactBand = "low";
  if (projectedImpact >= 74) impactBand = "high";
  else if (projectedImpact >= 52) impactBand = "moderate";

  let likelihoodBand = "low";
  if (projectedLikelihood >= 74) likelihoodBand = "high";
  else if (projectedLikelihood >= 52) likelihoodBand = "moderate";

  const summary = document.getElementById("forecastSummary");
  if (summary) {
    summary.textContent = `Under this synthetic scenario, residual risk is projected to move ${residualRiskShift >= 0 ? "up" : "down"} ${Math.abs(residualRiskShift)}%, with overall exposure shifting toward ${impactBand} impact and ${likelihoodBand} likelihood as operating pressure and control conditions change.`;
  }

  const root = document.getElementById("forecastMetrics");
  if (root) {
    const metrics = [
      ["Projected impact score", `${projectedImpact}/100`],
      ["Projected likelihood score", `${projectedLikelihood}/100`],
      ["Residual risk shift", formatPercent(residualRiskShift)],
      ["Control environment shift", formatPercent(controlEnvironmentShift)]
    ];

    root.innerHTML = "";
    metrics.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "metric-row";
      row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      root.appendChild(row);
    });
  }
}

function bindRegisterEvents() {
  ["departmentFilter", "cosoFilter", "riskTypeFilter", "searchBox"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateRegisterPage);
    if (el && el.tagName === "SELECT") el.addEventListener("change", updateRegisterPage);
  });
}

function bindForecastEvents() {
  ["incidentShift", "controlShift", "budgetStress", "complianceChange"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateForecast);
  });
}

function initHomePage() {
  buildKPIs(rcsaData);
  renderResidualRiskChart(rcsaData);
  renderCosoChart(rcsaData, "cosoChart", "cosoChart");
  renderTopRisks(rcsaData);
  renderDeptSummary(rcsaData);
  renderExecutiveSummary(rcsaData);
}

function initRegisterPage() {
  populateFilters({ records: rcsaData });
  bindRegisterEvents();
  updateRegisterPage();
}

function initFrameworkPage() {
  renderCosoChart(rcsaData, "frameworkCosoChart", "frameworkCosoChart");
  renderIsoStageChart(rcsaData);
}

function initForecastPage() {
  bindForecastEvents();
  updateForecast();
}

async function init() {
  const data = await loadData();
  rcsaData = data.records;

  const page = currentPage();

  if (page === "home") initHomePage();
  if (page === "register") initRegisterPage();
  if (page === "framework") initFrameworkPage();
  if (page === "forecast") initForecastPage();
}

init();
