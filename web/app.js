import { ALL_RULES, SEVERITY_LABEL, countWords, diffPrompts, lintPrompt, renderLint } from "./engine/web.js";
import { VERSION } from "./engine/version.js";
import { SAMPLES } from "./engine/samples.js";

const STORAGE_KEY = "noxaplus-promptlens:web";
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const RULE_TITLES = new Map(ALL_RULES.map(rule => [rule.id, rule.title]));
const RULE_META = new Map(ALL_RULES.map(rule => [rule.id, rule]));

const state = {
  theme: document.documentElement.dataset.theme,
  view: "lint",
  resultsTab: "findings",
  findingsFilter: "all",
  prompt: "",
  before: "",
  after: "",
  report: null,
  diff: null
};

const el = {};
let saveTimer = 0;
let lintTimer = 0;
let toastTimer = 0;
let clearArmTimer = 0;
let clearArmed = false;

function byId(id) {
  return document.getElementById(id);
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function wordCount(text) {
  return countWords(text);
}

function truncate(text, length) {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function signed(value) {
  if (value === 0) return "±0";
  return value > 0 ? `+${value}` : `${value}`;
}

function scoreColor(score) {
  if (score >= 90) return "var(--good)";
  if (score >= 70) return "var(--accent)";
  if (score >= 50) return "var(--warn)";
  return "var(--danger)";
}

function scoreLabel(score) {
  if (score >= 90) return "Ready to send";
  if (score >= 70) return "Almost there";
  if (score >= 50) return "Needs work";
  return "Missing a lot";
}

function severityLabel(severity) {
  return SEVERITY_LABEL[severity] ?? severity;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function writeStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      prompt: state.prompt,
      before: state.before,
      after: state.after,
      theme: state.theme
    }));
    setDraftStatus("Saved locally", "is-saved");
    window.setTimeout(() => setDraftStatus("Draft stays in this browser"), 1500);
  } catch (error) {
    setDraftStatus("Local saving unavailable", "is-error");
  }
}

function setDraftStatus(text, className = "") {
  el.draftStatus.textContent = text;
  el.draftStatus.className = `draft-status${className ? ` ${className}` : ""}`;
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(writeStore, 320);
}

function flushSave() {
  window.clearTimeout(saveTimer);
  writeStore();
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.toast.hidden = true;
  }, 2300);
}

function applyTheme(theme, persist = true) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  const isDark = state.theme === "dark";
  el.themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  el.themeToggle.setAttribute("aria-pressed", String(isDark));
  el.themeColorMeta.setAttribute("content", isDark ? "#080b10" : "#f4f5ef");
  if (persist) scheduleSave();
}

function setView(view, options = {}) {
  if (!["lint", "compare", "rules"].includes(view)) view = "lint";
  state.view = view;
  document.querySelectorAll(".view-tab").forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  ["lint", "compare", "rules"].forEach(name => {
    byId(`view-${name}`).hidden = name !== view;
  });
  if (options.focus) byId(`tab-${view}`).focus();
  if (options.updateHash !== false) {
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#${view}`);
    } catch (error) {
      /* file:// can reject replaceState in some browsers. */
    }
  }
  if (view === "compare" && state.diff) renderCompare(state.diff);
}

function setResultsTab(tab) {
  if (!["findings", "structure", "budget"].includes(tab)) tab = "findings";
  state.resultsTab = tab;
  document.querySelectorAll(".results-tab").forEach(button => {
    const active = button.dataset.panel === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  ["findings", "structure", "budget"].forEach(name => {
    byId(`panel-${name}`).hidden = name !== tab;
  });
}

function setFindingsFilter(filter) {
  state.findingsFilter = filter;
  document.querySelectorAll(".filter-button").forEach(button => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (state.report) renderFindings(state.report);
}

function updateEditorMeta() {
  const words = wordCount(state.prompt);
  const characters = state.prompt.length;
  el.editorMeta.textContent = `${plural(words, "word")} · ${plural(characters, "character")}`;
}

function updateCompareMeta() {
  el.beforeMeta.textContent = `${plural(wordCount(state.before), "word")}`;
  el.afterMeta.textContent = `${plural(wordCount(state.after), "word")}`;
}

function runLint(options = {}) {
  const text = state.prompt;
  updateEditorMeta();
  if (!text.trim()) {
    state.report = null;
    el.resultsEmpty.hidden = false;
    el.resultsContent.hidden = true;
    syncReportActions();
    return;
  }
  const report = lintPrompt(text, { version: VERSION });
  state.report = report;
  el.resultsEmpty.hidden = true;
  el.resultsContent.hidden = false;
  renderReport(report);
  if (options.scroll) {
    const target = document.querySelector(".results-panel");
    if (target && window.matchMedia("(max-width: 1180px)").matches) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function scheduleLint() {
  window.clearTimeout(lintTimer);
  lintTimer = window.setTimeout(() => runLint(), 220);
}

function syncReportActions() {
  const disabled = !state.report;
  el.copyReport.disabled = disabled;
  el.downloadReport.disabled = disabled;
}

function renderReport(report) {
  const score = report.score.total;
  const color = scoreColor(score);
  el.resultsContent.style.setProperty("--score-color", color);
  el.scoreValue.textContent = String(score);
  el.scoreGrade.textContent = report.score.grade;
  el.scoreLabel.textContent = scoreLabel(score);
  const present = report.structure.filter(section => section.present).length;
  el.scoreSummary.textContent = `${plural(report.findings.length, "finding")} · ${present} of ${report.structure.length} sections present`;

  el.scoreRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  el.scoreRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - score / 100));

  renderSeverityCounts(report);
  renderBreakdown(report);
  renderFindings(report);
  renderStructure(report);
  renderBudget(report);
  el.findingsCount.textContent = String(report.findings.length);
  syncReportActions();
}

function renderSeverityCounts(report) {
  el.severityCounts.replaceChildren();
  ["high", "medium", "low", "info"].forEach(severity => {
    const count = report.counts[severity] ?? 0;
    const chip = node("button", `count-chip sev-${severity}${count === 0 ? " is-quiet" : ""}`);
    chip.type = "button";
    chip.title = `Show ${severity} findings`;
    chip.append(node("span", "dot"), node("span", "", `${severityLabel(severity)} ${count}`));
    chip.addEventListener("click", () => {
      setResultsTab("findings");
      setFindingsFilter(severity);
    });
    el.severityCounts.append(chip);
  });
}

function renderBreakdown(report) {
  const rows = [
    ["Structure", report.score.structure, 50],
    ["Clarity", report.score.clarity, 25],
    ["Specificity", report.score.specificity, 15],
    ["Brevity", report.score.brevity, 10]
  ];
  el.scoreBreakdown.replaceChildren();
  rows.forEach(([label, value, max]) => {
    const row = node("div", "breakdown-row");
    const bar = node("div", "breakdown-bar");
    const fill = node("div", "breakdown-fill");
    fill.style.width = `${Math.round((value / max) * 100)}%`;
    bar.append(fill);
    row.append(
      node("span", "breakdown-label", label),
      bar,
      node("span", "breakdown-value", `${value}/${max}`)
    );
    el.scoreBreakdown.append(row);
  });
}

function renderFindings(report) {
  const filter = state.findingsFilter;
  const findings = filter === "all"
    ? report.findings
    : report.findings.filter(finding => finding.severity === filter);

  el.severityFilters.replaceChildren();
  const filters = [["all", "All", report.findings.length], ...["high", "medium", "low", "info"].map(severity => [severity, severityLabel(severity), report.counts[severity] ?? 0])];
  filters.forEach(([value, label, count]) => {
    const button = node("button", `filter-button${state.findingsFilter === value ? " is-active" : ""}`);
    button.type = "button";
    button.dataset.filter = value;
    button.setAttribute("aria-pressed", String(state.findingsFilter === value));
    button.append(document.createTextNode(`${label} `), node("span", "", String(count)));
    button.addEventListener("click", () => setFindingsFilter(value));
    el.severityFilters.append(button);
  });

  el.findingsList.replaceChildren();
  if (report.findings.length === 0) {
    const empty = node("div", "findings-empty");
    empty.append(node("span", "good-mark", "✓"), node("span", "", "No findings. This prompt covers the sections and wording a model needs."));
    el.findingsList.append(empty);
    return;
  }
  if (findings.length === 0) {
    el.findingsList.append(node("div", "findings-empty", `No ${filter} findings.`));
    return;
  }

  findings.forEach(finding => {
    const card = node("article", `finding sev-${finding.severity}`);
    const head = node("div", "finding-head");
    const title = node("h3", "", finding.title);
    if (finding.count > 1) title.append(node("span", "multiplier", ` ×${finding.count}`));
    head.append(
      node("span", "sev-pill", severityLabel(finding.severity)),
      title,
      node("span", "finding-meta", `${finding.ruleId} · line ${finding.line}`)
    );
    card.append(head, node("p", "finding-message", finding.message));
    const suggestion = node("p", "finding-suggestion");
    suggestion.append(node("span", "", "Fix"), document.createTextNode(finding.suggestion));
    card.append(suggestion);
    if (finding.excerpt) card.append(node("code", "finding-excerpt", finding.excerpt));
    el.findingsList.append(card);
  });
}

function renderStructure(report) {
  el.structureList.replaceChildren();
  report.structure.forEach(section => {
    const row = node("li", `structure-row${section.present ? " is-present" : ""}`);
    const check = node("span", "structure-check", section.present ? "✓" : "");
    const body = node("div", "");
    body.append(node("div", "structure-label", section.label));
    body.append(node("div", "structure-evidence", section.present
      ? truncate(section.evidence || "Detected", 120)
      : "No section detected"));
    row.append(check, body, node("span", "structure-weight", `${section.weight} pts`));
    el.structureList.append(row);
  });
}

function renderBudget(report) {
  const stats = report.stats;
  const tiles = [
    ["Words", String(stats.words)],
    ["Est. tokens", stats.tokens.toLocaleString("en-US")],
    ["Lines", String(stats.lines)],
    ["Sentences", String(stats.sentences)],
    ["Avg words / sentence", String(stats.averageWordsPerSentence)],
    ["Long lines", String(stats.longLines)]
  ];
  el.statGrid.replaceChildren();
  tiles.forEach(([label, value]) => {
    const tile = node("dl", "stat-tile");
    tile.append(node("dt", "", label), node("dd", "", value));
    el.statGrid.append(tile);
  });

  el.contextUsage.replaceChildren();
  report.contextUsage.forEach(entry => {
    const row = node("div", "context-row");
    const label = entry.window >= 1000 ? `${entry.window / 1000}k` : String(entry.window);
    const track = node("div", "context-track");
    const fill = node("div", "context-fill");
    fill.style.width = `${Math.min(100, Math.max(entry.percent > 0 ? 1.5 : 0, entry.percent))}%`;
    track.append(fill);
    row.append(
      node("span", "context-window", label),
      track,
      node("span", "context-percent", `${entry.percent}%`)
    );
    el.contextUsage.append(row);
  });
}

function loadPrompt(text) {
  state.prompt = text;
  el.promptEditor.value = text;
  runLint();
  scheduleSave();
}

function runCompare(options = {}) {
  updateCompareMeta();
  if (!state.before.trim() || !state.after.trim()) {
    state.diff = null;
    el.compareEmpty.hidden = false;
    el.compareContent.hidden = true;
    el.compareStale.hidden = true;
    return;
  }
  const diff = diffPrompts(state.before, state.after, { version: VERSION });
  state.diff = diff;
  el.compareEmpty.hidden = true;
  el.compareContent.hidden = false;
  el.compareStale.hidden = true;
  renderCompare(diff);
  if (options.scroll && window.matchMedia("(max-width: 1180px)").matches) {
    el.compareContent.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderCompare(diff) {
  const before = diff.before.score;
  const after = diff.after.score;
  el.beforeScore.textContent = String(before.total);
  el.beforeGrade.textContent = before.grade;
  el.beforeDetail.textContent = plural(diff.before.findings.length, "finding");
  el.afterScore.textContent = String(after.total);
  el.afterGrade.textContent = after.grade;
  el.afterDetail.textContent = plural(diff.after.findings.length, "finding");

  el.scoreDelta.textContent = signed(diff.delta.score);
  el.scoreDelta.className = diff.delta.score > 0 ? "up" : diff.delta.score < 0 ? "down" : "";
  el.tokenDelta.textContent = `tokens ${signed(diff.delta.tokens)} · words ${signed(diff.delta.words)}`;
  el.diffStats.textContent = `+${diff.delta.added} / −${diff.delta.removed} lines`;

  const verdict = diff.verdict.charAt(0).toUpperCase() + diff.verdict.slice(1);
  el.compareVerdict.textContent = `${verdict}.`;

  el.compareFacts.replaceChildren();
  const groups = [
    ["Sections gained", diff.sectionsGained, "is-good"],
    ["Sections lost", diff.sectionsLost, "is-bad"],
    ["Resolved findings", diff.resolved, "is-good"],
    ["New findings", diff.introduced, "is-bad"]
  ];
  groups.forEach(([title, ids, tone]) => {
    const group = node("div", "fact-group");
    group.append(node("h3", "", title));
    if (!ids.length) {
      group.append(node("p", "fact-empty", "None"));
    } else {
      const list = node("ul");
      ids.forEach(id => {
        const titleText = RULE_TITLES.get(id) || id.replace(/-/g, " ");
        const item = node("li", tone, titleText);
        item.title = id;
        list.append(item);
      });
      group.append(list);
    }
    el.compareFacts.append(group);
  });

  el.diffList.replaceChildren();
  el.diffCount.textContent = plural(diff.lines.length, "line");
  if (!diff.lines.length) {
    el.diffList.append(node("li", "diff-empty", "Both prompts are identical."));
    return;
  }
  const fragment = document.createDocumentFragment();
  diff.lines.forEach(line => {
    const row = node("li", `diff-line is-${line.type}`);
    row.append(
      node("span", "diff-num", line.beforeLine ? String(line.beforeLine) : ""),
      node("span", "diff-num", line.afterLine ? String(line.afterLine) : ""),
      node("span", "diff-text", line.text || " ")
    );
    fragment.append(row);
  });
  el.diffList.append(fragment);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (copyError) {
      copied = false;
    }
    helper.remove();
    return copied;
  }
}

function downloadReport() {
  if (!state.report) return;
  const blob = new Blob([`${JSON.stringify(state.report, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `promptlens-report-${state.report.score.total}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("JSON report downloaded");
}

function renderRules(query = "") {
  const needle = query.trim().toLowerCase();
  const rules = ALL_RULES.filter(rule => {
    if (!needle) return true;
    return `${rule.id} ${rule.title} ${rule.description} ${rule.severity}`.toLowerCase().includes(needle);
  });
  el.rulesGrid.replaceChildren();
  if (!rules.length) {
    el.rulesGrid.append(node("p", "rules-empty", `No rules match “${query.trim()}”.`));
  } else {
    rules.forEach(rule => {
      const card = node("article", `rule-card sev-${rule.severity}`);
      const head = node("div", "rule-card-head");
      const copy = node("div", "");
      copy.append(
        node("span", "sev-pill", severityLabel(rule.severity)),
        node("h3", "", rule.title)
      );
      head.append(copy, node("span", "rule-id", rule.id));
      card.append(head, node("p", "", rule.description));
      el.rulesGrid.append(card);
    });
  }
  el.rulesCount.textContent = needle ? `${rules.length} of ${ALL_RULES.length} rules` : `${ALL_RULES.length} rules`;
}

function clearLocalData() {
  if (!clearArmed) {
    clearArmed = true;
    el.clearLocal.textContent = "Click again to clear";
    window.clearTimeout(clearArmTimer);
    clearArmTimer = window.setTimeout(() => {
      clearArmed = false;
      el.clearLocal.textContent = "Clear local draft";
    }, 4000);
    return;
  }
  clearArmed = false;
  window.clearTimeout(clearArmTimer);
  el.clearLocal.textContent = "Clear local draft";
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    /* Nothing to clear. */
  }
  state.prompt = SAMPLES.vague;
  state.before = SAMPLES.vague;
  state.after = SAMPLES.structured;
  el.promptEditor.value = state.prompt;
  el.beforeEditor.value = state.before;
  el.afterEditor.value = state.after;
  runLint();
  runCompare();
  setDraftStatus("Local draft cleared");
  showToast("Local draft cleared");
}

function bindEvents() {
  el.promptEditor.addEventListener("input", () => {
    state.prompt = el.promptEditor.value;
    updateEditorMeta();
    scheduleLint();
    scheduleSave();
  });
  el.beforeEditor.addEventListener("input", () => {
    state.before = el.beforeEditor.value;
    updateCompareMeta();
    if (state.diff) el.compareStale.hidden = false;
    scheduleSave();
  });
  el.afterEditor.addEventListener("input", () => {
    state.after = el.afterEditor.value;
    updateCompareMeta();
    if (state.diff) el.compareStale.hidden = false;
    scheduleSave();
  });

  el.sampleVague.addEventListener("click", () => {
    loadPrompt(SAMPLES.vague);
    showToast("Vague example loaded");
  });
  el.sampleStructured.addEventListener("click", () => {
    loadPrompt(SAMPLES.structured);
    showToast("Structured example loaded");
  });
  el.emptySampleButton.addEventListener("click", () => {
    loadPrompt(SAMPLES.vague);
    showToast("Vague example loaded");
  });
  el.clearPrompt.addEventListener("click", () => {
    loadPrompt("");
    el.promptEditor.focus();
  });
  el.analyzeButton.addEventListener("click", () => runLint({ scroll: true }));
  el.copyReport.addEventListener("click", async () => {
    if (!state.report) return;
    const copied = await copyText(renderLint(state.report, { color: false }));
    showToast(copied ? "Report copied as plain text" : "Copy failed — select the report manually");
  });
  el.downloadReport.addEventListener("click", downloadReport);

  el.compareButton.addEventListener("click", () => runCompare({ scroll: true }));
  el.compareSample.addEventListener("click", () => {
    state.before = SAMPLES.vague;
    state.after = SAMPLES.structured;
    el.beforeEditor.value = state.before;
    el.afterEditor.value = state.after;
    runCompare({ scroll: true });
    scheduleSave();
    showToast("Example pair loaded");
  });

  document.querySelectorAll(".view-tab").forEach(tab => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
    tab.addEventListener("keydown", event => {
      const tabs = [...document.querySelectorAll(".view-tab")];
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        setView(next.dataset.view, { focus: true });
      }
    });
  });

  document.querySelectorAll(".results-tab").forEach(tab => {
    tab.addEventListener("click", () => setResultsTab(tab.dataset.panel));
    tab.addEventListener("keydown", event => {
      const tabs = [...document.querySelectorAll(".results-tab")];
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        setResultsTab(next.dataset.panel);
        next.focus();
      }
    });
  });

  el.ruleSearch.addEventListener("input", () => renderRules(el.ruleSearch.value));

  el.themeToggle.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });

  el.clearLocal.addEventListener("click", clearLocalData);

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (state.view === "compare") runCompare({ scroll: true });
      else if (state.view === "lint") runLint({ scroll: true });
    }
  });

  window.addEventListener("pagehide", () => {
    if (saveTimer) flushSave();
  });
}

function init() {
  Object.assign(el, {
    themeToggle: byId("themeToggle"),
    themeColorMeta: byId("themeColorMeta"),
    versionLabel: byId("versionLabel"),
    draftStatus: byId("draftStatus"),
    promptEditor: byId("promptEditor"),
    editorMeta: byId("editorMeta"),
    analyzeButton: byId("analyzeButton"),
    sampleVague: byId("sampleVague"),
    sampleStructured: byId("sampleStructured"),
    emptySampleButton: byId("emptySampleButton"),
    clearPrompt: byId("clearPrompt"),
    resultsEmpty: byId("resultsEmpty"),
    resultsContent: byId("resultsContent"),
    scoreRing: byId("scoreRing"),
    scoreValue: byId("scoreValue"),
    scoreGrade: byId("scoreGrade"),
    scoreLabel: byId("scoreLabel"),
    scoreSummary: byId("scoreSummary"),
    severityCounts: byId("severityCounts"),
    scoreBreakdown: byId("scoreBreakdown"),
    findingsCount: byId("findingsCount"),
    severityFilters: byId("severityFilters"),
    findingsList: byId("findingsList"),
    structureList: byId("structureList"),
    statGrid: byId("statGrid"),
    contextUsage: byId("contextUsage"),
    copyReport: byId("copyReport"),
    downloadReport: byId("downloadReport"),
    beforeEditor: byId("beforeEditor"),
    afterEditor: byId("afterEditor"),
    beforeMeta: byId("beforeMeta"),
    afterMeta: byId("afterMeta"),
    compareButton: byId("compareButton"),
    compareSample: byId("compareSample"),
    compareEmpty: byId("compareEmpty"),
    compareContent: byId("compareContent"),
    compareStale: byId("compareStale"),
    beforeScore: byId("beforeScore"),
    beforeGrade: byId("beforeGrade"),
    beforeDetail: byId("beforeDetail"),
    afterScore: byId("afterScore"),
    afterGrade: byId("afterGrade"),
    afterDetail: byId("afterDetail"),
    scoreDelta: byId("scoreDelta"),
    tokenDelta: byId("tokenDelta"),
    diffStats: byId("diffStats"),
    compareVerdict: byId("compareVerdict"),
    compareFacts: byId("compareFacts"),
    diffList: byId("diffList"),
    diffCount: byId("diffCount"),
    ruleSearch: byId("ruleSearch"),
    rulesGrid: byId("rulesGrid"),
    rulesCount: byId("rulesCount"),
    toast: byId("toast"),
    clearLocal: byId("clearLocal")
  });

  el.versionLabel.textContent = VERSION;
  const rulesTabCount = document.querySelector("#tab-rules .tab-count");
  if (rulesTabCount) rulesTabCount.textContent = String(ALL_RULES.length);
  applyTheme(state.theme, false);

  const stored = readStore();
  if (stored) {
    if (typeof stored.prompt === "string") state.prompt = stored.prompt;
    if (typeof stored.before === "string") state.before = stored.before;
    if (typeof stored.after === "string") state.after = stored.after;
  } else {
    state.prompt = SAMPLES.vague;
    state.before = SAMPLES.vague;
    state.after = SAMPLES.structured;
  }

  el.promptEditor.value = state.prompt;
  el.beforeEditor.value = state.before;
  el.afterEditor.value = state.after;
  updateEditorMeta();
  updateCompareMeta();

  bindEvents();
  renderRules();

  const hash = location.hash.replace("#", "");
  setView(["lint", "compare", "rules"].includes(hash) ? hash : "lint", { updateHash: false });
  setResultsTab("findings");

  runLint();
  runCompare();
  if (!stored) writeStore();
  document.documentElement.dataset.appReady = "true";
  const fallback = byId("loadFallback");
  if (fallback) fallback.hidden = true;
}

init();
