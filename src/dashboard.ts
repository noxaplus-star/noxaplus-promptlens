export function renderDashboard(version: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>NoxaPlus PromptLens</title>
<meta name="description" content="A deterministic prompt linter by NoxaPlus: structure, ambiguity, token budget, and version comparison. Runs locally." />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23b6f36a'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%23080b10' stroke-width='3'/%3E%3Cpath d='M16 9v14M9 16h14' stroke='%23080b10' stroke-width='1.6' opacity='.5'/%3E%3C/svg%3E" />
<style>
  :root {
    --bg: #080b10;
    --panel: #0f141c;
    --panel-2: #131a25;
    --line: #1e2836;
    --line-soft: #18212d;
    --text: #e7edf4;
    --muted: #8b9aae;
    --faint: #5c6b80;
    --accent: #b6f36a;
    --accent-2: #7dd3fc;
    --good: #7ee787;
    --warn: #ffc266;
    --danger: #ff6b81;
    --radius: 16px;
    --mono: ui-monospace, "Cascadia Code", "SFMono-Regular", Menlo, Consolas, monospace;
    --sans: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { min-height: 100%; }
  body {
    margin: 0;
    color: var(--text);
    font-family: var(--sans);
    background:
      radial-gradient(1100px 620px at 8% -12%, rgba(90, 140, 40, 0.22), transparent 58%),
      radial-gradient(900px 560px at 100% 0%, rgba(20, 74, 100, 0.22), transparent 55%),
      var(--bg);
    -webkit-font-smoothing: antialiased;
  }
  button { font: inherit; color: inherit; cursor: pointer; }
  .shell { max-width: 1460px; margin: 0 auto; padding: 26px 30px 46px; }
  header {
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    padding: 4px 2px 20px; border-bottom: 1px solid var(--line); margin-bottom: 24px;
  }
  .brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
  .mark {
    width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center;
    color: #081006; background: linear-gradient(135deg, #d8ff9a, var(--accent) 55%, #6bc457);
    box-shadow: 0 0 0 1px rgba(216, 255, 154, 0.7) inset, 0 14px 34px -16px rgba(182, 243, 106, 0.8);
    flex: none;
  }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: -0.025em; font-weight: 680; }
  .brand p { margin: 2px 0 0; color: var(--muted); font-size: 11.5px; letter-spacing: 0.16em; text-transform: uppercase; }
  .tabs { display: flex; gap: 4px; padding: 4px; background: var(--panel); border: 1px solid var(--line); border-radius: 999px; }
  .tabs button {
    border: 0; background: transparent; color: var(--muted); padding: 8px 18px; border-radius: 999px;
    font-size: 13px; font-weight: 600; transition: color .15s ease, background .15s ease;
  }
  .tabs button:hover { color: var(--text); }
  .tabs button.active { background: var(--accent); color: #0a1206; }
  .version {
    font-family: var(--mono); font-size: 11.5px; color: var(--muted); border: 1px solid var(--line);
    padding: 7px 12px; border-radius: 999px; background: rgba(15, 20, 28, 0.7);
  }
  .view { display: none; }
  .view.active { display: block; animation: rise .28s ease both; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .workspace { display: grid; grid-template-columns: minmax(0, 1.03fr) minmax(0, 0.97fr); gap: 18px; align-items: stretch; }
  .column { display: flex; flex-direction: column; }
  .column > .panel { flex: 1; display: flex; flex-direction: column; }
  .column > .panel .editor { flex: 1; height: auto; min-height: 590px; }
  .panel {
    background: linear-gradient(180deg, rgba(19, 26, 37, 0.97), rgba(12, 17, 24, 0.97));
    border: 1px solid var(--line); border-radius: var(--radius);
    box-shadow: 0 26px 60px -44px #000;
  }
  .panel-head {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 13px 16px; border-bottom: 1px solid var(--line);
  }
  .panel-title { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); font-weight: 650; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .actions button {
    border: 1px solid var(--line); background: #0c121a; color: var(--muted);
    padding: 6px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 600; transition: .15s ease;
  }
  .actions button:hover { color: var(--text); border-color: #2c3a4d; background: #111925; }
  .actions button.primary { color: #0a1206; background: var(--accent); border-color: var(--accent); }
  .actions button.primary:hover { filter: brightness(1.06); }
  .editor { display: grid; grid-template-columns: 52px minmax(0, 1fr); height: 590px; }
  .gutter {
    padding: 16px 10px; text-align: right; color: #4f6076; font-family: var(--mono); font-size: 13px;
    line-height: 1.66; border-right: 1px solid var(--line); white-space: pre; overflow: hidden; user-select: none;
  }
  .editor textarea {
    width: 100%; height: 100%; resize: none; border: 0; outline: 0; background: transparent;
    color: #dae6f2; padding: 16px 18px; font-family: var(--mono); font-size: 13.5px; line-height: 1.66;
    tab-size: 2; caret-color: var(--accent);
  }
  .editor textarea::placeholder { color: #46566b; }
  .editor-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 10px 16px; border-top: 1px solid var(--line); color: var(--faint); font-size: 11px;
  }
  .report-column { display: grid; gap: 14px; }
  .score-panel { padding: 18px 20px 16px; display: grid; grid-template-columns: 156px minmax(0, 1fr); gap: 22px; align-items: center; }
  .ring {
    --p: 0; --ring: var(--accent);
    width: 156px; height: 156px; border-radius: 50%;
    background: conic-gradient(var(--ring) calc(var(--p) * 1%), #18212e 0);
    display: grid; place-items: center; position: relative; transition: background .35s ease;
  }
  .ring::after {
    content: ""; position: absolute; inset: 12px; border-radius: 50%;
    background: #0c121a; border: 1px solid var(--line);
  }
  .ring-inner { position: relative; z-index: 1; text-align: center; }
  .score-num { font-size: 44px; line-height: 0.95; font-weight: 740; letter-spacing: -0.05em; }
  .score-den { font-size: 10.5px; color: var(--muted); letter-spacing: 0.14em; text-transform: uppercase; margin-top: 6px; }
  .grade { font-family: var(--mono); font-size: 11.5px; color: var(--accent); margin-top: 7px; letter-spacing: 0.08em; }
  .score-copy h2 { margin: 0 0 3px; font-size: 19px; letter-spacing: -0.02em; font-weight: 650; }
  .score-copy .sub { margin: 0 0 13px; color: var(--muted); font-size: 12px; }
  .bars { display: grid; gap: 8px; }
  .bar-row { display: grid; grid-template-columns: 78px minmax(0, 1fr) 46px; gap: 10px; align-items: center; font-size: 11.5px; color: var(--muted); }
  .bar { height: 6px; border-radius: 999px; background: #19212e; overflow: hidden; }
  .bar span { display: block; height: 100%; width: 0; border-radius: 999px; background: linear-gradient(90deg, #7ee787, var(--accent)); transition: width .38s ease; }
  .bar-row b { text-align: right; font-family: var(--mono); font-size: 10.5px; color: var(--text); font-weight: 600; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 14px; }
  .stat { background: #0b1118; border: 1px solid var(--line-soft); border-radius: 10px; padding: 8px 9px; }
  .stat b { display: block; font-family: var(--mono); font-size: 14px; font-weight: 600; letter-spacing: -0.02em; }
  .stat span { display: block; margin-top: 2px; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }
  .token-note { margin: 9px 0 0; font-size: 10.5px; color: var(--faint); }
  .context { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
  .context span {
    font-family: var(--mono); font-size: 10.5px; color: var(--muted);
    border: 1px solid var(--line-soft); background: #0b1118; border-radius: 999px; padding: 3px 8px;
  }
  .structure-panel, .findings-panel { padding: 15px 16px 16px; }
  .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; }
  .section-head h3 { margin: 0; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); font-weight: 650; }
  .section-head .hint { font-size: 10.5px; color: var(--faint); }
  .structure-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .section-chip {
    display: flex; align-items: center; gap: 8px; border: 1px solid var(--line-soft); border-radius: 9px;
    padding: 8px 10px; background: #0b1118; font-size: 11.5px; color: #97a6b9; overflow: hidden;
  }
  .section-chip .icon { width: 16px; height: 16px; border-radius: 5px; display: grid; place-items: center; font-size: 10px; flex: none; background: #161f2b; color: #5e7088; }
  .section-chip.present { border-color: #2b4a2c; background: #0d1a12; color: #cde7d1; }
  .section-chip.present .icon { background: #1b3a21; color: var(--good); }
  .section-chip em { margin-left: auto; font-style: normal; font-family: var(--mono); font-size: 9.5px; color: var(--faint); }
  .findings-list { display: grid; gap: 8px; }
  .finding { border: 1px solid var(--line-soft); border-left: 3px solid var(--sev, var(--muted)); border-radius: 10px; padding: 11px 13px; background: #0b1118; }
  .finding.sev-high { --sev: var(--danger); }
  .finding.sev-medium { --sev: #d78bfa; }
  .finding.sev-low { --sev: var(--warn); }
  .finding.sev-info { --sev: var(--accent-2); }
  .finding-top { display: flex; align-items: center; gap: 8px; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }
  .pill { border-radius: 999px; padding: 2px 7px; font-weight: 700; color: #0b0f14; background: var(--sev); letter-spacing: 0.08em; }
  .finding-top .rule { font-family: var(--mono); letter-spacing: 0; color: #6c7d93; text-transform: none; }
  .finding-top .line { margin-left: auto; font-family: var(--mono); letter-spacing: 0; }
  .finding h4 { margin: 7px 0 4px; font-size: 13px; font-weight: 640; letter-spacing: -0.01em; }
  .finding p { margin: 0; color: #a3b2c5; font-size: 11.5px; line-height: 1.55; }
  .finding blockquote { margin: 7px 0 0; padding: 7px 9px; border-radius: 7px; background: #0e151f; color: #7e90a7; font-family: var(--mono); font-size: 10.5px; white-space: pre-wrap; word-break: break-word; }
  .finding .fix { color: #b6f36a; margin-top: 7px; font-size: 11px; }
  .finding .fix b { color: #d8ff9a; font-weight: 650; }
  .success-card { border: 1px solid #2b4a2c; background: #0d1a12; border-radius: 10px; padding: 14px; color: #bfe4c5; font-size: 12px; }
  .empty-state { padding: 46px 24px; text-align: center; color: var(--faint); }
  .empty-state .glyph { width: 54px; height: 54px; margin: 0 auto 12px; border-radius: 16px; border: 1px dashed #2a3647; display: grid; place-items: center; color: #4f6076; }
  .empty-state h3 { margin: 0 0 5px; color: #9cabbd; font-size: 14px; font-weight: 600; }
  .empty-state p { margin: 0 auto; max-width: 300px; font-size: 11.5px; line-height: 1.6; }
  .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
  .compare-panel .editor { grid-template-columns: minmax(0, 1fr); height: 330px; }
  .compare-panel .panel-head .score-tag { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .diff-panel { overflow: hidden; }
  .diff-head { padding: 15px 16px; border-bottom: 1px solid var(--line); }
  .verdict { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
  .verdict .good { color: var(--good); }
  .verdict .bad { color: var(--danger); }
  .verdict .same { color: var(--muted); }
  .delta-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
  .delta { background: #0b1118; border: 1px solid var(--line-soft); border-radius: 10px; padding: 9px 11px; }
  .delta b { display: block; font-family: var(--mono); font-size: 16px; font-weight: 650; }
  .delta span { display: block; margin-top: 2px; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
  .tag { border-radius: 999px; padding: 3px 9px; font-size: 10.5px; border: 1px solid var(--line); color: var(--muted); font-family: var(--mono); }
  .tag.good { border-color: #2b4a2c; color: #a9e5b2; background: #0d1a12; }
  .tag.bad { border-color: #4a2b31; color: #ffb4bf; background: #1a0d11; }
  .diff-lines { max-height: 470px; overflow: auto; font-family: var(--mono); font-size: 11.5px; line-height: 1.62; padding: 7px 0; }
  .diff-row { display: grid; grid-template-columns: 42px 42px 20px minmax(0, 1fr); gap: 6px; padding: 1px 14px; white-space: pre-wrap; word-break: break-word; }
  .diff-row > span:first-child, .diff-row > span:nth-child(2) { color: #435263; text-align: right; user-select: none; }
  .diff-row.same { color: #74859b; }
  .diff-row.add { background: rgba(126, 231, 135, 0.07); color: #baf7c2; }
  .diff-row.remove { background: rgba(255, 107, 129, 0.07); color: #ffb6c0; }
  .diff-row .sign { color: #5a6a80; }
  .diff-row.add .sign { color: var(--good); }
  .diff-row.remove .sign { color: var(--danger); }
  footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 30px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--faint); font-size: 11px; }
  footer a { color: var(--muted); text-decoration: none; }
  footer a:hover { color: var(--accent); }
  .loading { opacity: 0.55; transition: opacity .15s ease; }
  @media (max-width: 1060px) {
    .workspace, .compare-grid { grid-template-columns: 1fr; }
    .score-panel { grid-template-columns: 140px minmax(0, 1fr); }
    .ring { width: 140px; height: 140px; }
    .editor { height: 430px; }
    .column > .panel .editor { min-height: 430px; }
  }
  @media (max-width: 720px) {
    .shell { padding: 18px 16px 30px; }
    header { flex-wrap: wrap; }
    .version { display: none; }
    .score-panel { grid-template-columns: 1fr; justify-items: start; }
    .stats { grid-template-columns: 1fr 1fr; }
    .structure-grid { grid-template-columns: 1fr; }
    .delta-cards { grid-template-columns: 1fr 1fr; }
    footer { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body>
<div class="shell">
  <header>
    <div class="brand">
      <div class="mark" aria-hidden="true">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <circle cx="10.6" cy="10.6" r="6.6"></circle>
          <path d="M19.6 19.6l-3.6-3.6"></path>
        </svg>
      </div>
      <div>
        <h1>PromptLens</h1>
        <p>by NoxaPlus</p>
      </div>
    </div>
    <nav class="tabs" aria-label="Views">
      <button type="button" data-tab="lint" class="active">Lint</button>
      <button type="button" data-tab="compare">Compare</button>
    </nav>
    <div class="version">v${version}</div>
  </header>

  <main>
    <section id="lint-view" class="view active">
      <div class="workspace">
        <div class="column">
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">Prompt</span>
              <div class="actions">
                <button type="button" id="load-v1">Sample v1</button>
                <button type="button" id="load-v2">Sample v2</button>
                <button type="button" id="copy-report">Copy report</button>
                <button type="button" id="clear-prompt">Clear</button>
              </div>
            </div>
            <div class="editor">
              <div class="gutter" id="gutter" aria-hidden="true">1</div>
              <textarea id="prompt" spellcheck="false" aria-label="Prompt text" placeholder="Paste a prompt here. It never leaves this machine."></textarea>
            </div>
            <div class="editor-foot">
              <span id="char-count">0 characters</span>
              <span>Ctrl / Cmd + Enter to analyze</span>
            </div>
          </div>
        </div>

        <div class="report-column">
          <div class="panel score-panel" id="score-panel">
            <div class="ring" id="ring">
              <div class="ring-inner">
                <div class="score-num" id="score-num">—</div>
                <div class="score-den">out of 100</div>
                <div class="grade" id="grade">No score yet</div>
              </div>
            </div>
            <div class="score-copy">
              <h2 id="score-title">Waiting for a prompt</h2>
              <p class="sub" id="score-sub">Structure, ambiguity, specificity, and brevity, scored deterministically.</p>
              <div class="bars">
                <div class="bar-row"><span>Structure</span><div class="bar"><span id="bar-structure"></span></div><b id="val-structure">0/50</b></div>
                <div class="bar-row"><span>Clarity</span><div class="bar"><span id="bar-clarity"></span></div><b id="val-clarity">0/25</b></div>
                <div class="bar-row"><span>Specificity</span><div class="bar"><span id="bar-specificity"></span></div><b id="val-specificity">0/15</b></div>
                <div class="bar-row"><span>Brevity</span><div class="bar"><span id="bar-brevity"></span></div><b id="val-brevity">0/10</b></div>
              </div>
              <div class="stats">
                <div class="stat"><b id="stat-words">0</b><span>words</span></div>
                <div class="stat"><b id="stat-tokens">0</b><span>est. tokens</span></div>
                <div class="stat"><b id="stat-lines">0</b><span>lines</span></div>
                <div class="stat"><b id="stat-sentences">0</b><span>sentences</span></div>
              </div>
              <p class="token-note">Token counts are approximate and meant for budgeting, not billing.</p>
              <div class="context" id="context-chips"></div>
            </div>
          </div>

          <div class="panel structure-panel">
            <div class="section-head">
              <h3>Structure</h3>
              <span class="hint" id="structure-hint">0 of 7 sections</span>
            </div>
            <div class="structure-grid" id="structure-grid">
              <div class="section-chip"><span class="icon">·</span><span>Role</span><em>6</em></div>
              <div class="section-chip"><span class="icon">·</span><span>Objective</span><em>12</em></div>
              <div class="section-chip"><span class="icon">·</span><span>Context</span><em>8</em></div>
              <div class="section-chip"><span class="icon">·</span><span>Constraints</span><em>9</em></div>
              <div class="section-chip"><span class="icon">·</span><span>Output format</span><em>9</em></div>
              <div class="section-chip"><span class="icon">·</span><span>Examples</span><em>3</em></div>
              <div class="section-chip"><span class="icon">·</span><span>Tone and audience</span><em>3</em></div>
            </div>
          </div>

          <div class="panel findings-panel">
            <div class="section-head">
              <h3>Findings</h3>
              <span class="hint" id="findings-hint">Nothing analyzed yet</span>
            </div>
            <div class="findings-list" id="findings-list">
              <div class="empty-state">
                <div class="glyph">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                    <path d="M4 7h16M4 12h10M4 17h13"></path>
                  </svg>
                </div>
                <h3>Paste a prompt to see the lens</h3>
                <p>PromptLens checks structure, vague wording, placeholders, duplication, and token weight. Nothing is sent anywhere.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="compare-view" class="view">
      <div class="compare-grid">
        <div class="panel compare-panel">
          <div class="panel-head">
            <span class="panel-title">Before</span>
            <span class="score-tag" id="before-tag">no score</span>
          </div>
          <div class="editor"><textarea id="before" spellcheck="false" aria-label="Before prompt"></textarea></div>
        </div>
        <div class="panel compare-panel">
          <div class="panel-head">
            <span class="panel-title">After</span>
            <span class="score-tag" id="after-tag">no score</span>
          </div>
          <div class="editor"><textarea id="after" spellcheck="false" aria-label="After prompt"></textarea></div>
        </div>
      </div>

      <div class="panel diff-panel">
        <div class="diff-head">
          <div class="actions" style="margin-bottom: 12px;">
            <button type="button" id="load-pair" class="primary">Load sample pair</button>
            <button type="button" id="run-diff">Compare now</button>
          </div>
          <p class="verdict" id="diff-verdict">Load two versions to see what changed in score, tokens, structure, and findings.</p>
          <div class="delta-cards">
            <div class="delta"><b id="delta-score">—</b><span>score</span></div>
            <div class="delta"><b id="delta-tokens">—</b><span>est. tokens</span></div>
            <div class="delta"><b id="delta-added">—</b><span>lines added</span></div>
            <div class="delta"><b id="delta-removed">—</b><span>lines removed</span></div>
          </div>
          <div class="tags" id="diff-tags"></div>
        </div>
        <div class="diff-lines" id="diff-lines">
          <div class="empty-state"><p>The line-by-line view appears here, with added and removed lines marked.</p></div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <span>Deterministic heuristics. No model calls, no uploads, no telemetry.</span>
    <span><a href="https://github.com/noxaplus-star/noxaplus-promptlens" target="_blank" rel="noreferrer">GitHub</a> · MIT © 2026 NoxaPlus</span>
  </footer>
</div>

<script>
(function () {
  'use strict';

  var state = { report: null, samples: null, timer: null, controller: null, diffController: null, tab: 'lint' };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function pct(value, maximum) {
    if (maximum <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((value / maximum) * 100)));
  }

  function number(value) { return value.toLocaleString('en-US'); }

  function scoreLabel(score) {
    if (score >= 90) return 'Ready to ship';
    if (score >= 80) return 'Strong draft';
    if (score >= 70) return 'Needs one pass';
    if (score >= 60) return 'Do another pass';
    return 'Rewrite the draft';
  }

  function ringColor(score) {
    if (score >= 80) return 'var(--good)';
    if (score >= 60) return 'var(--warn)';
    return 'var(--danger)';
  }

  function setBar(name, value, maximum) {
    $('bar-' + name).style.width = pct(value, maximum) + '%';
    $('val-' + name).textContent = value + '/' + maximum;
  }

  function syncEditor() {
    var prompt = $('prompt');
    var lines = prompt.value.split('\\n');
    var numbers = [];
    for (var index = 0; index < lines.length; index += 1) numbers.push(index + 1);
    $('gutter').textContent = numbers.join('\\n');
    $('gutter').scrollTop = prompt.scrollTop;
    $('char-count').textContent = number(prompt.value.length) + ' characters · ' + number(lines.length) + ' lines';
  }

  function renderReport(report) {
    state.report = report;
    var score = report.score;
    $('ring').style.setProperty('--p', score.total);
    $('ring').style.setProperty('--ring', ringColor(score.total));
    $('score-num').textContent = score.total;
    $('grade').textContent = 'Grade ' + score.grade;
    $('score-title').textContent = scoreLabel(score.total);

    var parts = [];
    ['high', 'medium', 'low', 'info'].forEach(function (severity) {
      if (report.counts[severity] > 0) parts.push(report.counts[severity] + ' ' + severity);
    });
    $('score-sub').textContent = parts.length ? parts.join(' · ') + ' finding' + (report.findings.length === 1 ? '' : 's') : 'No findings at all. The draft is doing the basics right.';

    setBar('structure', score.structure, 50);
    setBar('clarity', score.clarity, 25);
    setBar('specificity', score.specificity, 15);
    setBar('brevity', score.brevity, 10);

    $('stat-words').textContent = number(report.stats.words);
    $('stat-tokens').textContent = number(report.stats.tokens);
    $('stat-lines').textContent = number(report.stats.lines);
    $('stat-sentences').textContent = number(report.stats.sentences);

    $('context-chips').innerHTML = report.contextUsage.map(function (usage) {
      return '<span>' + (usage.window / 1000) + 'k · ' + usage.percent + '%</span>';
    }).join('');

    var present = report.structure.filter(function (section) { return section.present; }).length;
    $('structure-hint').textContent = present + ' of ' + report.structure.length + ' sections';

    $('structure-grid').innerHTML = report.structure.map(function (section) {
      var evidence = section.evidence ? ' title="' + esc(section.evidence) + '"' : '';
      return '<div class="section-chip ' + (section.present ? 'present' : '') + '"' + evidence + '>' +
        '<span class="icon">' + (section.present ? '✓' : '·') + '</span>' +
        '<span>' + esc(section.label) + '</span><em>' + section.weight + '</em></div>';
    }).join('');

    $('findings-hint').textContent = report.findings.length === 0 ? 'Clean' : report.findings.length + ' item' + (report.findings.length === 1 ? '' : 's');
    if (report.findings.length === 0) {
      $('findings-list').innerHTML = '<div class="success-card">No findings. Every section is present, and no ambiguity rule matched.</div>';
      return;
    }

    $('findings-list').innerHTML = report.findings.map(function (finding) {
      var excerpt = finding.excerpt ? '<blockquote>' + esc(finding.excerpt) + '</blockquote>' : '';
      var count = finding.count > 1 ? ' <span class="rule">×' + finding.count + '</span>' : '';
      return '<div class="finding sev-' + finding.severity + '">' +
        '<div class="finding-top"><span class="pill">' + finding.severity + '</span>' +
        '<span class="rule">' + esc(finding.ruleId) + count + '</span>' +
        '<span class="line">line ' + finding.line + '</span></div>' +
        '<h4>' + esc(finding.title) + '</h4>' +
        '<p>' + esc(finding.message) + '</p>' + excerpt +
        '<p class="fix"><b>Fix</b> ' + esc(finding.suggestion) + '</p></div>';
    }).join('');
  }

  function renderEmptyReport() {
    state.report = null;
    $('ring').style.setProperty('--p', 0);
    $('score-num').textContent = '—';
    $('grade').textContent = 'No score yet';
    $('score-title').textContent = 'Waiting for a prompt';
    $('score-sub').textContent = 'Structure, ambiguity, specificity, and brevity, scored deterministically.';
    ['structure', 'clarity', 'specificity', 'brevity'].forEach(function (name) { setBar(name, 0, name === 'structure' ? 50 : name === 'clarity' ? 25 : name === 'specificity' ? 15 : 10); });
    $('stat-words').textContent = '0';
    $('stat-tokens').textContent = '0';
    $('stat-lines').textContent = '0';
    $('stat-sentences').textContent = '0';
    $('context-chips').innerHTML = '';
    $('structure-hint').textContent = '0 of 7 sections';
    $('findings-hint').textContent = 'Nothing analyzed yet';
  }

  function lintNow() {
    var text = $('prompt').value;
    syncEditor();
    if (!text.trim()) { renderEmptyReport(); return; }
    if (state.controller) state.controller.abort();
    var controller = new AbortController();
    state.controller = controller;
    $('score-panel').classList.add('loading');
    fetch('/api/lint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
      signal: controller.signal
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) throw new Error(payload && payload.error ? payload.error.message : 'Lint failed.');
        return payload;
      });
    }).then(function (report) {
      if (controller.signal.aborted) return;
      renderReport(report);
    }).catch(function (error) {
      if (error.name !== 'AbortError') {
        $('findings-list').innerHTML = '<div class="success-card" style="border-color:#4a2b31;background:#1a0d11;color:#ffb4bf;">' + esc(error.message) + '</div>';
      }
    }).finally(function () {
      if (!controller.signal.aborted) $('score-panel').classList.remove('loading');
    });
  }

  function scheduleLint() {
    clearTimeout(state.timer);
    state.timer = setTimeout(lintNow, 320);
  }

  function loadSamples() {
    if (state.samples) return Promise.resolve(state.samples);
    return fetch('/api/samples').then(function (response) { return response.json(); }).then(function (samples) {
      state.samples = samples;
      return samples;
    });
  }

  function setPrompt(text) {
    $('prompt').value = text;
    syncEditor();
    lintNow();
  }

  function renderDiff(diff) {
    state.diff = diff;
    $('before-tag').textContent = 'score ' + diff.before.score.total + ' · ' + diff.before.score.grade;
    $('after-tag').textContent = 'score ' + diff.after.score.total + ' · ' + diff.after.score.grade;

    var scoreDelta = diff.delta.score;
    var scoreClass = scoreDelta > 0 ? 'good' : scoreDelta < 0 ? 'bad' : 'same';
    var scoreText = scoreDelta === 0 ? '±0' : (scoreDelta > 0 ? '+' : '') + scoreDelta;
    $('diff-verdict').innerHTML = 'Version 2 <span class="' + scoreClass + '">' + (scoreDelta > 0 ? 'improves' : scoreDelta < 0 ? 'drops' : 'holds') + '</span> the score (' + scoreText + ') · ' + esc(diff.verdict);
    $('delta-score').textContent = scoreText;
    $('delta-tokens').textContent = (diff.delta.tokens > 0 ? '+' : '') + diff.delta.tokens;
    $('delta-added').textContent = '+' + diff.delta.added;
    $('delta-removed').textContent = '-' + diff.delta.removed;

    var tags = [];
    diff.sectionsGained.forEach(function (section) { tags.push('<span class="tag good">+' + esc(section) + '</span>'); });
    diff.sectionsLost.forEach(function (section) { tags.push('<span class="tag bad">-' + esc(section) + '</span>'); });
    diff.resolved.forEach(function (rule) { tags.push('<span class="tag good">fixed ' + esc(rule) + '</span>'); });
    diff.introduced.forEach(function (rule) { tags.push('<span class="tag bad">new ' + esc(rule) + '</span>'); });
    $('diff-tags').innerHTML = tags.join('');

    $('diff-lines').innerHTML = diff.lines.map(function (line) {
      var sign = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      var text = line.text.length ? esc(line.text) : '&nbsp;';
      return '<div class="diff-row ' + line.type + '">' +
        '<span>' + (line.beforeLine || '') + '</span>' +
        '<span>' + (line.afterLine || '') + '</span>' +
        '<span class="sign">' + sign + '</span>' +
        '<span>' + text + '</span></div>';
    }).join('');
  }

  function runDiff() {
    var before = $('before').value;
    var after = $('after').value;
    if (!before.trim() || !after.trim()) {
      $('diff-verdict').textContent = 'Both versions need some text before they can be compared.';
      return;
    }
    if (state.diffController) state.diffController.abort();
    var controller = new AbortController();
    state.diffController = controller;
    fetch('/api/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ before: before, after: after }),
      signal: controller.signal
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) throw new Error(payload && payload.error ? payload.error.message : 'Comparison failed.');
        return payload;
      });
    }).then(function (diff) {
      if (!controller.signal.aborted) renderDiff(diff);
    }).catch(function (error) {
      if (error.name !== 'AbortError') $('diff-verdict').textContent = error.message;
    });
  }

  function scheduleDiff() {
    clearTimeout(state.timer);
    state.timer = setTimeout(runDiff, 420);
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tabs button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-tab') === tab);
    });
    $('lint-view').classList.toggle('active', tab === 'lint');
    $('compare-view').classList.toggle('active', tab === 'compare');
    if (tab === 'compare') {
      loadSamples().then(function (samples) {
        if (!$('before').value.trim() && !$('after').value.trim()) {
          $('before').value = samples.before;
          $('after').value = samples.after;
          runDiff();
        }
      }).catch(function () {});
    }
  }

  $('prompt').addEventListener('input', scheduleLint);
  $('prompt').addEventListener('scroll', function () { $('gutter').scrollTop = $('prompt').scrollTop; });
  $('prompt').addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      lintNow();
    }
  });

  $('load-v1').addEventListener('click', function () { loadSamples().then(function (samples) { setPrompt(samples.before); }).catch(function () {}); });
  $('load-v2').addEventListener('click', function () { loadSamples().then(function (samples) { setPrompt(samples.after); }).catch(function () {}); });
  $('clear-prompt').addEventListener('click', function () { setPrompt(''); });
  $('copy-report').addEventListener('click', function () {
    if (!state.report) return;
    var text = JSON.stringify(state.report, null, 2);
    var button = $('copy-report');
    function done() { button.textContent = 'Copied'; setTimeout(function () { button.textContent = 'Copy report'; }, 1200); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
    } else {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      done();
    }
  });

  $('before').addEventListener('input', scheduleDiff);
  $('after').addEventListener('input', scheduleDiff);
  $('run-diff').addEventListener('click', runDiff);
  $('load-pair').addEventListener('click', function () {
    loadSamples().then(function (samples) {
      $('before').value = samples.before;
      $('after').value = samples.after;
      runDiff();
    }).catch(function () {});
  });

  document.querySelectorAll('.tabs button').forEach(function (button) {
    button.addEventListener('click', function () { switchTab(button.getAttribute('data-tab')); });
  });

  syncEditor();
  loadSamples().then(function (samples) { setPrompt(samples.before); }).catch(function () {});
})();
</script>
</body>
</html>`;
}
