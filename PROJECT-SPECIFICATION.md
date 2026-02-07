# Project specification: Social image generator (GitHub Pages)

**Purpose:** A detailed description for an AI (or developer) to recreate this project. Concepts and behaviour must match; technology choices may differ. The result must be a single website deployable to **GitHub Pages** (static hosting, no server).

---

## 1. High-level concept

- **What it is:** A web app that lets users compose a social-media image (e.g. for Instagram) by filling in date, time, location, title, and description, choosing a text/UI colour, and optionally adding a background image. The composed card is shown in a live preview and can be downloaded as a PNG.
- **Critical requirement:** The **exported PNG must be pixel-identical** whether the user is on desktop or mobile. Layout, fonts, and rendering must be deterministic and based only on the chosen output size and form values, not on viewport or device.
- **Responsiveness:** The app must work well on **both desktop and mobile**. The preview may scale to fit the screen, but the **output image** is always at the selected resolution (see Output sizes below).

---

## 2. Output sizes (aspect ratios)

Support at least two output formats, selectable by the user:

- **Instagram post:** 1080 × 1350 px (4∶5).
- **Instagram story:** 1080 × 1920 px (9∶16).

All layout and typography must be defined **relative to the output image dimensions** (e.g. as fractions of width or height, or derived from a base “card” size that matches the chosen aspect ratio). This ensures:
- Consistent appearance across devices.
- Reliable export at the chosen resolution without recalculating layout per device.

Internal “design” dimensions can be any convenient base (e.g. 360×450 for post, 360×640 for story) as long as every measure (padding, font size, logo size, etc.) is expressed relative to that base so scaling to 1080×1350 or 1080×1920 is a simple scale factor.

---

## 3. Layout of the image (card)

All text and logo sizes are defined **from the canvas width** (output image width). The card has two independent layers: (1) **background image**, which always fills the frame completely and is positioned/scaled independently; (2) **text layout**, which behaves independently from the image (no glitching or artifacts when dragging the image or changing layout type).

**Text layout regions** (order from top to bottom; this group sticks to the **top** of the image with appropriate padding between elements):

1. **Top row (pills):** Date, time, and place in pill-shaped outlines, left to right, with a small gap between them. Each pill: rounded rectangle (border only, transparent fill), text inside. The **pin icon** (`pin.svg` from project assets) is placed **to the left of the location text** (only when location is present), roughly the size of one capital letter of the pill font (same row, aligned with text). **When no pills are present** (date, time, and location all empty), **do not reserve space for the top row** – the title block starts at the top of the card.
2. **Title:** Main title. Available area from the bottom of the pills down to **700 px** from the top of the canvas. Start with a large font size; decrease size when needed so the title fits. Multi-line if needed; line distribution as in §5.
3. **Description:** Constant font size (relative to canvas width). **Clip when too long** (do not overflow). Area from **700 px** from the top down to the top of the logo. Description must **not overlap** the logo.
4. **Logo:** The project’s **logo** (`logo.svg`) is anchored at the **bottom-left** corner, stuck there. Fixed maximum size relative to canvas width.

Both the **logo** and the **pin** use the user-selected text colour (e.g. set as fill for SVG so they match the text).

The card background is either:
- A **checkerboard** (two shades of grey) when no background image is set—useful to see transparency; or
- **Solid** (e.g. black) when a background image is present, with the background image rendered behind the card content. The background image **always fills the frame completely** (no letterboxing); positioning and scale determine which part of the image is visible.

---

## 4. Typography

- **Pills (date, time, location):**  
  Font: `system-ui, -apple-system, sans-serif`.  
  Weight: 400.  
  Size: **defined relative to canvas (output image) width**. No absolute px in the final export logic; use the same ratio for both 1080×1350 and 1080×1920.
- **Title:**  
  Font: `"Times New Roman", Times, serif`.  
  Weight: normal.  
  Size: **relative to canvas width**. Start big; decrease when needed to fit the area from pills down to 700 px. Line height: 1.15.
- **Description:**  
  Font: `"Times New Roman", Times, serif`.  
  Weight: normal.  
  Size: **constant** relative to canvas width. Line height: 1.2. Clip when too long.

All font sizes must be computed from the **output image (canvas) width** so that the same form values always produce the same text size in the exported PNG, on any device. Text formatting must look **pretty**: no overlapping, even line distribution, and correct clipping.

---

## 5. Title behaviour

- **Input:** The title is edited in a field that **allows the user to press Enter** to insert an explicit line break. So the control should be a textarea or an input that accepts newlines (not a single-line input that strips them).
- **Multiple spaces:** Consecutive spaces in the title must **be preserved** in layout and export (not collapsed to one space). Trimming should only apply to leading/trailing whitespace if desired; internal spaces stay as entered.
- **Overflow:** Title text must **never overflow** outside the image. It must either wrap or shrink (see below) so it stays within the title area.
- **Line distribution when wrapping:** When the title wraps into multiple lines **without** user-inserted line breaks, words should be **distributed as evenly as possible** across the lines. Example: four words should ideally become two lines of two words each, not three words on the first line and one on the second. Algorithm: decide number of lines from available height and font size, then assign words to lines so that line lengths are as balanced as possible (e.g. by targeting similar character or word count per line).
- **User line breaks:** If the user inserts line breaks (Enter), those must be honoured; only the “auto-wrap” logic applies between such breaks (and for any line that still overflows).
- **Scaling:** If the title (with chosen font size and line distribution) does not fit in the allocated title area, reduce the title font size until it fits (with a minimum size), so that nothing overflows.

---

## 6. Description behaviour

- **Area:** From 700 px from the top of the canvas down to the top of the logo. Description must **not overlap** the logo.
- **Overflow:** Description uses a **constant** font size (relative to canvas width). If the text is too long for the allocated area, **clip** it (do not shrink font; clip so it does not overflow and does not overlap the logo).

---

## 7. Top row: date, time, location pills and URL

- **Date pill:** Displays a short date (e.g. “fre 6. feb” for Norwegian locale). Value comes from a date input or URL. Format: weekday (short) + day + “.” + month (short). Optional; hide pill if empty.
- **Time pill:** Displays time (e.g. “18:00”). Optional; hide if empty.
- **Location pill:** Displays a location string. Optional; hide if empty. **URL parameter:** Include a query parameter (e.g. `location`) in the page URL so that the page can be opened with a pre-filled location (e.g. `?location=Stranda`). The app should read this on load and update the URL when the user changes the location (replaceState), so that the link is shareable.
- **Pin icon:** The **pin** (`pin.svg` from project assets) is placed **to the left of the location text** inside or next to the location pill. Its size is approximately the height of one capital letter of the pill font. The pin uses the same **user-selected text colour** as the rest of the text (e.g. SVG fill).

---

## 8. Background image

- **Sources:** User can set a background image via: (1) **preset images** from a project folder (see §14): thumbnails shown in the UI load images from `preset-images/`; (2) **drag-and-drop upload** (drop zone on the preview or controls); (3) file picker; (4) paste from clipboard; (5) URL input with a “Load” button. Optional; if none is set, the card shows the checkerboard (or solid) background only.
- **Position and scale:** The background image is positioned and scaled with numeric values: X, Y, scale, opacity, and blur. **Position (X, Y):** display and store as **integers** (no decimals). **Scale:** display as **percent**, no decimals (e.g. 100%, 150%). **Opacity and blur:** presented as **sliders** in the UI (with optional numeric readout). Scale is applied **from the centre** of the image (not the upper-left corner), so resizing keeps the image centred.
- **Clear image button:** A dedicated button (e.g. “Fjern bilde” / “Clear image”) must remove the background image and reset related state (X, Y, scale, opacity, blur); the card returns to checkerboard background.
- **Desktop interaction:** On desktop, the background image must be **draggable** (mouse drag to change X/Y) and **zoomable** (e.g. mouse wheel to change scale, or a visible zoom control). The visible area is adjusted by drag and zoom so the user can frame the part of the image they want.
- **Mobile interaction:** On mobile, the same effect must be achievable via **pinch-to-zoom** (to change scale) and **drag** (to move). Touch handlers must update the same X, Y, and scale state so that the exported image uses the same values regardless of whether the user adjusted them on desktop or mobile.
- **Visual cue:** Below the preview, show a **visual cue** (e.g. short text or hint) that the image can be **dragged and scaled** (e.g. "Drag to move, scroll or pinch to zoom").
- **Independence from text layout:** The text layout section (pills, title, description, logo) must behave **independently** from the background image. When the user drags or scales the image, there must be **no glitching or artifacts**. The background image must **always fill the frame completely** (scale/position only choose which part is visible); this must hold when changing layout type (post/story) as well.
- **Persistence in URL:** The background image URL (when loaded from URL) can be stored in a query parameter (e.g. `image` or `img`) so that sharing the link restores the image. CORS and same-origin rules apply for loading external images.

---

## 9. Colour

- **Single colour** controls all text and the logo (and optionally the location icon): pills, title, description, logo. The user picks it via:
  - A colour picker (native or custom). **On mobile,** the colour picker must be **similar to the default Chrome desktop colour picker** (e.g. hue strip plus saturation/brightness area, or equivalent full picker), so that mobile users can choose colours as easily as on desktop.
  - A hex text input (e.g. `#ffffff`).
  - **Presets** defined in a **setup file** (see § Setup file below); the main app does not hardcode preset colours.
- **Checkerboard:** When no background image is set, use a light/dark checkerboard so that the card is visible; the darker variant can be used when the chosen colour is light (e.g. for contrast).

---

## 10. Logo

- The project’s **logo** (`logo.svg` from `assets/`) is shown at the **bottom-left** of the card, **stuck** to that corner. Size is fixed relative to **canvas width**. The logo uses the **user-selected text colour** (e.g. SVG fill) so it matches the text. Description must not overlap the logo.

---

## 11. Export (download PNG)

- **Determinism:** The exported PNG must be **identical** for the same:
  - Output size (1080×1350 or 1080×1920),
  - Form values (date, time, location, title, description),
  - Colour,
  - Background image (and its X, Y, scale, opacity, blur),
  - Logo/vector assets.
  Regardless of whether the user is on desktop or mobile, the file must be the same (same dimensions, same layout, same font sizes relative to that dimension).
- **Transparency:** **Preserve any transparency** in the PNG export (e.g. do not flatten to an opaque background unless the design requires it; alpha channel must be preserved where the card or layers are transparent).
- **Implementation approach:** Use a canvas (or equivalent) sized to the chosen output (e.g. 1080×1350 or 1080×1920). Draw background (checkerboard or image with transform), then pills, title, description, and logo using the same relative layout and font sizes as defined for that aspect ratio. No dependency on screen size or viewport in the export pipeline.
- **Download button animation:** While the PNG is being generated or downloaded, the download button must show a **loading state** (e.g. spinner or “downloading” animation) and be disabled or non-clickable until the operation finishes, so the user gets clear feedback.

---

## 12. URL state (shareable links)

**Every parameter must be URL-definable.** The app must sync all form and control state to the URL (using `replaceState`, not full reload) so that any configuration can be restored from a link. Query parameters must include at least:

- `date` – date value (e.g. ISO or dd.mm.yyyy).
- `time` – time string (e.g. 18:00).
- `location` – location string (for the location pill).
- `title` – title text (encoded).
- `description` – description text (encoded).
- `image` (or `img`) – background image URL when applicable.
- `size` (or `format`) – output size, e.g. `post` / `story` or `1080x1350` / `1080x1920`.
- `color` (or `colour`) – text/logo colour as hex (e.g. `%23ffffff` for #ffffff).
- Background image controls: `bgX`, `bgY`, `bgScale`, `bgOpacity`, `bgBlur` – numeric values (position integers; scale as percent; opacity and blur as numbers).

On load, parse all of these and pre-fill the form and preview so that opening the link restores the full state. Any control that affects the exported image should have a corresponding URL parameter.

---

## 13. Layout of the website (desktop and mobile)

**Theme:** The UI must support **light and dark mode**, following the **system setting** (e.g. `prefers-color-scheme: dark` / `light`). All controls and panels adapt so the app is readable in both themes.

**Desktop:** The page uses a two-area layout. One area (e.g. left or right) is the **preview**: the card is centred and scaled to fit the viewport height (or a large fixed area), so the user always sees the full card. **Below the preview**, show a short **visual cue** that the image can be dragged/scaled (see §8). The other area is the **controls panel**: a scrollable column containing all form fields and buttons. The **settings list must be compact vertically** (tight spacing, grouped labels, sliders for opacity/blur) to reduce scrolling. Controls may wrap or stack within the panel. The preview does not scroll with the controls; only the controls column scrolls if content is long.

**Mobile:** The layout is single-column and stacked. The **preview** is at the top: the card is scaled to fit the available width (or a sensible max height), so the full card is visible without horizontal scroll. Below it, the visual cue for drag/scale, then the **controls** in one scrollable column in the same order as on desktop. The user scrolls down to reach all fields and the download button. The colour picker on mobile must be similar to Chrome desktop’s default (e.g. full hue/saturation/brightness style picker) as specified in §9.

**Order of controls (both desktop and mobile):** The **image size** (output format) selector is **at the top** of the controls list. Then: date, time, location, title, description, colour (with presets and picker), then the background section (**preset images** from folder shown in UI, drag-and-drop upload, URL, clear image button, position X/Y [integers], scale [%], opacity and blur [sliders]), then the download button at the bottom.

---

## 14. Configuration and preset assets

**Config file (`config.js`):** The project must include a **configuration file** that the app loads (e.g. as a script). It must expose a global object such as `window.APP_CONFIG` with at least:

- **`defaultSize`:** Default output size: "post" (1080×1350) or "story" (1080×1920).
- **`presetColours`:** Array of preset colours for text/logo. Each entry has at least `hex`; `id` and `label` are optional (e.g. `{ id: "hvit", label: "Hvit", hex: "#ffffff" }`). The main app **reads** this and renders preset colour buttons; it must **not** hardcode preset colours.
- **`presetImages`:** Array of filenames for preset background images. Paths are relative to the **preset-images** folder (e.g. `["bg1.png", "bg2.png", "bg3.jpeg"]`). Add files to that folder and list names here; the UI shows these as selectable thumbnails.

Example structure:

```js
window.APP_CONFIG = {
  defaultSize: "post",
  presetColours: [
    { id: "hvit", label: "Hvit", hex: "#ffffff" },
    { id: "svart", label: "Svart", hex: "#000000" },
    { id: "bla", label: "Blå", hex: "#2b3086" },
    { id: "rod", label: "Rød", hex: "#ff0000" },
    { id: "neon", label: "Neon", hex: "#00ff11" },
  ],
  presetImages: ["bg1.png", "bg2.png", "bg3.jpeg"],
};
```

**Preset images folder:** The project must include a folder (e.g. `preset-images/`) for preset background images. Files listed in `config.js` `presetImages` are served from this folder and shown in the UI. The app does not hardcode preset image filenames.

---

## 15. Hosting and tech constraints

- **GitHub Pages:** The project must be deployable as a **static site** on GitHub Pages (HTML/CSS/JS only; no server-side rendering or backend). Single `index.html` plus assets (images, SVG, optional JS/CSS files) is acceptable.
- **No build requirement:** Prefer a setup that works with plain static files (optional: a simple build step is acceptable if documented).
- **Desktop and mobile:** The UI must be usable on both; the preview may reflow (e.g. sidebar on desktop, stacked on mobile), but the **exported image** is always the same for the same inputs and chosen size.

---

## 16. Summary checklist for implementation

- [ ] Two output sizes: 1080×1350 (IG post) and 1080×1920 (IG story); **image size control at the top** of the controls list; default from `config.js` `defaultSize`.
- [ ] All layout and font sizes defined **relative to canvas width**; no device-dependent logic in export.
- [ ] Works on desktop and mobile; **same PNG output** for same inputs on any device.
- [ ] **Website layout:** Desktop = preview area + scrollable controls column; mobile = preview on top, controls below; **light/dark UI** following system setting; **compact vertical settings**; **visual cue** below preview for drag/scale (see §13).
- [ ] **Card:** Pills (date, time, place) with **pin** (`pin.svg`) **to the left of** location text; title area pills → 700 px (start big, shrink to fit); description 700 px → logo (constant size, **clip** when too long); **logo** (`logo.svg`) at **bottom-left**, stuck; no overlap; text layout **independent** of background image (no glitching).
- [ ] **Background image:** **Drag-and-drop** upload; **preset images** from `preset-images/` folder shown in UI; position **integers** (no decimals); scale in **percent**, no decimals; **opacity and blur as sliders**; scale **from centre**; **always fills frame**; **clear image button**.
- [ ] **Desktop:** Background image draggable (mouse) and zoomable (e.g. wheel or control).
- [ ] **Mobile:** Background image adjustable via **pinch-to-zoom** and **drag**; colour picker **similar to Chrome desktop** (full hue/saturation/brightness style).
- [ ] **Title:** Supports **Enter** for line breaks; **multiple spaces preserved**; no overflow; when wrapping without explicit breaks, **distribute words evenly** across lines (e.g. 2+2 instead of 3+1); shrink font to fit area.
- [ ] **Description:** Constant size; **clip** when too long; must not overlap logo.
- [ ] Fonts: pills = system-ui, 400; title and description = Times New Roman, serif; sizes from **canvas width**; text formatting **pretty** (no overlapping).
- [ ] Single user colour for text, **logo and pin** (both use set colour); **preset colours from config.js** (§14); checkerboard when no bg image.
- [ ] **Export:** **Preserve transparency** in PNG; download button **loading state** while generating/downloading.
- [ ] **Every parameter URL-definable:** date, time, location, title, description, image, size, color, bgX, bgY, bgScale, bgOpacity, bgBlur (see §12).
- [ ] **Assets:** Use provided `logo.svg` and `pin.svg`; **config.js** with `defaultSize`, `presetColours`, `presetImages`; **preset-images/** folder.
- [ ] Deployable to **GitHub Pages** as a static site.

---

*End of specification.*
