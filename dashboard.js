/* ============================================================
   PKO Sector Outlook Dashboard
   - Modular, state-driven, easy to extend
   - All DOM refs + rendering in one class
   - Event delegation for easy interactivity
   ============================================================ */

class PKODashboard {
  constructor(options = {}) {
    this.options = {
      dataUrl: "data/dashboard_data.json",
      ...options
    };

    this.colors = {
      developing: "#36d0ff",
      core: "#5e8bff",
      watchlist: "#ff7b6f"
    };

    this.state = {
      segment: "all",
      yearIndex: 0,
      selected: null,
      matrixMode: "heatmap"
    };

    this.model = null;
    this.matrixFrame = null;

    this.scatterPoints = [];
    this.coverageRegions = [];
    this.matrixRegions = [];
    this.gpRegions = [];
    this.ikbRegions = [];

    this.cacheDom();
    this.bindEvents();
  }

  /* ---------------- DOM ---------------- */

  cacheDom() {
    this.kpiContainer = document.getElementById("kpi-list");
    this.yearSlider = document.getElementById("year");
    this.yearValue = document.getElementById("year-value");
    this.forecastFlag = document.getElementById("forecast-flag");

    this.scatterCanvas = document.getElementById("scatter");

    this.table = document.getElementById("table");
    this.tableBody = this.table?.querySelector("tbody");

    this.segmentControl = document.getElementById("segment-control");

    this.driversList = document.getElementById("drivers-list");
    this.metricGrid = document.getElementById("metric-grid");

    this.detailName = document.getElementById("detail-name");
    this.detailTag = document.getElementById("detail-tag");
    this.detailNote = null;
    this.chipGrowth = document.getElementById("chip-growth");
    this.chipRisk = document.getElementById("chip-risk");
    this.chipExport = null;

    this.valScore = document.getElementById("val-score");
    this.valRisk = document.getElementById("val-risk");
    this.valDebt = document.getElementById("val-debt");

    this.sparkScore = document.getElementById("spark-score");
    this.sparkRisk = document.getElementById("spark-risk");
    this.sparkDebt = document.getElementById("spark-debt");

    this.sectorPicker = document.getElementById("sector-picker");

    this.coverageCanvas = document.getElementById("coverage-chart");

    this.matrixCanvas = document.getElementById("matrix");
    this.gpCanvas = document.getElementById("gp-chart");
    this.ikbCanvas = document.getElementById("ikb-chart");
    this.matrixTooltip = document.getElementById("matrix-tooltip");
    this.matrixToggle = document.getElementById("matrix-toggle");
  }

  bindEvents() {
    const handleYearChange = (value, { light = false } = {}) => {
      const idx = parseInt(value, 10);
      if (Number.isNaN(idx)) return;
      this.setYearIndex(idx, { light });
    };

    /* Segment: event delegation */
    this.segmentControl?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-segment]");
      if (!btn) return;
      this.setSegment(btn.dataset.segment);
    });

    /* Year slider */
    this.yearSlider?.addEventListener("input", (e) => handleYearChange(e.target.value, { light: true }));
    this.yearSlider?.addEventListener("change", (e) => handleYearChange(e.target.value));

    /* Sector picker */
    this.sectorPicker?.addEventListener("change", (e) => {
      this.selectSector(e.target.value);
    });

    /* Matrix mode */
    this.matrixToggle?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      this.setMatrixMode(btn.dataset.mode);
    });

    /* Scatter click */
    this.scatterCanvas?.addEventListener("click", (e) => {
      this.handleScatterClick(e);
    });

    /* Coverage click */
    this.coverageCanvas?.addEventListener("click", (e) => {
      this.handleCoverageClick(e);
    });

    /* Matrix hover + click */
    this.matrixCanvas?.addEventListener("mousemove", (e) => {
      this.handleMatrixHover(e);
    });
    this.matrixCanvas?.addEventListener("mouseleave", () => {
      if (this.matrixTooltip) this.matrixTooltip.style.display = "none";
    });
    this.matrixCanvas?.addEventListener("click", (e) => {
      this.handleMatrixClick(e);
    });

    /* GP click */
    this.gpCanvas?.addEventListener("click", (e) => {
      this.handleGpClick(e);
    });

    /* IKB click */
    this.ikbCanvas?.addEventListener("click", (e) => {
      this.handleIkbClick(e);
    });

    /* Table row click (delegation) */
    this.tableBody?.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-id]");
      if (!row) return;
      this.selectSector(row.dataset.id);
    });

    /* Responsive redraw */
    window.addEventListener("resize", () => {
      if (!this.model) return;
      this.renderChartsOnly();
    });
  }

  /* ---------------- Public API ---------------- */

  async init() {
    await this.loadData();
    this.syncInitialState();
    this.renderAll();
    return this;
  }

  setSegment(segment) {
    this.state.segment = segment;
    this.updateSegmentUI();
    this.renderAll();
  }

  setYearIndex(idx, { light = false } = {}) {
    if (!this.model) return;
    const max = this.model.years.length - 1;
    if (idx === this.state.yearIndex) return;
    this.state.yearIndex = Math.max(0, Math.min(max, idx));
    if (this.yearSlider) this.yearSlider.value = String(this.state.yearIndex);
    this.updateYearLabel();
    if (light) {
      // Lightweight pass while dragging: keep charts in sync without reflowing the whole page.
      this.renderChartsOnly();
    } else {
      this.renderAll();
    }
    this.queueMatrixSuite();
  }

  setMatrixMode(mode) {
    this.state.matrixMode = mode;
    this.updateMatrixToggleUI();
    this.renderMatrixSuite();
  }

  selectSector(id) {
    this.state.selected = id;
    if (this.sectorPicker) this.sectorPicker.value = id;
    this.renderDetail();
    this.renderTable();
    this.renderCoverageChart();
    this.renderMatrixSuite(); // highlights in GP/IKB
  }

  /* ---------------- Data ---------------- */

  async loadData() {
    try {
      const [resJson, resLu] = await Promise.all([
        fetch(this.options.dataUrl),
        fetch(encodeURI("data/LICZBA UPADŁOŚCI %.csv")).catch(() => null)
      ]);
      this.model = await resJson.json();
      if (resLu?.ok) {
        const luText = await resLu.text();
        this.applyLuRisk(luText);
      }
    } catch (err) {
      console.error("Nie udało się wczytać danych dashboardu", err);
      this.model = { years: [], sectors: [] };
      if (this.kpiContainer) {
        this.kpiContainer.innerHTML =
          `<div class="kpi"><small>Błąd</small><div class="value">Brak danych</div><div class="trend">Sprawdź ${this.options.dataUrl}</div></div>`;
      }
    }
  }

  syncInitialState() {
    if (!this.model?.years?.length) return;

    const lastIdx = this.model.years.length - 1;
    this.yearSlider.max = String(lastIdx);
    this.yearSlider.value = String(lastIdx);
    this.state.yearIndex = lastIdx;

    if (!this.state.selected && this.model.sectors?.length) {
      this.state.selected = this.model.sectors[0].id;
    }

    this.updateYearLabel();
    this.updateSegmentUI();
    this.updateMatrixToggleUI();
  }

  /* ---------------- Helpers ---------------- */

  getVisibleSectors() {
    if (!this.model) return [];
    const { segment } = this.state;
    if (segment === "all") return this.model.sectors;
    return this.model.sectors.filter(s => s.tier === segment);
  }

  parseLuCsv(csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return {};
    const headers = lines.shift().split(";");
    const colIdx = headers.reduce((acc, h, i) => ({ ...acc, [h]: i }), {});
    const luCols = headers.filter(h => h.endsWith("_LU%"));
    const yearIdx = headers.findIndex(h => h.toLowerCase() === "rok");
    const series = {};

    lines.forEach(line => {
      const parts = line.split(";");
      const year = Number(parts[yearIdx]);
      if (!Number.isFinite(year)) return;
      luCols.forEach(col => {
        const raw = parseFloat(parts[colIdx[col]] ?? "");
        if (!Number.isFinite(raw)) return;
        if (!series[col]) series[col] = [];
        series[col].push({ year, value: raw });
      });
    });

    return series;
  }

  applyLuRisk(csvText) {
    if (!this.model?.sectors?.length || !csvText) return;

    const series = this.parseLuCsv(csvText);
    const yearIdxMap = new Map(this.model.years.map((y, i) => [y, i]));

    this.model.sectors = this.model.sectors.map(sector => {
      const key = `${sector.id}_LU%`;
      const entries = series[key];
      if (!entries?.length) return sector;

      const risk = [...(sector.risk ?? new Array(this.model.years.length).fill(0))];
      const defaults = [...(sector.defaults ?? new Array(this.model.years.length).fill(0))];

      entries.forEach(({ year, value }) => {
        const idx = yearIdxMap.get(year);
        if (idx !== undefined) {
          const frac = value / 100;
          risk[idx] = frac;
          defaults[idx] = value;
        }
      });

      return { ...sector, risk, defaults };
    });
  }

  formatTier(tier) {
    if (tier === "developing") return "Rozwojowe";
    if (tier === "core") return "Kluczowe";
    if (tier === "watchlist") return "Na obserwacji";
    return tier ?? "";
  }

  shortName(name, max = 24) {
    if (!name) return "";
    const trimmed = name.trim();
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
  }

  updateSegmentUI() {
    const buttons = this.segmentControl?.querySelectorAll("button[data-segment]") || [];
    buttons.forEach(btn => btn.classList.toggle("active", btn.dataset.segment === this.state.segment));
  }

  updateMatrixToggleUI() {
    const buttons = this.matrixToggle?.querySelectorAll("button[data-mode]") || [];
    buttons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === this.state.matrixMode));

    // toggle canvas visibility using classes
    if (this.matrixCanvas) this.matrixCanvas.classList.toggle("is-hidden", this.state.matrixMode !== "heatmap");
    if (this.gpCanvas) this.gpCanvas.classList.toggle("is-hidden", this.state.matrixMode !== "growth-profit");
    if (this.ikbCanvas) this.ikbCanvas.classList.toggle("is-hidden", this.state.matrixMode !== "ikb");

    if (this.matrixTooltip) this.matrixTooltip.style.display = "none";
  }

  updateSliderFill() {
    if (!this.yearSlider) return;
    const min = Number(this.yearSlider.min);
    const max = Number(this.yearSlider.max);
    const val = Number(this.yearSlider.value);
    const percent = ((val - min) / (max - min || 1)) * 100;
    this.yearSlider.style.setProperty("--fill", `${percent}%`);
  }

  updateYearLabel() {
    if (!this.model?.years?.length) return;
    const year = this.model.years[this.state.yearIndex];
    const isForecast = this.model.forecast_start && year >= this.model.forecast_start;

    if (this.yearValue) this.yearValue.textContent = `${year}`;

    if (this.forecastFlag) {
      this.forecastFlag.classList.toggle("is-visible", Boolean(isForecast));
      this.forecastFlag.setAttribute("aria-hidden", isForecast ? "false" : "true");
    }

    this.updateSliderFill();
  }

  colorScale(value) {
    const clamp = Math.max(0, Math.min(100, value));
    const t = clamp / 100;
    const r = Math.round(30 + (75 * t));
    const g = Math.round(90 + (140 * t));
    const b = Math.round(190 + (55 * t));
    return `rgb(${r},${g},${b})`;
  }

  /* ---------------- Render orchestrators ---------------- */

  renderAll() {
    if (!this.model?.sectors?.length) return;
    if (!this.state.selected) this.state.selected = this.model.sectors[0].id;

    this.renderPicker();
    this.renderKpis();
    this.renderTable();
    this.renderDetail();
    this.renderDrivers();
    this.renderMetrics();

    this.renderChartsOnly();
  }

  renderChartsOnly() {
    this.drawScatter();
    this.renderCoverageChart();
    this.renderMatrixSuite();
  }

  queueMatrixSuite() {
    if (this.matrixFrame) cancelAnimationFrame(this.matrixFrame);
    this.matrixFrame = requestAnimationFrame(() => {
      this.matrixFrame = null;
      this.renderMatrixSuite();
    });
  }

  renderMatrixSuite() {
    this.updateMatrixToggleUI();

    // Always redraw all modes so switching tabs reflects the current year immediately.
    this.renderMatrix();
    this.renderGrowthProfit();
    this.renderIkb();
  }

  /* ---------------- UI sections ---------------- */

  renderPicker() {
    if (!this.sectorPicker || !this.model) return;
    this.sectorPicker.innerHTML = this.model.sectors
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join("");
    if (this.state.selected) this.sectorPicker.value = this.state.selected;
  }

  renderKpis() {
    const sectors = this.getVisibleSectors();
    if (!sectors.length || !this.kpiContainer) {
      if (this.kpiContainer) {
        this.kpiContainer.innerHTML =
          `<div class="kpi"><small>Ładowanie</small><div class="value">—</div><div class="trend">Proszę czekać…</div></div>`;
      }
      return;
    }

    const idx = this.state.yearIndex;
    const avgGrowth = sectors.reduce((acc, s) => acc + (s.growth[idx] ?? 0), 0) / sectors.length;
    const avgRisk = sectors.reduce((acc, s) => acc + (s.risk[idx] ?? 0), 0) / sectors.length;
    const avgDebt = sectors.reduce((acc, s) => acc + (s.debt[idx] ?? 0), 0) / sectors.length;
    const bestSector = [...sectors].sort((a, b) => (b.score[idx] ?? 0) - (a.score[idx] ?? 0))[0];

    const kpis = [
      { label: "Śr. wzrost", value: `${avgGrowth.toFixed(1)}%`, trend: "+ odporne momentum" },
      { label: "Śr. ryzyko niewypł.", value: `${(avgRisk * 100).toFixed(0)}%`, trend: "spadek vs 2020", down: true },
      { label: "Śr. zadłużenie", value: `${(avgDebt * 100).toFixed(0)}%`, trend: "stopniowa delewar." },
      { label: "Lider sektora", value: bestSector?.name ?? "—", trend: `${(bestSector?.score?.[idx] ?? 0).toFixed(0)} pkt` }
    ];

    this.kpiContainer.innerHTML = kpis.map(k => `
      <div class="kpi">
        <small>${k.label}</small>
        <div class="value">${k.value}</div>
        <div class="trend ${k.down ? "down" : ""}">${k.trend}</div>
      </div>
    `).join("");
  }

  renderDrivers() {
    if (!this.model?.drivers || !this.driversList) return;
    const maxShow = 20;
    const drivers = this.model.drivers.slice(0, maxShow);
    const more = this.model.drivers.length - drivers.length;
    this.driversList.innerHTML = drivers.map(d => `<span>${d}</span>`).join("");
    if (more > 0) this.driversList.innerHTML += `<span>+${more} więcej</span>`;
  }

  renderMetrics() {
    if (!this.model?.metrics || !this.metricGrid) return;
    this.metricGrid.innerHTML = this.model.metrics.map(m => `
      <div class="metric-card">
        <h3>${m.title}</h3>
        <p>${m.detail}</p>
      </div>
    `).join("");
  }

  renderTable() {
    if (!this.model || !this.tableBody) return;

    const idx = this.state.yearIndex;
    const sectors = this.getVisibleSectors()
      .map(s => ({
        ...s,
        currentScore: s.score?.[idx] ?? 0,
        growthNow: s.growth?.[idx] ?? 0,
        riskNow: s.risk?.[idx] ?? 0,
        debtNow: s.debt?.[idx] ?? 0,
        exportNow: s.export?.[idx] ?? 0
      }))
      .sort((a, b) => b.currentScore - a.currentScore);

    this.tableBody.innerHTML = sectors.map((s, i) => `
      <tr data-id="${s.id}" class="${this.state.selected === s.id ? "active" : ""}">
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>
          <span class="pill-badge ${
            s.tier === "developing" ? "dev" :
            s.tier === "core" ? "core" : "watch"
          }">${this.formatTier(s.tier)}</span>
        </td>
        <td>${s.currentScore.toFixed(0)}</td>
        <td>${s.growthNow.toFixed(1)}%</td>
        <td>${(s.riskNow * 100).toFixed(0)}%</td>
        <td>${(s.debtNow * 100).toFixed(0)}%</td>
        <td>${s.exportNow.toFixed(0)}%</td>
      </tr>
    `).join("");
  }

  renderDetail() {
    if (!this.model) return;
    const sector =
      this.model.sectors.find(s => s.id === this.state.selected) ||
      this.model.sectors[0];

    if (!sector) return;

    const idx = this.state.yearIndex;

    if (this.detailName) this.detailName.textContent = sector.name;
    if (this.detailTag) {
      this.detailTag.textContent =
        `${this.formatTier(sector.tier)} • ${(sector.score?.[idx] ?? 0).toFixed(0)} pkt`;
      this.detailTag.className = "tag";
    }

    if (this.valScore) this.valScore.textContent = `${(sector.score?.[idx] ?? 0).toFixed(0)} pkt`;
    if (this.valRisk) this.valRisk.textContent = `${((sector.risk?.[idx] ?? 0) * 100).toFixed(1)}%`;
    if (this.valDebt) this.valDebt.textContent = `${((sector.debt?.[idx] ?? 0) * 100).toFixed(1)}%`;
    if (this.chipGrowth) this.chipGrowth.textContent = `Wzrost: ${(sector.growth?.[idx] ?? 0).toFixed(1)}%`;
    if (this.chipRisk) this.chipRisk.textContent = `Ryzyko: ${((sector.risk?.[idx] ?? 0) * 100).toFixed(0)}%`;

    this.drawSpark(this.sparkScore, sector.score ?? [], this.colors[sector.tier] ?? "#5e8bff");
    this.drawSpark(this.sparkRisk, sector.defaults ?? (sector.risk ?? []).map(v => v * 100), "#ffb89f");
    this.drawSpark(this.sparkDebt, (sector.debt ?? []).map(v => v * 100), "#5e8bff");
  }

  /* ---------------- Drawing: small line ---------------- */

  drawSpark(canvas, series, color) {
    if (!canvas || !series?.length) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...series);
    const max = Math.max(...series);
    const pad = 10 * dpr;
    const w = width - pad * 2;
    const h = height - pad * 2;

    ctx.strokeStyle = "rgba(220,232,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, height - pad);
    ctx.lineTo(width - pad, height - pad);
    ctx.stroke();

    ctx.beginPath();
    series.forEach((v, i) => {
      const x = pad + (w / (series.length - 1)) * i;
      const y = height - pad - ((v - min) / (max - min || 1)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * dpr;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    series.forEach((v, i) => {
      const x = pad + (w / (series.length - 1)) * i;
      const y = height - pad - ((v - min) / (max - min || 1)) * h;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.arc(x, y + 1 * dpr, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dce8ff";
      ctx.beginPath();
      ctx.arc(x, y, 4.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* ---------------- Scatter ---------------- */

  drawScatter() {
    if (!this.model || !this.scatterCanvas) return;

    const ctx = this.scatterCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = this.scatterCanvas.clientWidth * dpr;
    const height = this.scatterCanvas.clientHeight * dpr;
    this.scatterCanvas.width = width;
    this.scatterCanvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(14 * dpr, 10 * dpr);
    const plotW = width - 28 * dpr;
    const plotH = height - 24 * dpr;

    const sectors = this.model.sectors;
    const idx = this.state.yearIndex;
    const maxGrowth = Math.max(...sectors.map(s => s.growth?.[idx] ?? 0)) * 1.05 || 1;
    const maxRisk = Math.max(...sectors.map(s => s.risk?.[idx] ?? 0)) * 1.05 || 1;

    this.scatterPoints = [];

    ctx.strokeStyle = "rgba(220,232,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(220,232,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, plotH);
    ctx.lineTo(plotW, plotH);
    ctx.lineTo(plotW, 0);
    ctx.stroke();

    sectors.forEach(sector => {
      const risk = sector.risk?.[idx] ?? 0;
      const growth = sector.growth?.[idx] ?? 0;
      const x = (risk / maxRisk) * plotW;
      const y = plotH - (growth / maxGrowth) * plotH;
      const radius = 8 * dpr;
      const color = this.colors[sector.tier] ?? "#5e8bff";

      const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius * 1.7);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#eaf1ff";
      ctx.font = `${12 * dpr}px "Avenir Next", "Nunito Sans", "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText((sector.name ?? "").split(" ")[0] ?? "", x, y - 12 * dpr);

      this.scatterPoints.push({
        id: sector.id,
        x: x + 14 * dpr,
        y: y + 10 * dpr,
        r: radius * 2
      });
    });

    ctx.restore();
  }

  handleScatterClick(e) {
    if (!this.scatterPoints.length) return;
    const rect = this.scatterCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cx = (e.clientX - rect.left) * dpr;
    const cy = (e.clientY - rect.top) * dpr;

    let nearest = null;
    let minDist = Infinity;

    this.scatterPoints.forEach(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    });

    if (nearest) this.selectSector(nearest.id);
  }

  /* ---------------- Coverage chart ---------------- */

  renderCoverageChart() {
    if (!this.model || !this.coverageCanvas) return;

    const ctx = this.coverageCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = this.coverageCanvas.clientWidth || 640;

    const barHeight = 18;
    const gap = 8;
    const padding = 16;

    const sectors = [...this.model.sectors];
    const idx = this.state.yearIndex;

    sectors.sort((a, b) => (b.score?.[idx] ?? 0) - (a.score?.[idx] ?? 0));

    const height = padding * 2 + sectors.length * (barHeight + gap);

    this.coverageCanvas.width = width * dpr;
    this.coverageCanvas.height = height * dpr;
    this.coverageCanvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    this.coverageRegions = [];
    const maxScore = Math.max(...sectors.map(s => s.score?.[idx] ?? 0)) || 1;

    ctx.font = "12px \"Avenir Next\", \"Nunito Sans\", \"Segoe UI\", sans-serif";
    ctx.textBaseline = "middle";

    sectors.forEach((s, i) => {
      const y = padding + i * (barHeight + gap);
      const score = s.score?.[idx] ?? 0;
      const color = this.colors[s.tier] ?? "#5e8bff";
      const isSelected = this.state.selected === s.id;

      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.fillRect(padding, y, width - padding * 2, barHeight);

      const barW = Math.max(6, (score / maxScore) * (width - padding * 2));
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 1 : 0.72;
      ctx.fillRect(padding, y, barW, barHeight);
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padding - 1, y - 1, barW + 2, barHeight + 2);
      }

      ctx.fillStyle = "#eaf1ff";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}. ${s.name}`, padding + 8, y + barHeight / 1.45);

      ctx.fillStyle = "rgba(220, 232, 255, 0.88)";
      ctx.textAlign = "right";
      ctx.fillText(`${score.toFixed(0)} pkt`, width - padding, y + barHeight / 1.45);

      this.coverageRegions.push({ id: s.id, y, h: barHeight });
    });

    ctx.restore();
  }

  handleCoverageClick(e) {
    if (!this.coverageRegions.length) return;
    const rect = this.coverageCanvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const region = this.coverageRegions.find(r => y >= r.y && y <= r.y + r.h);
    if (region) this.selectSector(region.id);
  }

  /* ---------------- Matrix: heatmap ---------------- */

  renderMatrix() {
    if (!this.model || !this.matrixCanvas) return;

    const years = this.model.years;
    const idx = this.state.yearIndex;

    const sectors = [...this.model.sectors].sort((a, b) => (b.score?.[idx] ?? 0) - (a.score?.[idx] ?? 0));

    const dpr = window.devicePixelRatio || 1;
    const width = this.matrixCanvas.clientWidth || 1000;

    const labelWidth = 210;
    const pad = 14;
    const topPad = 32;
    const bottomPad = 24;
    const cellH = 22;
    const cellW = Math.max(34, (width - labelWidth - pad * 2) / years.length);

    const height = topPad + sectors.length * cellH + bottomPad;

    this.matrixCanvas.width = width * dpr;
    this.matrixCanvas.height = height * dpr;
    this.matrixCanvas.style.height = `${height}px`;

    this.matrixRegions = [];

    const ctx = this.matrixCanvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, 0, width, height);

    ctx.font = "12px \"Avenir Next\", \"Nunito Sans\", \"Segoe UI\", sans-serif";
    ctx.fillStyle = "rgba(220,232,255,0.75)";
    ctx.textBaseline = "middle";

    /* Header years */
    years.forEach((y, j) => {
      const x = labelWidth + pad + j * cellW + cellW / 2;
      ctx.textAlign = "center";
      const label = this.model.forecast_start && y >= this.model.forecast_start ? `${y}*` : `${y}`;
      ctx.fillText(label, x, topPad - 14);
    });

    /* Cells */
    sectors.forEach((s, i) => {
      const y = topPad + i * cellH;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(220,232,255,0.86)";
      ctx.fillText(`${i + 1}. ${this.shortName(s.name)}`, pad, y + cellH / 1.6);

      years.forEach((year, j) => {
        const x = labelWidth + pad + j * cellW;
        const val = s.score?.[j] ?? 0;
        ctx.fillStyle = this.colorScale(val);
        ctx.fillRect(x, y, cellW - 2, cellH - 2);
        this.matrixRegions.push({ id: s.id, yearIndex: j, x, y, w: cellW - 2, h: cellH - 2, value: val });
      });
    });

    /* Forecast divider */
    if (this.model.forecast_start) {
      const forecastIdx = years.findIndex(y => y >= this.model.forecast_start);
      if (forecastIdx > -1) {
        const lineX = labelWidth + pad + forecastIdx * cellW - 4;
        ctx.strokeStyle = "rgba(220,232,255,0.5)";
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(lineX, 8);
        ctx.lineTo(lineX, height - 8);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(220,232,255,0.7)";
        ctx.font = "11px \"Avenir Next\", \"Nunito Sans\", \"Segoe UI\", sans-serif";
        ctx.fillText("Prognoza", lineX + 6, topPad - 4);
      }
    }

    ctx.restore();
  }

  handleMatrixHover(e) {
    if (!this.matrixRegions.length || !this.matrixTooltip) return;

    const rect = this.matrixCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const region = this.matrixRegions.find(r =>
      x >= r.x && x <= r.x + r.w &&
      y >= r.y && y <= r.y + r.h
    );

    if (!region) {
      this.matrixTooltip.style.display = "none";
      return;
    }

    const sector = this.model.sectors.find(s => s.id === region.id);
    const year = this.model.years[region.yearIndex];

    this.matrixTooltip.style.display = "block";
    this.matrixTooltip.style.left = `${x + 12}px`;
    this.matrixTooltip.style.top = `${y + 12}px`;
    this.matrixTooltip.innerHTML =
      `<strong>${sector?.name ?? region.id}</strong><br>${year}: ${region.value.toFixed(0)} pkt`;
  }

  handleMatrixClick(e) {
    if (!this.matrixRegions.length) return;

    const rect = this.matrixCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const region = this.matrixRegions.find(r =>
      x >= r.x && x <= r.x + r.w &&
      y >= r.y && y <= r.y + r.h
    );

    if (region) this.selectSector(region.id);
  }

  /* ---------------- Growth vs Profit ---------------- */

  renderGrowthProfit() {
    if (!this.model || !this.gpCanvas) return;

    const ctx = this.gpCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const width = this.gpCanvas.clientWidth || 1000;
    const height = 420;

    this.gpCanvas.width = width * dpr;
    this.gpCanvas.height = height * dpr;
    this.gpCanvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const idx = this.state.yearIndex;
    const sectors = this.model.sectors;

    const profits = sectors.map(s => s.score?.[idx] ?? 0);
    const growths = sectors.map(s => s.growth?.[idx] ?? 0);

    const medianProfit = profits.slice().sort((a, b) => a - b)[Math.floor(profits.length / 2)] ?? 0;
    const medianGrowth = growths.slice().sort((a, b) => a - b)[Math.floor(growths.length / 2)] ?? 0;

    const maxProfit = Math.max(...profits) || 1;
    const minProfit = Math.min(...profits) || 0;
    const maxGrowth = Math.max(...growths) || 1;
    const minGrowth = Math.min(...growths) || 0;

    const pad = 50;
    const plotW = width - pad * 2;
    const plotH = height - pad * 2;

    this.gpRegions = [];

    ctx.strokeStyle = "rgba(220,232,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, height - pad);
    ctx.lineTo(width - pad, height - pad);
    ctx.stroke();

    const medX = pad + ((medianProfit - minProfit) / (maxProfit - minProfit || 1)) * plotW;
    const medY = height - pad - ((medianGrowth - minGrowth) / (maxGrowth - minGrowth || 1)) * plotH;

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(220,232,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(medX, pad);
    ctx.lineTo(medX, height - pad);
    ctx.moveTo(pad, medY);
    ctx.lineTo(width - pad, medY);
    ctx.stroke();
    ctx.setLineDash([]);

    sectors.forEach(s => {
      const profit = s.score?.[idx] ?? 0;
      const growth = s.growth?.[idx] ?? 0;

      const x = pad + ((profit - minProfit) / (maxProfit - minProfit || 1)) * plotW;
      const y = height - pad - ((growth - minGrowth) / (maxGrowth - minGrowth || 1)) * plotH;

      const color = this.colors[s.tier] ?? "#5e8bff";
      const isSelected = this.state.selected === s.id;

      ctx.fillStyle = color;
      ctx.shadowBlur = isSelected ? 16 : 8;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#eaf1ff";
      ctx.font = "11px \"Avenir Next\", \"Nunito Sans\", \"Segoe UI\", sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((s.name ?? "").split(" ")[0] ?? "", x, y - 12);

      this.gpRegions.push({ id: s.id, x, y, r: 10 });
    });

    ctx.fillStyle = "rgba(220,232,255,0.8)";
    ctx.font = "12px \"Avenir Next\", \"Nunito Sans\", \"Segoe UI\", sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Rentowność (proxy: wynik łączny)", width / 2 - 40, height - pad + 28);

    ctx.save();
    ctx.translate(pad - 32, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Wzrost (r/r %)", 0, 0);
    ctx.restore();

    const labels = [
      { text: "Liderzy", x: medX + 8, y: medY - 10 },
      { text: "Transformujący", x: medX + 8, y: medY + 20 },
      { text: "Efektywność", x: medX - 80, y: medY - 10 },
      { text: "Pod presją", x: medX - 70, y: medY + 20 }
    ];

    labels.forEach(l => {
      ctx.fillStyle = "rgba(220,232,255,0.65)";
      ctx.textAlign = "left";
      ctx.fillText(l.text, l.x, l.y);
    });

    ctx.restore();
  }

  handleGpClick(e) {
    if (!this.gpRegions.length) return;
    const rect = this.gpCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const region = this.gpRegions.find(r => {
      const dx = r.x - x;
      const dy = r.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= r.r;
    });

    if (region) this.selectSector(region.id);
  }

  /* ---------------- IKB ranking lines ---------------- */

  renderIkb() {
    if (!this.model || !this.ikbCanvas) return;

    const ctx = this.ikbCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const width = this.ikbCanvas.clientWidth || 1000;
    const height = 420;

    this.ikbCanvas.width = width * dpr;
    this.ikbCanvas.height = height * dpr;
    this.ikbCanvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const years = this.model.years;
    const pad = 60;
    const plotW = width - pad * 2;
    const plotH = height - pad * 2;

    const allScores = this.model.sectors.flatMap(s => s.score ?? []);
    const maxScore = Math.max(...allScores) || 1;
    const minScore = Math.min(...allScores) || 0;

    this.ikbRegions = [];

    ctx.strokeStyle = "rgba(220,232,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, height - pad);
    ctx.lineTo(width - pad, height - pad);
    ctx.stroke();

    const xYear = pad + (plotW / (years.length - 1 || 1)) * this.state.yearIndex;

    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(220,232,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(xYear, pad);
    ctx.lineTo(xYear, height - pad);
    ctx.stroke();
    ctx.setLineDash([]);

    this.model.sectors.forEach(s => {
      const color = this.colors[s.tier] ?? "#5e8bff";
      const isSelected = this.state.selected === s.id;

      ctx.beginPath();
      (s.score ?? []).forEach((v, i) => {
        const x = pad + (plotW / (years.length - 1 || 1)) * i;
        const y = height - pad - ((v - minScore) / (maxScore - minScore || 1)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (i === this.state.yearIndex) {
          this.ikbRegions.push({ id: s.id, x, y, r: 8 });
        }
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.4;
      ctx.globalAlpha = isSelected ? 1 : 0.65;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 12 : 6;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    this.ikbRegions.forEach(p => {
      const tier = this.model.sectors.find(s => s.id === p.id)?.tier;
      ctx.fillStyle = this.colors[tier] ?? "#5e8bff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.id === this.state.selected ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(220,232,255,0.8)";
    ctx.font = "12px \"Avenir Next\", \"Nunito Sans\", \"Segoe UI\", sans-serif";
    ctx.textAlign = "center";

    years.forEach((y, i) => {
      const x = pad + (plotW / (years.length - 1 || 1)) * i;
      const label = this.model.forecast_start && y >= this.model.forecast_start ? `${y}*` : `${y}`;
      ctx.fillText(label, x, height - pad + 18);
    });

    ctx.textAlign = "left";
    ctx.fillText("IKB (wynik łączny) • wyżej = mocniejszy", pad, pad - 16);

    ctx.restore();
  }

  handleIkbClick(e) {
    if (!this.ikbRegions.length) return;
    const rect = this.ikbCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const region = this.ikbRegions.find(r => {
      const dx = r.x - x;
      const dy = r.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= (r.r + 4);
    });

    if (region) this.selectSector(region.id);
  }
}

/* ============================================================
   Boot
   ============================================================ */

const dashboard = new PKODashboard();
dashboard.init();

/* Expose a tiny API for quick experiments in console:
   - PKODashboard.setSegment("core")
   - PKODashboard.setYearIndex(2)
   - PKODashboard.setMatrixMode("ikb")
   - PKODashboard.selectSector("C10") etc.
*/
window.PKODashboard = dashboard;
