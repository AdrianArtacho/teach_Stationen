# CSV-Driven Image Overlay (GitHub Pages)

This project renders **interactive image overlays** from a **public CSV file** (e.g. Google Sheets → CSV), using **pure client-side JavaScript**.

It is designed to run on **GitHub Pages** and be **embedded anywhere** (WordPress, static sites, LMS platforms) via an `<iframe>`.

Each image can contain **interactive markers** (circle + centered label) positioned in pixel coordinates.
Markers can either:

* open **external links**, or
* display **contextual popup bubbles** with rich text and Markdown-style links.

![stationen](img/gui.png)

---

## ✨ Features

* 📄 **CSV-driven** (no backend, no build step)
* 🖼 **Responsive images** with SVG overlays
* 📍 **Interactive markers** (circle + centered label)
* 🧠 **Dual marker behavior**:

  * URL → opens link
  * Text → shows popup bubble
* 💬 **Popup bubbles** with:

  * hover-to-show (desktop)
  * click-to-pin (touch-friendly)
  * Markdown-style links
* 📐 Pixel-accurate positioning (scales with image)
* 🧩 Multiple sections per CSV
* 🌐 Works on **GitHub Pages**
* 🔗 Easy embedding via `<iframe>`
* 🔒 No data stored in the repo (CSV URL passed via query string)

---

## 📁 Repository Structure

```
.
├── index.html   # Minimal HTML shell
├── app.js       # CSV parsing + rendering logic
├── style.css    # Layout, markers, popup styling
└── README.md    # This file
```

---

## 🚀 Deployment (GitHub Pages)

1. Create a new GitHub repository.
2. Add the following files:

   * `index.html`
   * `app.js`
   * `style.css`
3. Go to **Settings → Pages**
4. Set:

   * **Source**: Deploy from a branch
   * **Branch**: `main` / `/ (root)`
5. Save.

Your site will be available at:

```
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/
```

---

## 📄 CSV Format

The CSV defines **sections** and **items**.

---

### Section rows

A row whose **first column is an integer** starts a new section:

```
0, imageURL, title, subtitle, 100%, -150
```

| Column | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| A      | Section ID (integer)                                       |
| B      | Public image URL                                           |
| C      | Section title (optional)                                   |
| D      | Section subtitle (optional)                                |
| E      | Image width as percentage (`100%`, `50%`, etc.)            |
| F      | Title Y offset in pixels (negative = move down into image) |

Example:

```
0,"https://example.com/image.png","Elektro-Blitz","KTW-Schule","100%","-150"
```

---

### Item rows (markers)

Rows following a section define markers for that image:

```
Roland, https://roland.com, 100, 100, green, 15
```

| Column | Meaning                              |
| ------ | ------------------------------------ |
| A      | Label text (shown inside the circle) |
| B      | **URL or text content** (see below)  |
| C      | X position (pixels)                  |
| D      | Y position (pixels)                  |
| E      | Circle color (CSS color)             |
| F      | Circle radius (pixels)               |

---

## 🔀 Marker Behavior (URL vs Text)

### 1️⃣ URL markers (navigation)

If **column B starts with** `http://`, `https://`, or `mailto:`:

```
Roland,https://roland.com,100,100,green,15
```

**Behavior**

* Clicking the marker opens the link in a new tab.

---

### 2️⃣ Text markers (popup bubbles)

If **column B is NOT a URL**, it is treated as **popup content**:

```
Roland,"Try [Roland](https://roland.com) or [Yamaha](https://yamaha.com).",100,100,green,15
```

**Behavior**

* 🖱 **Hover** over marker → popup appears
* 🖱 Move away → popup disappears (slight delay)
* 👆 **Click** marker → popup is *pinned* (important for touch devices)
* ❌ Click outside or close button → popup closes

---

## 📝 Popup Content & Markdown

Popup text supports **Markdown-style links**:

```
[Link text](https://example.com)
```

Supported features:

* Markdown links
* Line breaks
* Automatic HTML escaping for safety

❌ Raw HTML is **not allowed** (for security reasons).

---

## 📊 Creating the CSV (Google Sheets)

1. Create a Google Sheet
2. Structure it as described above
3. Go to **File → Share → Publish to web**
4. Choose:

   * Format: **CSV**
   * Sheet: desired sheet
5. Copy the generated CSV URL

Typical Google Sheets CSV URL:

```
https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=0&single=true&output=csv
```

---

## 🔗 Using the App (Standalone)

Open the GitHub Pages URL with a `csv` query parameter:

```
https://YOURNAME.github.io/YOURREPO/?csv=URL_ENCODED_CSV_URL
```

The CSV URL **must be URL-encoded**.

A helper tool is available here:
👉 [https://adrianartacho.github.io/UrlEncode/](https://adrianartacho.github.io/UrlEncode/)

---

## 🧩 Embedding (WordPress / other sites)

Embed the visualization using an `<iframe>`.

### Example

```html
<iframe
  src="https://adrianartacho.github.io/teach_Stationen/?csv=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2Fe%2F2PACX-1vQVMpMr2pzAZBuERnNFwrIvNxWO3_qyv4b8b-pLiOcXOUShz2WTSaVlmwHwl85pWWgsFzrP8EfmRcxF%2Fpub%3Fgid%3D0%26single%3Dtrue%26output%3Dcsv"
  style="width:100%; max-width:1000px; height:500px; border:0;"
  loading="lazy"
></iframe>
```

### Notes

* The page renders **only the images and overlays** (no header, no UI text).
* Adjust `height` as needed.
* Multiple iframes can be embedded on the same page (each with a different CSV).

---

## 🎨 Styling & Customization

All visual styling lives in `style.css`.

You can easily adjust:

* circle opacity
* label font size
* colors
* popup appearance
* hover timing
* image borders and rounding

Example marker text styling:

```css
.marker text {
  font-size: 16px;
  font-weight: 600;
  fill: black;
  paint-order: stroke;
  stroke: white;
  stroke-width: 3px;
}
```

---

## 🛠 Technical Notes

* Rendering uses **SVG overlays** aligned to the image’s natural size.
* Coordinates are **pixel-accurate** and scale responsively.
* Popup positioning adapts to viewport size.
* No external libraries.
* No cookies, no tracking, no storage.
* Works in all modern browsers.

---

## 📌 Typical Use Cases

* Interactive school maps
* Instrument or equipment stations
* Exhibition layouts
* Annotated scores or diagrams
* Educational walkthroughs
* Spatial storytelling
* Contextual documentation layered on images

---

## 📄 License

MIT — free to use, modify, and embed.
Developed by [Adrián Artacho](https://www.artacho.at/).

