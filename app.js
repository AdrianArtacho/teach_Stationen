// app.js
// CSV-driven image overlay (GitHub Pages friendly)
// Supports section rows like:
// 0, imageURL, title, subtitle, 100%, -150
// where:
// - col A: integer section id
// - col B: section image URL
// - col C: section title (optional)
// - col D: section subtitle (optional)
// - col E: section scale percent as "100%" (optional; default 100%)
// - col F: title Y offset in px (optional; e.g. -150 means move DOWN 150px into the image)
//
// Item rows (under a section) like:
// Roland, https://link, 100, 100, green, 15
// where:
// - col A: label
// - col B: link URL
// - col C: x
// - col D: y
// - col E: color (default green)
// - col F: radius (default 15)

function getCsvUrlFromQuery() {
  const u = new URL(window.location.href);
  return u.searchParams.get("csv");
}

function isIntegerCell(value) {
  return typeof value === "string" && /^[0-9]+$/.test(value.trim());
}

/**
 * Minimal CSV parser that handles:
 * - commas
 * - quotes
 * - escaped quotes ("")
 * Assumes \n line breaks.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else {
        field += c;
      }
    }
  }

  // last field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // trim cells
  return rows.map((r) => r.map((c) => (c ?? "").trim()));
}

function parsePercentCell(cell, fallback = 100) {
  if (cell == null) return fallback;
  const s = String(cell).trim();
  if (!s) return fallback;

  // Accept "100%", "100", " 50 % "
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*%?$/);
  if (!m) return fallback;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : fallback;
}

function parseNumberCell(cell, fallback = 0) {
  if (cell == null) return fallback;
  const s = String(cell).trim();
  if (!s) return fallback;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

function rowsToSections(rows) {
  const sections = [];
  let current = null;

  for (const r of rows) {
    const a = (r[0] ?? "").trim();
    if (!a) continue;

    // SECTION ROW
    if (isIntegerCell(a)) {
      const scalePercent = parsePercentCell(r[4], 100);
      const titleYOffsetPx = parseNumberCell(r[5], 0);

      current = {
        id: parseInt(a, 10),
        imageUrl: (r[1] ?? "").replace(/^"(.*)"$/, "$1").trim(),
        title: (r[2] ?? "").trim(),
        subtitle: (r[3] ?? "").trim(),
        scalePercent, // numeric, e.g. 100 means 100%
        titleYOffsetPx, // numeric, e.g. -150 means move DOWN 150px
        items: [],
      };
      sections.push(current);
      continue;
    }

    // ITEM ROW (must appear after first section row)
    if (!current) continue;

    const name = a;
    const linkUrl = (r[1] ?? "").replace(/^"(.*)"$/, "$1").trim();
    const x = parseNumberCell(r[2], NaN);
    const y = parseNumberCell(r[3], NaN);
    const color = ((r[4] ?? "green").trim() || "green");
    const radius = parseNumberCell(r[5], 15);

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    current.items.push({ name, linkUrl, x, y, color, radius });
  }

  return sections;
}

function createSectionEl(section) {
  const el = document.createElement("section");
  el.className = "section";

  // Stage first, because overlay titles may live inside it
  const stage = document.createElement("div");
  stage.className = "stage";

  // Apply scale as width percentage (centered)
  const sp = Number.isFinite(section.scalePercent) ? section.scalePercent : 100;
  stage.style.width = `${sp}%`;
  stage.style.margin = "0 auto";

  // Decide whether to overlay title (inside image) or keep it above image
  const dyPx = Number.isFinite(section.titleYOffsetPx) ? section.titleYOffsetPx : 0;
  const shouldOverlayTitle = dyPx !== 0;

  if (!shouldOverlayTitle) {
    if (section.title) {
      const h = document.createElement("h2");
      h.className = "section-title";
      h.textContent = section.title;
      el.appendChild(h);
    }
    if (section.subtitle) {
      const p = document.createElement("p");
      p.className = "section-subtitle";
      p.textContent = section.subtitle;
      el.appendChild(p);
    }
  } else if (section.title || section.subtitle) {
    // Overlay block inside the stage
    const titleWrap = document.createElement("div");
    titleWrap.className = "title-overlay";

    // Convention requested:
    // -150 => move DOWN 150px into the image
    titleWrap.style.transform = `translateY(${Math.abs(dyPx)}px)`;

    if (section.title) {
      const h = document.createElement("div");
      h.className = "section-title overlay-title";
      h.textContent = section.title;
      titleWrap.appendChild(h);
    }
    if (section.subtitle) {
      const p = document.createElement("div");
      p.className = "section-subtitle overlay-subtitle";
      p.textContent = section.subtitle;
      titleWrap.appendChild(p);
    }
    stage.appendChild(titleWrap);
  }

  const img = document.createElement("img");
  img.alt = section.title || `Section ${section.id}`;
  img.src = section.imageUrl;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("overlay");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  img.addEventListener("load", () => {
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

    // Clear (in case of reload)
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    for (const it of section.items) {
      const a = document.createElementNS("http://www.w3.org/2000/svg", "a");
      a.classList.add("marker");

      // SVG2 supports href; xlink:href kept for compatibility
      a.setAttribute("href", it.linkUrl);
      a.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", it.linkUrl);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(it.x));
      circle.setAttribute("cy", String(it.y));
      circle.setAttribute("r", String(it.radius));
      circle.setAttribute("fill", it.color);
      circle.setAttribute("fill-opacity", "0.5");

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      // Label slightly to the right of the circle
      text.setAttribute("x", String(it.x + it.radius + 8));
      text.setAttribute("y", String(it.y));
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("text-anchor", "start");
      text.textContent = it.name;

      a.appendChild(circle);
      a.appendChild(text);
      svg.appendChild(a);
    }
  });

  img.addEventListener("error", () => {
    const warn = document.createElement("div");
    warn.className = "error";
    warn.textContent = `Could not load image for section ${section.id}.`;
    el.appendChild(warn);
  });

  stage.appendChild(img);
  stage.appendChild(svg);
  el.appendChild(stage);

  return el;
}

async function main() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const csvUrl = getCsvUrlFromQuery();
  if (!csvUrl) {
    app.innerHTML = `
      <div class="error">
        Missing <code>?csv=</code> parameter.<br/><br/>
        Example:<br/>
        <code>?csv=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2Fe%2F...%2Fpub%3Fgid%3D0%26single%3Dtrue%26output%3Dcsv</code>
      </div>
    `;
    return;
  }

  let text;
  try {
    const res = await fetch(csvUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    app.innerHTML = `
      <div class="error">
        Failed to fetch CSV. Possible causes: wrong URL, not publicly accessible, or blocked by CORS.<br/><br/>
        Details: <code>${String(e.message || e)}</code>
      </div>
    `;
    return;
  }

  const rows = parseCsv(text);
  const sections = rowsToSections(rows);

  if (!sections.length) {
    app.innerHTML = `<div class="error">No sections found. (Expected integer IDs in column A.)</div>`;
    return;
  }

  for (const s of sections) {
    app.appendChild(createSectionEl(s));
  }
}

main();