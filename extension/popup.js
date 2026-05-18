// NewsIntel popup: takes the current tab URL, asks /lookup, renders the result.

const DEFAULTS = {
  apiUrl: "http://localhost:8000",
  webUrl: "http://localhost:3000",
};

const LEAN_LABELS = {
  left: "IN/left",
  centrist: "centrist",
  right: "IN/right",
  unknown: "unknown",
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiUrl", "webUrl"], (data) => {
      resolve({
        apiUrl: data.apiUrl || DEFAULTS.apiUrl,
        webUrl: data.webUrl || DEFAULTS.webUrl,
      });
    });
  });
}

async function saveApiUrl(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ apiUrl: value }, resolve);
  });
}

function show(elId) { document.getElementById(elId).hidden = false; }
function hide(elId) { document.getElementById(elId).hidden = true; }

function renderLeanBars(coverage) {
  const counts = { left: 0, centrist: 0, right: 0, unknown: 0 };
  for (const c of coverage) {
    if (counts[c.political_lean] !== undefined) counts[c.political_lean] += 1;
    else counts.unknown += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const container = document.getElementById("lean-bars");
  container.innerHTML = "";
  for (const [lean, count] of Object.entries(counts)) {
    if (count === 0) continue;
    const row = document.createElement("div");
    row.className = "bar";
    const pct = Math.round((count / total) * 100);
    row.innerHTML = `
      <span class="bar-label">${LEAN_LABELS[lean] || lean}</span>
      <span class="bar-fill" style="width:${pct}%"></span>
      <span class="bar-count">${count}</span>
    `;
    container.appendChild(row);
  }
}

function renderCoverage(coverage) {
  const container = document.getElementById("coverage");
  container.innerHTML = "";
  for (const c of coverage.slice(0, 12)) {
    const li = document.createElement("li");
    const safeTitle = (c.title || "(untitled)").replace(/</g, "&lt;");
    li.innerHTML = `
      <span class="source">
        ${c.source_name || c.source_slug}
        <span class="lean-tag">${LEAN_LABELS[c.political_lean] || ""}</span>
      </span>
      <a href="${c.url}" target="_blank" rel="noopener">${safeTitle}</a>
    `;
    container.appendChild(li);
  }
}

function renderTldr(tldr) {
  if (!tldr || tldr.length === 0) return;
  const list = document.getElementById("tldr");
  list.innerHTML = "";
  for (const bullet of tldr.slice(0, 3)) {
    const li = document.createElement("li");
    li.textContent = bullet;
    list.appendChild(li);
  }
  show("tldr");
}

async function lookup(apiUrl, url) {
  const u = new URL(apiUrl.replace(/\/$/, "") + "/lookup");
  u.searchParams.set("url", url);
  const res = await fetch(u.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
  return res.json();
}

async function main() {
  const settings = await getSettings();

  // Wire settings panel
  document.getElementById("api-url").value = settings.apiUrl;
  document.getElementById("settings-btn").addEventListener("click", () => {
    const panel = document.getElementById("settings-panel");
    panel.hidden = !panel.hidden;
  });
  document.getElementById("save-settings").addEventListener("click", async () => {
    const value = document.getElementById("api-url").value.trim();
    await saveApiUrl(value || DEFAULTS.apiUrl);
    location.reload();
  });

  // Active tab
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      document.getElementById("status").textContent = "No active page.";
      return;
    }

    try {
      const data = await lookup(settings.apiUrl, tab.url);
      if (!data) {
        hide("status");
        show("empty");
        return;
      }

      hide("status");
      const { story, coverage } = data;
      document.getElementById("story-name").textContent = story.name;
      document.getElementById("source-count").textContent =
        `${story.source_count} outlets`;
      document.getElementById("first-by").textContent =
        story.first_reported_by ? `🥇 ${story.first_reported_by}` : "";

      renderTldr(story.tldr);
      renderCoverage(coverage);
      renderLeanBars(coverage);

      const cta = document.getElementById("open-story");
      cta.href = `${settings.webUrl}/stories/${story.id}`;

      show("result");
    } catch (e) {
      document.getElementById("status").textContent =
        `Couldn't reach API at ${settings.apiUrl}. Click ⚙ to change.`;
    }
  });
}

main();
