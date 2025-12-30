function getCsvUrlFromQuery() {
  const u = new URL(window.location.href);
  let csv = u.searchParams.get("csv");
  if (!csv) return null;

  // If it already looks encoded, keep it
  const looksEncoded = /%[0-9A-Fa-f]{2}/.test(csv);

  if (!looksEncoded) {
    // Encode everything, but keep protocol readable for debugging
    csv = encodeURIComponent(csv);
  }

  return csv;
}

// Optional: normalize URL in address bar
u.searchParams.set("csv", csv);
window.history.replaceState({}, "", u.toString());


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
  return rows.map(r => r.map(c => (c ?? "").trim()));
}

function rowsToSections(rows) {
  const sections = [];
  let current = null;

  for (const r of rows) {
    const a = (r[0] ?? "").trim();

    if (!a) continue;

    if (isIntegerCell(a)) {
      current = {
        id: parseInt(a, 10),
        imageUrl: (r[1] ?? "").replace(/^"(.*)"$/, "$1").trim(),
        title: (r[2] ?? "").trim(),
        subtitle: (r[3] ?? "").trim(),
        items: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      // ignore item rows before first section row
      continue;
    }

    const name = a;
    const linkUrl = (r[1] ?? "").replace(/^"(.*)"$/, "$1").trim();
    const x = parseFloat((r[2] ?? "").trim());
    const y = parseFloat((r[3] ?? "").trim());
    const color = ((r[4] ?? "green").trim() || "green");
    const radius = parseFloat(((r[5] ?? "15").trim() || "15"));

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    current.items.push({ name, linkUrl, x, y, color, radius });
  }

  return sections;
}

function createSectionEl(section) {
  const el = document.createElement("section");
  el.className = "section";

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

  const stage = document.createElement("div");
  stage.className = "stage";

  const img = document.createElement("img");
  img.alt = section.title || `Section ${section.id}`;
  img.src = section.imageUrl;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("overlay");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Wait for the image to know its natural size => correct viewBox scaling
  img.addEventListener("load", () => {
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

    // Clear (in case re-load)
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    for (const it of section.items) {
      const a = document.createElementNS("http://www.w3.org/2000/svg", "a");
      a.classList.add("marker");
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
      // Put the label slightly to the right of the circle
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
