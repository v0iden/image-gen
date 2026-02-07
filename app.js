(function () {
  "use strict";

  var CONFIG = window.APP_CONFIG || {
    defaultSize: "post",
    presetColours: [{ id: "hvit", label: "Hvit", hex: "#ffffff" }, { id: "svart", label: "Svart", hex: "#000000" }],
    presetImages: [],
  };

  var SIZES = { post: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };
  var PREVIEW_SCALE = 360 / 1080;
  var TITLE_TOP_LIMIT = 700;
  var PAD = 0.05;
  var GAP_PILLS = 0.03;

  function getTodayDate() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  var state = {
    size: CONFIG.defaultSize || "post",
    date: getTodayDate(),
    time: "18:00",
    location: "",
    title: "",
    description: "",
    color: "#ffffff",
    bgImage: null,
    bgImageUrl: null,
    bgColor: "#2b3086",
    bgX: 0,
    bgY: 0,
    bgScale: 100,
    bgBrightness: 100,
    bgSaturation: 100,
    bgHue: 0,
    bgColorize: false,
    bgBlur: 0,
  };

  var logoSvgText = null;
  var pinSvgText = null;
  var logoImgCache = {};
  var pinImgCache = {};

  function getDimensions(forExport) {
    var s = SIZES[state.size] || SIZES.post;
    if (forExport) return { w: s.w, h: s.h };
    return { w: Math.round(s.w * PREVIEW_SCALE), h: Math.round(s.h * PREVIEW_SCALE) };
  }

  function formatDateNorwegian(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return "";
    var opts = { weekday: "short", day: "numeric", month: "short" };
    return d.toLocaleDateString("nb-NO", opts).replace(/\./g, "").replace(/\s+/g, " ");
  }

  function distributeWordsEvenly(words, numLines) {
    if (numLines <= 0 || words.length === 0) return [""];
    if (numLines === 1) return [words.join(" ")];
    var total = words.length;
    var perLine = Math.ceil(total / numLines);
    var lines = [];
    var i = 0;
    for (var n = 0; n < numLines && i < total; n++) {
      var count = n < numLines - 1 ? Math.min(perLine, total - i) : total - i;
      lines.push(words.slice(i, i + count).join(" "));
      i += count;
    }
    return lines;
  }

  /** Split text into atoms so hyphen is an allowed line-break: "word1-word2" -> ["word1-", "word2"] */
  function titleToAtoms(line) {
    var words = line.split(/\s+/).filter(Boolean);
    var atoms = [];
    for (var wi = 0; wi < words.length; wi++) {
      var parts = words[wi].split(/(-)/);
      for (var pi = 0; pi < parts.length; pi++) {
        if (parts[pi] === "-" && atoms.length > 0) atoms[atoms.length - 1] += "-";
        else if (parts[pi] !== "-") atoms.push(parts[pi]);
      }
    }
    return atoms;
  }

  /** Join atoms into one string: no space after segment ending with hyphen. */
  function joinAtoms(atoms) {
    if (atoms.length === 0) return "";
    var s = atoms[0];
    for (var i = 1; i < atoms.length; i++) s += (atoms[i - 1].slice(-1) === "-" ? "" : " ") + atoms[i];
    return s;
  }

  function getTitleLines(ctx, title, maxWidth, maxHeight, fontSize) {
    var hasBreaks = /\n/.test(title);
    var rawLines = hasBreaks ? title.split(/\n/) : [title];
    var allLines = [];
    for (var r = 0; r < rawLines.length; r++) {
      var line = rawLines[r].trim();
      if (!line) continue;
      ctx.font = "normal " + fontSize + "px \"Times New Roman\", Times, serif";
      var words = line.split(/(\s+)/).filter(Boolean);
      if (words.length === 0) continue;
      var spaceWidth = ctx.measureText(" ").width;
      var lineWidth = 0;
      for (var i = 0; i < words.length; i++) lineWidth += ctx.measureText(words[i]).width + (i < words.length - 1 ? spaceWidth : 0);
      var needWrap = lineWidth > maxWidth;
      if (!needWrap) {
        allLines.push({ text: line, width: lineWidth });
        continue;
      }
      var atoms = titleToAtoms(line);
      var nLines = Math.max(1, Math.floor(maxHeight / (fontSize * 1.15)));
      var distributed = distributeWordsEvenly(atoms, nLines);
      for (var j = 0; j < distributed.length; j++) {
        var lineAtoms = distributed[j].split(" ");
        var text = joinAtoms(lineAtoms);
        allLines.push({ text: text, width: ctx.measureText(text).width });
      }
    }
    return allLines;
  }

  function loadSvg(path, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", path);
    xhr.onload = function () {
      if (xhr.status === 200) cb(xhr.responseText);
      else cb(null);
    };
    xhr.onerror = function () { cb(null); };
    xhr.send();
  }

  function svgToImage(svgText, color, cache, strokeOnly) {
    var key = color.toLowerCase() + (strokeOnly ? ":stroke" : "");
    if (cache[key]) return cache[key];
    var s = svgText;
    if (!s) return null;
    if (strokeOnly) {
      s = s.replace(/stroke="[^"]*"/g, 'stroke="' + color + '"');
      s = s.replace(/fill="[^"]*"/g, 'fill="none"');
      s = s.replace(/fill:\s*[^;}\s]+/g, "fill:none");
    } else {
      s = s.replace(/fill:\s*#[^;}\s]+/g, "fill:" + color);
      s = s.replace(/fill="[^"]*"/g, 'fill="' + color + '"');
      s = s.replace(/stroke="[^"]*"/g, 'stroke="' + color + '"');
      s = s.replace(/\.cls-1\s*\{[^}]*\}/g, ".cls-1{fill:" + color + "}");
    }
    var blob = new Blob([s], { type: "image/svg+xml" });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      renderPreview();
    };
    img.onerror = function () {
      renderPreview();
    };
    img.src = url;
    cache[key] = img;
    return img;
  }

  function drawCheckerboard(ctx, w, h) {
    var cs = 16;
    for (var y = 0; y < h; y += cs) {
      for (var x = 0; x < w; x += cs) {
        ctx.fillStyle = (x / cs + y / cs) % 2 === 0 ? "#e0e0e0" : "#c0c0c0";
        ctx.fillRect(x, y, cs, cs);
      }
    }
  }

  function drawBackgroundImage(ctx, w, h) {
    if (!state.bgImage || !state.bgImage.complete) return;
    var img = state.bgImage;
    var scale = (state.bgScale / 100) * Math.max(w / img.width, h / img.height);
    var sw = img.width * scale;
    var sh = img.height * scale;
    var cx = w / 2;
    var cy = h / 2;
    var dx = Math.round(state.bgX) + cx - sw / 2;
    var dy = Math.round(state.bgY) + cy - sh / 2;
    ctx.save();
    var filters = [];
    
    if (state.bgColorize) {
      filters.push("grayscale(100%)");
      filters.push("sepia(100%)");
      if (state.bgHue !== 0) {
        filters.push("hue-rotate(" + state.bgHue + "deg)");
      }
      var saturation = state.bgSaturation / 100;
      filters.push("saturate(" + saturation + ")");
    } else {
      var saturation = state.bgSaturation / 100;
      filters.push("saturate(" + saturation + ")");
      if (state.bgHue !== 0) {
        filters.push("hue-rotate(" + state.bgHue + "deg)");
      }
    }
    
    var brightness = Math.max(0.01, state.bgBrightness / 100);
    filters.push("brightness(" + brightness + ")");
    
    if (state.bgBlur > 0) {
      filters.push("blur(" + state.bgBlur + "px)");
    }
    
    if (filters.length > 0) {
      ctx.filter = filters.join(" ");
    }
    ctx.drawImage(img, dx, dy, sw, sh);
    ctx.restore();
  }

  function drawCard(ctx, dim, forExport) {
    var w = dim.w;
    var h = dim.h;
    var pad = w * PAD;
    var limitY = forExport ? TITLE_TOP_LIMIT : TITLE_TOP_LIMIT * (w / 1080);

    if (forExport) {
      ctx.clearRect(0, 0, w, h);
    } else {
      drawCheckerboard(ctx, w, h);
    }
    
    // Draw solid color background if set
    if (state.bgColor && !state.bgImage) {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, w, h);
    }
    
    if (state.bgImage && state.bgImage.complete) {
      drawBackgroundImage(ctx, w, h);
    }

    var color = state.color;
    var pillFontSize = Math.max(10, w * 0.04368);
    var descFontSize = Math.max(24, w * 0.056);
    var logoMaxW = w * 0.3;
    var logoMaxH = h * 0.12;

    var y = pad;
    if (state.size === "story") {
      var storyOffset = forExport ? 200 : 200 * (w / 1080);
      y += storyOffset;
    }
    var hasPills = state.date || state.time || state.location;

    if (hasPills) {
      ctx.font = "400 " + pillFontSize + "px system-ui, -apple-system, sans-serif";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, w * 0.004);
      ctx.textBaseline = "middle";
      var gap = w * GAP_PILLS;
      var pillY = y;
      var pillH = pillFontSize * 1.5;
      var xStart = pad;
      var pillPadding = pillFontSize * 0.6;

      var maxRadius = pillH / 2;
      if (state.date) {
        var dateStr = formatDateNorwegian(state.date);
        var tw = ctx.measureText(dateStr).width;
        var pillW = tw + pillPadding * 2;
        var rx = maxRadius;
        ctx.beginPath();
        roundRect(ctx, xStart, pillY, pillW, pillH, rx);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(dateStr, xStart + pillW / 2, pillY + pillH / 2);
        ctx.textAlign = "left";
        xStart += pillW + gap;
      }
      if (state.time) {
        var tw2 = ctx.measureText(state.time).width;
        var pillW2 = tw2 + pillPadding * 2;
        var rx2 = maxRadius;
        ctx.beginPath();
        roundRect(ctx, xStart, pillY, pillW2, pillH, rx2);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(state.time, xStart + pillW2 / 2, pillY + pillH / 2);
        ctx.textAlign = "left";
        xStart += pillW2 + gap;
      }
      if (state.location) {
        var pinImg = pinSvgText ? svgToImage(pinSvgText, color, pinImgCache, true) : null;
        var pinHeight = pinImg ? pillFontSize : 0;
        var pinAspectRatio = 18 / 22;
        var pinSize = pinHeight * pinAspectRatio;
        var locText = state.location;
        var tw3 = ctx.measureText(locText).width;
        var contentW = tw3 + (pinImg ? pinSize + gap * 0.5 : 0);
        var pillW3 = contentW + pillPadding * 2;
        var rx3 = maxRadius;
        ctx.beginPath();
        roundRect(ctx, xStart, pillY, pillW3, pillH, rx3);
        ctx.stroke();
        var contentLeft = xStart + (pillW3 - contentW) / 2;
        var textX = contentLeft;
        if (pinImg && pinImg.complete && pinImg.naturalWidth) {
          ctx.drawImage(pinImg, textX, pillY + (pillH - pinHeight) / 2, pinSize, pinHeight);
          textX += pinSize + gap * 0.5;
        }
        ctx.fillText(locText, textX, pillY + pillH / 2);
        xStart += pillW3 + gap;
      }
      ctx.textAlign = "left";
      y = pillY + pillH + pad * 1.2;
    }

    var titleTop = y;
    var titleBottom = limitY - pad * 0.5;
    var titleAreaH = Math.max(0, titleBottom - titleTop);
    var titleMaxW = w - pad * 2;

    var titleFontSize = Math.max(14, w * 0.18);
    var titleLines = [];
    while (titleFontSize >= 14) {
      titleLines = getTitleLines(ctx, state.title || "", titleMaxW, titleAreaH, titleFontSize);
      var totalH = titleLines.length * titleFontSize * 1.15;
      var fitsHeight = totalH <= titleAreaH && titleLines.length > 0;
      var fitsWidth = true;
      for (var ti = 0; ti < titleLines.length; ti++) {
        if (titleLines[ti].width > titleMaxW) {
          fitsWidth = false;
          break;
        }
      }
      if (fitsHeight && fitsWidth) break;
      titleFontSize -= 2;
    }
    if (titleFontSize < 14) titleFontSize = 14;
    if (titleLines.length === 0 && (state.title || "").trim()) {
      titleLines = getTitleLines(ctx, state.title.trim(), titleMaxW, titleAreaH, titleFontSize);
    }

    ctx.font = "normal " + titleFontSize + "px \"Times New Roman\", Times, serif";
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    var lineHeight = titleFontSize * 1.15;
    for (var t = 0; t < titleLines.length; t++) {
      ctx.fillText(titleLines[t].text, pad, y);
      y += lineHeight;
    }
    y += pad * 0.8;

    var descTop = y;
    var logoH = logoMaxH + pad;
    var descBottom = h - logoH - pad;
    var descAreaH = Math.max(0, descBottom - descTop);
    if (descAreaH > 0 && (state.description || "").trim()) {
      ctx.font = "normal " + descFontSize + "px \"Times New Roman\", Times, serif";
      ctx.textBaseline = "top";
      var lh = descFontSize * 1.2;
      var descLines = [];
      var descText = state.description.trim();
      var maxDescW = w - pad * 2;
      var words = descText.split(/\s+/);
      var line = "";
      for (var wi = 0; wi < words.length; wi++) {
        var test = line ? line + " " + words[wi] : words[wi];
        if (ctx.measureText(test).width <= maxDescW) line = test;
        else {
          if (line) descLines.push(line);
          line = words[wi];
        }
      }
      if (line) descLines.push(line);
      var clipY = descTop;
      var clipH = descAreaH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, clipY, maxDescW + pad, clipH);
      ctx.clip();
      var dy = descTop;
      for (var di = 0; di < descLines.length && dy + lh <= descTop + clipH; di++) {
        ctx.fillText(descLines[di], pad, dy);
        dy += lh;
      }
      ctx.restore();
    }

    var logoImg = logoSvgText ? svgToImage(logoSvgText, color, logoImgCache) : null;
    if (logoImg) {
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        var lw = Math.min(logoMaxW, logoImg.naturalWidth * (logoMaxH / logoImg.naturalHeight));
        var lh = logoImg.naturalHeight * (lw / logoImg.naturalWidth);
        if (lh > logoMaxH) {
          lh = logoMaxH;
          lw = logoImg.naturalWidth * (lh / logoImg.naturalHeight);
        }
        ctx.drawImage(logoImg, pad, h - pad - lh, lw, lh);
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    var minRadius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + minRadius, y);
    ctx.lineTo(x + w - minRadius, y);
    ctx.arc(x + w - minRadius, y + minRadius, minRadius, -Math.PI / 2, 0, false);
    ctx.lineTo(x + w, y + h - minRadius);
    ctx.arc(x + w - minRadius, y + h - minRadius, minRadius, 0, Math.PI / 2, false);
    ctx.lineTo(x + minRadius, y + h);
    ctx.arc(x + minRadius, y + h - minRadius, minRadius, Math.PI / 2, Math.PI, false);
    ctx.lineTo(x, y + minRadius);
    ctx.arc(x + minRadius, y + minRadius, minRadius, Math.PI, -Math.PI / 2, false);
    ctx.closePath();
  }

  function renderPreview() {
    var canvas = document.getElementById("previewCanvas");
    var ctx = canvas.getContext("2d");
    var dim = getDimensions(false);
    if (canvas.width !== dim.w || canvas.height !== dim.h) {
      canvas.width = dim.w;
      canvas.height = dim.h;
    }
    drawCard(ctx, dim, false);
  }

  function updateUrl() {
    var params = new URLSearchParams();
    var defaultSize = CONFIG.defaultSize || "post";
    if (state.size && state.size !== defaultSize) params.set("size", state.size);
    if (state.date) params.set("date", state.date);
    if (state.time && state.time !== "18:00") params.set("time", state.time);
    if (state.location) params.set("location", state.location);
    if (state.title) params.set("title", state.title);
    if (state.description) params.set("description", state.description);
    if (state.color && state.color !== "#ffffff") params.set("color", state.color.replace("#", "%23"));
    if (state.bgImageUrl && state.bgImageUrl.indexOf("data:") !== 0) params.set("image", state.bgImageUrl);
    if (state.bgX !== 0) params.set("bgX", String(Math.round(state.bgX)));
    if (state.bgY !== 0) params.set("bgY", String(Math.round(state.bgY)));
    if (state.bgScale !== 100) params.set("bgScale", String(Math.round(state.bgScale)));
      if (state.bgBrightness !== 100) params.set("bgBrightness", String(Math.round(state.bgBrightness)));
      if (state.bgSaturation !== 100) params.set("bgSaturation", String(Math.round(state.bgSaturation)));
      if (state.bgHue !== 0) params.set("bgHue", String(Math.round(state.bgHue)));
      if (state.bgColorize) params.set("bgColorize", "1");
      if (state.bgBlur !== 0) params.set("bgBlur", String(Math.round(state.bgBlur)));
      if (state.bgColor && state.bgColor !== "#2b3086") params.set("bgColor", state.bgColor.replace("#", "%23"));
    var qs = params.toString();
    var url = qs ? window.location.pathname + "?" + qs : window.location.pathname;
    window.history.replaceState({}, "", url);
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.has("size")) state.size = params.get("size");
    if (params.has("date")) state.date = params.get("date");
    if (params.has("time")) state.time = params.get("time");
    if (params.has("location")) state.location = params.get("location");
    if (params.has("title")) state.title = params.get("title");
    if (params.has("description")) state.description = params.get("description");
    if (params.has("color")) state.color = params.get("color").replace("%23", "#");
    if (params.has("image")) loadBgFromUrl(params.get("image"));
    if (params.has("bgColor")) {
      state.bgColor = params.get("bgColor").replace("%23", "#");
    } else {
      // Set default if not in URL
      state.bgColor = "#2b3086";
    }
    var x = parseInt(params.get("bgX"), 10);
    var y = parseInt(params.get("bgY"), 10);
    var sc = parseInt(params.get("bgScale"), 10);
    var br = parseInt(params.get("bgBrightness"), 10);
    var sat = parseInt(params.get("bgSaturation"), 10);
    var hue = parseInt(params.get("bgHue"), 10);
    var colorize = params.has("bgColorize");
    var bl = parseInt(params.get("bgBlur"), 10);
    if (!isNaN(x)) state.bgX = x;
    if (!isNaN(y)) state.bgY = y;
    if (!isNaN(sc)) state.bgScale = sc;
    if (!isNaN(br)) state.bgBrightness = br;
    if (!isNaN(sat)) state.bgSaturation = sat;
    if (!isNaN(hue)) state.bgHue = hue;
    state.bgColorize = colorize;
    if (!isNaN(bl)) state.bgBlur = bl;
  }

  function bindInputs() {
    var sizeEl = document.getElementById("size");
    var dateEl = document.getElementById("date");
    var timeEl = document.getElementById("time");
    var locationEl = document.getElementById("location");
    var titleEl = document.getElementById("title");
    var descEl = document.getElementById("description");
    var colorPicker = document.getElementById("colorPicker");
    var colorHex = document.getElementById("colorHex");
    var bgX = document.getElementById("bgX");
    var bgY = document.getElementById("bgY");
    var bgScale = document.getElementById("bgScale");
    var bgBrightness = document.getElementById("bgBrightness");
    var bgSaturation = document.getElementById("bgSaturation");
    var bgHue = document.getElementById("bgHue");
    var bgColorize = document.getElementById("bgColorize");
    var bgBlur = document.getElementById("bgBlur");
    var bgBrightnessVal = document.getElementById("bgBrightnessVal");
    var bgSaturationVal = document.getElementById("bgSaturationVal");
    var bgHueVal = document.getElementById("bgHueVal");
    var bgBlurVal = document.getElementById("bgBlurVal");

    function syncToState() {
      state.size = sizeEl.value;
      state.date = dateEl.value;
      state.time = timeEl.value;
      state.location = locationEl.value;
      state.title = titleEl.value;
      state.description = descEl.value;
      state.color = colorHex.value || colorPicker.value;
      state.bgX = parseInt(bgX.value, 10) || 0;
      state.bgY = parseInt(bgY.value, 10) || 0;
      state.bgScale = parseInt(bgScale.value, 10) || 100;
      state.bgBrightness = Math.max(1, parseInt(bgBrightness.value, 10) || 100);
      state.bgSaturation = Math.max(1, parseInt(bgSaturation.value, 10) || 100);
      state.bgHue = parseInt(bgHue.value, 10) || 0;
      state.bgColorize = bgColorize.checked;
      state.bgBlur = parseInt(bgBlur.value, 10) || 0;
      updateUrl();
      renderPreview();
    }

    function syncFromState() {
      sizeEl.value = state.size;
      dateEl.value = state.date;
      timeEl.value = state.time;
      locationEl.value = state.location;
      titleEl.value = state.title;
      descEl.value = state.description;
      colorPicker.value = state.color;
      colorHex.value = state.color;
      bgX.value = String(Math.round(state.bgX));
      bgY.value = String(Math.round(state.bgY));
      bgScale.value = String(Math.round(state.bgScale));
      bgBrightness.value = String(Math.round(state.bgBrightness));
      bgSaturation.value = String(Math.round(state.bgSaturation));
      bgHue.value = String(Math.round(state.bgHue));
      bgColorize.checked = state.bgColorize;
      bgBlur.value = String(Math.round(state.bgBlur));
      bgBrightnessVal.textContent = Math.round(state.bgBrightness);
      bgSaturationVal.textContent = Math.round(state.bgSaturation);
      bgHueVal.textContent = Math.round(state.bgHue);
      bgBlurVal.textContent = Math.round(state.bgBlur);
      presetColoursActive();
    }

    sizeEl.addEventListener("change", syncToState);
    dateEl.addEventListener("input", syncToState);
    timeEl.addEventListener("input", syncToState);
    locationEl.addEventListener("input", syncToState);
    titleEl.addEventListener("input", syncToState);
    descEl.addEventListener("input", syncToState);
    colorPicker.addEventListener("input", function () {
      colorHex.value = colorPicker.value;
      syncToState();
    });
    colorHex.addEventListener("input", function () {
      if (/^#[0-9a-fA-F]{6}$/.test(colorHex.value)) colorPicker.value = colorHex.value;
      syncToState();
    });
    bgX.addEventListener("input", syncToState);
    bgY.addEventListener("input", syncToState);
    bgScale.addEventListener("input", syncToState);
    bgBrightness.addEventListener("input", function () {
      bgBrightnessVal.textContent = bgBrightness.value;
      syncToState();
    });
    bgSaturation.addEventListener("input", function () {
      bgSaturationVal.textContent = bgSaturation.value;
      syncToState();
    });
    bgHue.addEventListener("input", function () {
      bgHueVal.textContent = bgHue.value;
      syncToState();
    });
    bgColorize.addEventListener("change", syncToState);
    bgBlur.addEventListener("input", function () {
      bgBlurVal.textContent = bgBlur.value;
      syncToState();
    });
    
    // Reset buttons
    document.querySelectorAll(".reset-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var resetId = btn.getAttribute("data-reset");
        var resetValue = btn.getAttribute("data-value");
        
        if (resetId === "bgBrightness") {
          bgBrightness.value = resetValue;
          bgBrightnessVal.textContent = resetValue;
          state.bgBrightness = parseInt(resetValue, 10);
        } else if (resetId === "bgSaturation") {
          bgSaturation.value = resetValue;
          bgSaturationVal.textContent = resetValue;
          state.bgSaturation = Math.max(1, parseInt(resetValue, 10));
        } else if (resetId === "bgHue") {
          bgHue.value = resetValue;
          bgHueVal.textContent = resetValue;
          state.bgHue = parseInt(resetValue, 10);
        } else if (resetId === "bgColorize") {
          bgColorize.checked = resetValue === "true";
          state.bgColorize = resetValue === "true";
        } else if (resetId === "bgBlur") {
          bgBlur.value = resetValue;
          bgBlurVal.textContent = resetValue;
          state.bgBlur = parseInt(resetValue, 10);
        }
        
        updateUrl();
        renderPreview();
      });
    });
    
    syncFromState();
  }

  function presetColoursActive() {
    var hex = (state.color || "").toLowerCase();
    document.querySelectorAll(".preset-colours button").forEach(function (btn) {
      btn.classList.toggle("active", (btn.dataset.hex || "").toLowerCase() === hex);
    });
  }

  function initPresetColours() {
    var container = document.getElementById("presetColours");
    container.innerHTML = "";
    (CONFIG.presetColours || []).forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.title = p.label || p.hex;
      btn.style.background = p.hex;
      btn.dataset.hex = p.hex;
      btn.addEventListener("click", function () {
        state.color = p.hex;
        document.getElementById("colorPicker").value = p.hex;
        document.getElementById("colorHex").value = p.hex;
        updateUrl();
        presetColoursActive();
        renderPreview();
      });
      container.appendChild(btn);
    });
  }

  function initPresetImages() {
    var container = document.getElementById("presetImages");
    container.innerHTML = "";
    var list = CONFIG.presetImages || [];
    list.forEach(function (filename) {
      var src = "preset-images/" + filename;
      var btn = document.createElement("button");
      btn.type = "button";
      var img = new Image();
      img.src = src;
      img.alt = filename;
      img.onload = function () {
        btn.appendChild(img);
      };
      btn.onclick = function () {
        state.bgColor = null;
        var bgColorPicker = document.getElementById("bgColorPicker");
        if (bgColorPicker) bgColorPicker.style.display = "none";
        updateImageControlsVisibility();
        loadBgFromUrl(src);
      };
      container.appendChild(btn);
    });
  }
  
  function initBgColorPicker() {
    var addBtn = document.getElementById("addColorBg");
    var colorPicker = document.getElementById("bgColorPicker");
    var bgColorPickerInput = document.getElementById("bgColorPickerInput");
    var bgColorHex = document.getElementById("bgColorHex");
    var clearBtn = document.getElementById("clearBgColor");
    var presetContainer = document.getElementById("presetBgColours");
    
    function updateBgColorUI() {
      if (state.bgColor) {
        colorPicker.style.display = "block";
        bgColorPickerInput.value = state.bgColor;
        bgColorHex.value = state.bgColor;
        presetBgColoursActive();
      } else {
        colorPicker.style.display = "none";
      }
      updateImageControlsVisibility();
    }
    
    function presetBgColoursActive() {
      var hex = (state.bgColor || "").toLowerCase();
      document.querySelectorAll("#presetBgColours button").forEach(function (btn) {
        btn.classList.toggle("active", (btn.dataset.hex || "").toLowerCase() === hex);
      });
    }
    
    function initPresetBgColours() {
      presetContainer.innerHTML = "";
      (CONFIG.presetColours || []).forEach(function (p) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.title = p.label || p.hex;
        btn.style.background = p.hex;
        btn.dataset.hex = p.hex;
        btn.addEventListener("click", function () {
          state.bgColor = p.hex;
          bgColorPickerInput.value = p.hex;
          bgColorHex.value = p.hex;
          updateImageControlsVisibility();
          updateUrl();
          presetBgColoursActive();
          renderPreview();
        });
        presetContainer.appendChild(btn);
      });
    }
    
    addBtn.addEventListener("click", function () {
      // Clear image when adding color background
      if (state.bgImageUrl && state.bgImageUrl.indexOf("data:") === 0) URL.revokeObjectURL(state.bgImageUrl);
      state.bgImage = null;
      state.bgImageUrl = null;
      updateClearButtonVisibility();
      
      if (!state.bgColor) {
        state.bgColor = "#ffffff";
        bgColorPickerInput.value = state.bgColor;
        bgColorHex.value = state.bgColor;
      }
      updateBgColorUI();
      updateImageControlsVisibility();
      updateUrl();
      renderPreview();
    });
    
    bgColorPickerInput.addEventListener("input", function () {
      bgColorHex.value = bgColorPickerInput.value;
      state.bgColor = bgColorPickerInput.value;
      updateImageControlsVisibility();
      updateUrl();
      presetBgColoursActive();
      renderPreview();
    });
    
    bgColorHex.addEventListener("input", function () {
      if (/^#[0-9a-fA-F]{6}$/.test(bgColorHex.value)) {
        bgColorPickerInput.value = bgColorHex.value;
        state.bgColor = bgColorHex.value;
        updateImageControlsVisibility();
        updateUrl();
        presetBgColoursActive();
        renderPreview();
      }
    });
    
    clearBtn.addEventListener("click", function () {
      state.bgColor = "#2b3086"; // Reset to default instead of null
      updateBgColorUI();
      updateImageControlsVisibility();
      updateUrl();
      renderPreview();
    });
    
    initPresetBgColours();
    
    // Initialize with default color if not set
    if (!state.bgColor) {
      state.bgColor = "#2b3086";
    }
    updateBgColorUI();
    
    // Expose updateBgColorUI for external calls (e.g., after readUrl)
    window.updateBgColorUI = updateBgColorUI;
  }

  function updateClearButtonVisibility() {
    var btn = document.getElementById("clearImage");
    if (btn) {
      btn.style.display = state.bgImageUrl ? "block" : "none";
    }
  }
  
  function updateImageControlsVisibility() {
    var bgControls = document.querySelector(".bg-controls");
    var clearImageBtn = document.getElementById("clearImage");
    var dropZone = document.getElementById("dropZone");
    var pickFileBtn = document.getElementById("pickFile");
    var urlRow = document.querySelector(".url-row");
    
    // Hide image controls when color background is set (and no image)
    var hasImage = state.bgImageUrl && !state.bgColor;
    var hasColor = !!state.bgColor;
    
    if (bgControls) {
      bgControls.style.display = hasImage ? "grid" : "none";
    }
    if (clearImageBtn) {
      clearImageBtn.style.display = hasImage ? "block" : "none";
    }
    // Show drop zone, pick file, and URL row when no image is loaded (or when color is set)
    if (dropZone) {
      dropZone.style.display = hasImage ? "none" : "block";
    }
    if (pickFileBtn) {
      pickFileBtn.style.display = hasImage ? "none" : "block";
    }
    if (urlRow) {
      urlRow.style.display = hasImage ? "none" : "flex";
    }
  }

  function loadBgFromUrl(url) {
    if (!url) {
      state.bgImage = null;
      state.bgImageUrl = null;
      updateClearButtonVisibility();
      renderPreview();
      return;
    }
    state.bgImageUrl = url;
    state.bgColor = null;
    updateClearButtonVisibility();
    updateImageControlsVisibility();
    
    // Reset image effects to defaults when loading new image
    state.bgBrightness = 100;
    state.bgSaturation = 100;
    state.bgHue = 0;
    state.bgColorize = false;
    state.bgBlur = 0;
    syncImageEffectsToUI();
    
    // Update bg color UI
    var bgColorPicker = document.getElementById("bgColorPicker");
    if (bgColorPicker) bgColorPicker.style.display = "none";
    
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      state.bgImage = img;
      renderPreview();
    };
    img.onerror = function () {
      state.bgImage = null;
      state.bgImageUrl = null;
      updateClearButtonVisibility();
      renderPreview();
    };
    img.src = url;
  }
  
  function syncImageEffectsToUI() {
    var bgBrightness = document.getElementById("bgBrightness");
    var bgSaturation = document.getElementById("bgSaturation");
    var bgHue = document.getElementById("bgHue");
    var bgColorize = document.getElementById("bgColorize");
    var bgBlur = document.getElementById("bgBlur");
    var bgBrightnessVal = document.getElementById("bgBrightnessVal");
    var bgSaturationVal = document.getElementById("bgSaturationVal");
    var bgHueVal = document.getElementById("bgHueVal");
    var bgBlurVal = document.getElementById("bgBlurVal");
    
    if (bgBrightness) {
      bgBrightness.value = String(Math.round(state.bgBrightness));
      if (bgBrightnessVal) bgBrightnessVal.textContent = Math.round(state.bgBrightness);
    }
    if (bgSaturation) {
      bgSaturation.value = String(Math.round(state.bgSaturation));
      if (bgSaturationVal) bgSaturationVal.textContent = Math.round(state.bgSaturation);
    }
    if (bgHue) {
      bgHue.value = String(Math.round(state.bgHue));
      if (bgHueVal) bgHueVal.textContent = Math.round(state.bgHue);
    }
    if (bgColorize) {
      bgColorize.checked = state.bgColorize;
    }
    if (bgBlur) {
      bgBlur.value = String(Math.round(state.bgBlur));
      if (bgBlurVal) bgBlurVal.textContent = Math.round(state.bgBlur);
    }
  }

  function clearBgImage() {
    if (state.bgImageUrl && state.bgImageUrl.indexOf("data:") === 0) URL.revokeObjectURL(state.bgImageUrl);
    state.bgImage = null;
    state.bgImageUrl = null;
    state.bgColor = null;
    state.bgX = 0;
    state.bgY = 0;
    state.bgScale = 100;
    state.bgBrightness = 100;
    state.bgSaturation = 100;
    state.bgHue = 0;
    state.bgColorize = false;
    state.bgBlur = 0;
    updateClearButtonVisibility();
    var bgX = document.getElementById("bgX");
    var bgY = document.getElementById("bgY");
    var bgScale = document.getElementById("bgScale");
    var bgBrightness = document.getElementById("bgBrightness");
    var bgSaturation = document.getElementById("bgSaturation");
    var bgHue = document.getElementById("bgHue");
    var bgColorize = document.getElementById("bgColorize");
    var bgBlur = document.getElementById("bgBlur");
    if (bgX) bgX.value = "0";
    if (bgY) bgY.value = "0";
    if (bgScale) bgScale.value = "100";
    if (bgBrightness) bgBrightness.value = "100";
    if (bgSaturation) bgSaturation.value = "100";
    if (bgHue) bgHue.value = "0";
    if (bgColorize) bgColorize.checked = false;
    if (bgBlur) bgBlur.value = "0";
    document.getElementById("bgBrightnessVal").textContent = "100";
    document.getElementById("bgSaturationVal").textContent = "100";
    document.getElementById("bgHueVal").textContent = "0";
    document.getElementById("bgBlurVal").textContent = "0";
    updateUrl();
    renderPreview();
  }

  function setupDragDrop() {
    var wrap = document.getElementById("previewWrap");
    var dropZone = document.getElementById("dropZone");
    var overlay = document.getElementById("dropOverlay");
    var fileInput = document.getElementById("fileInput");
    var pickFile = document.getElementById("pickFile");
    var canvas = document.getElementById("previewCanvas");

    function handleFile(file) {
      if (!file || !file.type.match(/^image\//)) return;
      var url = URL.createObjectURL(file);
      loadBgFromUrl(url);
    }

    function prevent(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover", "dragleave", "drop"].forEach(function (ev) {
      wrap.addEventListener(ev, prevent);
    });
    wrap.addEventListener("drop", function (e) {
      overlay.classList.remove("drag-over");
      wrap.classList.remove("drag-over");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(f);
    });
    wrap.addEventListener("dragenter", function () {
      overlay.classList.add("drag-over");
      wrap.classList.add("drag-over");
    });
    wrap.addEventListener("dragleave", function () {
      overlay.classList.remove("drag-over");
      wrap.classList.remove("drag-over");
    });

    dropZone.addEventListener("click", function () { fileInput.click(); });
    dropZone.addEventListener("dragover", prevent);
    dropZone.addEventListener("drop", function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(f);
    });
    pickFile.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      handleFile(f);
      fileInput.value = "";
    });

    document.addEventListener("paste", function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          handleFile(items[i].getAsFile());
          break;
        }
      }
    });
  }

  function setupCanvasDragZoom() {
    var canvas = document.getElementById("previewCanvas");
    var lastX = 0, lastY = 0;
    var lastDist = 0, lastScale = 0;
    var pointers = [];

    function getDim() {
      return getDimensions(false);
    }

    function screenToLogic(sx, sy) {
      var rect = canvas.getBoundingClientRect();
      var dim = getDim();
      var scaleX = dim.w / rect.width;
      var scaleY = dim.h / rect.height;
      return {
        x: (sx - rect.left) * scaleX,
        y: (sy - rect.top) * scaleY,
      };
    }

    canvas.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.classList.add("dragging");
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mouseup", onMouseUp);
      canvas.addEventListener("mouseleave", onMouseUp);
    });

    function onMouseMove(e) {
      state.bgX += e.clientX - lastX;
      state.bgY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      document.getElementById("bgX").value = String(Math.round(state.bgX));
      document.getElementById("bgY").value = String(Math.round(state.bgY));
      updateUrl();
      renderPreview();
    }

    function onMouseUp() {
      canvas.classList.remove("dragging");
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
    }

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (!state.bgImage) return;
      var delta = e.deltaY > 0 ? -5 : 5;
      state.bgScale = Math.max(10, Math.min(500, state.bgScale + delta));
      document.getElementById("bgScale").value = String(Math.round(state.bgScale));
      updateUrl();
      renderPreview();
    }, { passive: false });

    canvas.addEventListener("touchstart", function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        pointers.push({ id: t.identifier, x: t.clientX, y: t.clientY });
      }
      if (pointers.length === 2) {
        lastDist = Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y);
        lastScale = state.bgScale;
      } else if (pointers.length === 1) {
        lastX = pointers[0].x;
        lastY = pointers[0].y;
      }
    }, { passive: false });

    canvas.addEventListener("touchmove", function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var p = pointers.find(function (x) { return x.id === t.identifier; });
        if (p) {
          p.x = t.clientX;
          p.y = t.clientY;
        }
      }
      if (pointers.length === 2) {
        var dist = Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y);
        var factor = dist / lastDist;
        state.bgScale = Math.max(10, Math.min(500, Math.round(lastScale * factor)));
        document.getElementById("bgScale").value = String(Math.round(state.bgScale));
      } else if (pointers.length === 1) {
        state.bgX += pointers[0].x - lastX;
        state.bgY += pointers[0].y - lastY;
        lastX = pointers[0].x;
        lastY = pointers[0].y;
        document.getElementById("bgX").value = String(Math.round(state.bgX));
        document.getElementById("bgY").value = String(Math.round(state.bgY));
      }
      updateUrl();
      renderPreview();
    }, { passive: false });

    canvas.addEventListener("touchend", function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        pointers = pointers.filter(function (p) { return p.id !== id; });
      }
    });
  }

  function setupDownload() {
    var btn = document.getElementById("downloadBtn");
    btn.addEventListener("click", function () {
      if (btn.classList.contains("loading")) return;
      btn.classList.add("loading");
      btn.disabled = true;
      btn.querySelector(".btn-text").hidden = true;
      btn.querySelector(".btn-loading").hidden = false;

      setTimeout(function () {
        var dim = getDimensions(true);
        var canvas = document.createElement("canvas");
        canvas.width = dim.w;
        canvas.height = dim.h;
        var ctx = canvas.getContext("2d", { alpha: true });
        ctx.clearRect(0, 0, dim.w, dim.h);
        drawCard(ctx, dim, true);
        canvas.toBlob(function (blob) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "image-" + state.size + ".png";
          a.click();
          URL.revokeObjectURL(a.href);
          btn.classList.remove("loading");
          btn.disabled = false;
          btn.querySelector(".btn-text").hidden = false;
          btn.querySelector(".btn-loading").hidden = true;
        }, "image/png");
      }, 50);
    });
  }

  function setupUrlLoad() {
    document.getElementById("loadUrl").addEventListener("click", function () {
      var url = document.getElementById("imageUrl").value.trim();
      if (url) loadBgFromUrl(url);
    });
  }

  document.getElementById("clearImage").addEventListener("click", clearBgImage);

  loadSvg("assets/logo.svg", function (t) {
    logoSvgText = t;
    renderPreview();
  });
  loadSvg("assets/pin.svg", function (t) {
    pinSvgText = t;
    renderPreview();
  });

  readUrl();
  bindInputs();
  initPresetColours();
  initPresetImages();
  initBgColorPicker();
  if (window.updateBgColorUI) window.updateBgColorUI();
  updateImageControlsVisibility();
  setupDragDrop();
  setupCanvasDragZoom();
  setupDownload();
  setupUrlLoad();
  updateClearButtonVisibility();

  var resizeObs = new ResizeObserver(function () { renderPreview(); });
  resizeObs.observe(document.getElementById("previewWrap"));
})();
