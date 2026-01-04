// app.js
// CSV-driven image overlay (GitHub Pages friendly)
// Adds "bubble text" markers:
// - If item column B is a navigable URL (http/https/mailto): clicking marker opens link (new tab)
// - Otherwise: marker shows a popup bubble (supports markdown links [label](https://...))
//   * Hover shows bubble (desktop)
//   * Click pins/unpins bubble (touch-friendly)

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

/** Treat as URL only if it’s something we want to navigate to. */
function isNavigableUrl(s) {
  if (!s) return false;
  const t = String(s).trim();
  // allow absolute http(s) and mailto
  return /^(https?:\/\/|mailto:)/i.test(t);
}

/** Basic HTML escaping to keep popup safe. */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Very small markdown-link support:
 * - [label](https://example.com)
 * - Newlines become <br>
 *
 * Everything is escaped first, then link patterns are converted to <a>.
 */
function mdToSafeHtml(input) {
  const escaped = escapeHtml(input);

  // Convert markdown links: [text](url)
  const linked = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = url.trim();
    // Only allow http(s) / mailto in rendered links
    if (!isNavigableUrl(href)) {
      return `${escapeHtml(label)} (${escapeHtml(href)})`;
    }
    const safeLabel = label; // already escaped
    const safeHref = escapeHtml(href);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  // Newlines -> <br>
  return linked.replace(/\n/g, "<br>");
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
        scalePercent,
        titleYOffsetPx,
        items: [],
      };
      sections.push(current);
      continue;
    }

    // ITEM ROW (must appear after first section row)
    if (!current) continue;

    const name = a;
    const rawLinkOrText = (r[1] ?? "").replace(/^"(.*)"$/, "$1").trim();

    const x = parseNumberCell(r[2], NaN);
    const y = parseNumberCell(r[3], NaN);
    const color = ((r[4] ?? "green").trim() || "green");
    const radius = parseNumberCell(r[5], 15);

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    current.items.push({
      name,
      linkOrText: rawLinkOrText, // can be URL or plain text
      isUrl: isNavigableUrl(rawLinkOrText),
      x,
      y,
      color,
      radius,
    });
  }

  return sections;
}

function createPopupEl() {
  const popup = document.createElement("div");
  popup.className = "popup hidden";
  popup.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <div class="content"></div>
  `;
  return popup;
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

    // Convention used earlier:
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

  // Popup bubble lives inside stage so it overlays the image
  const popup = createPopupEl();
  stage.appendChild(popup);

  const closeBtn = popup.querySelector(".close");
  const contentEl = popup.querySelector(".content");

  // Hover/pin state
  let hideTimer = null;
  let pinned = false;

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hidePopup() {
    popup.classList.add("hidden");
  }

  function scheduleHidePopup(delayMs = 220) {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (!pinned) hidePopup();
    }, delayMs);
  }

  // Keep open while hovering the popup itself
  popup.addEventListener("mouseenter", () => clearHideTimer());
  popup.addEventListener("mouseleave", () => scheduleHidePopup(220));

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pinned = false;
    hidePopup();
  });

  // Close popup when clicking outside markers/popup
  stage.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof Element) {
      if (t.closest(".popup")) return;
      if (t.closest("a.marker")) return;
    }
    pinned = false;
    hidePopup();
  });

  img.addEventListener("load", () => {
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;

    svg.setAttribute("viewBox", `0 0 ${naturalW} ${naturalH}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

    // Clear (in case of reload)
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Helper to position popup in *display* pixels
    function positionPopupAt(pxX, pxY) {
      const rect = stage.getBoundingClientRect();
      const sx = rect.width / naturalW;
      const sy = rect.height / naturalH;

      const x = pxX * sx;
      const y = pxY * sy;

      const pad = 8;

      // Show first so size is measurable
      popup.classList.remove("hidden");

      // Initial placement near marker
      popup.style.left = `${x + pad}px`;
      popup.style.top = `${y + pad}px`;

      // Clamp after measuring
      const stageRect = stage.getBoundingClientRect();
      const pRect = popup.getBoundingClientRect();

      let newLeft = x + pad;
      let newTop = y + pad;

      // If it would overflow right/bottom, flip to left/top of marker
      if (pRect.right > stageRect.right - pad) newLeft = x - pRect.width - pad;
      if (pRect.bottom > stageRect.bottom - pad) newTop = y - pRect.height - pad;

      // Clamp within stage bounds (stage-local coords)
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      newLeft = clamp(newLeft, pad, rect.width - pRect.width - pad);
      newTop = clamp(newTop, pad, rect.height - pRect.height - pad);

      popup.style.left = `${newLeft}px`;
      popup.style.top = `${newTop}px`;
    }

    // Reposition popup on resize (if visible)
    let lastPopupPos = null;
    function maybeRepositionPopup() {
      if (popup.classList.contains("hidden")) return;
      if (!lastPopupPos) return;
      positionPopupAt(lastPopupPos.x, lastPopupPos.y);
    }
    window.addEventListener("resize", maybeRepositionPopup);

    for (const it of section.items) {
      // Create a marker anchor for clickability + cursor
      const a = document.createElementNS("http://www.w3.org/2000/svg", "a");
      a.classList.add("marker");

      if (it.isUrl) {
        a.setAttribute("href", it.linkOrText);
        a.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", it.linkOrText);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } else {
        // Text bubble marker: hover shows; click pins/unpins
        a.setAttribute("href", "#");

        const show = () => {
          clearHideTimer();
          contentEl.innerHTML = mdToSafeHtml(it.linkOrText || "");
          lastPopupPos = { x: it.x, y: it.y };
          positionPopupAt(it.x, it.y);
        };

        // Hover / pointer interactions
        a.addEventListener("pointerenter", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          pinned = false; // hovering resets pin
          show();
        });

        a.addEventListener("pointerleave", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          scheduleHidePopup(220);
        });

        // Click toggles pin (important for mobile)
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          const sameMarker =
            lastPopupPos && lastPopupPos.x === it.x && lastPopupPos.y === it.y;

          // If hidden or different marker, show and pin
          if (popup.classList.contains("hidden") || !sameMarker) {
            pinned = true;
            show();
            return;
          }

          // Same marker: toggle pin/hide
          pinned = !pinned;
          if (!pinned) hidePopup();
        });
      }

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(it.x));
      circle.setAttribute("cy", String(it.y));
      circle.setAttribute("r", String(it.radius));
      circle.setAttribute("fill", it.color);
      circle.setAttribute("fill-opacity", "0.5");

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      // Center label inside the circle
      text.setAttribute("x", String(it.x));
      text.setAttribute("y", String(it.y));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
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
