const canvas = document.getElementById("thumbnailCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  photoInput: document.getElementById("photoInput"),
  photoScale: document.getElementById("photoScale"),
  photoScaleNumber: document.getElementById("photoScaleNumber"),
  logoInput: document.getElementById("logoInput"),
  downloadBtn: document.getElementById("downloadBtn"),
  locationText: document.getElementById("locationText"),
  restaurantText: document.getElementById("restaurantText"),
  showLocationText: document.getElementById("showLocationText"),
  showRestaurantText: document.getElementById("showRestaurantText"),
  activeLayer: document.getElementById("activeLayer"),
  locationSize: document.getElementById("locationSize"),
  locationSizeNumber: document.getElementById("locationSizeNumber"),
  locationIconSize: document.getElementById("locationIconSize"),
  locationIconSizeNumber: document.getElementById("locationIconSizeNumber"),
  locationFillColor: document.getElementById("locationFillColor"),
  locationStrokeColor: document.getElementById("locationStrokeColor"),
  locationStrokeWidth: document.getElementById("locationStrokeWidth"),
  locationStrokeWidthNumber: document.getElementById("locationStrokeWidthNumber"),
  restaurantSize: document.getElementById("restaurantSize"),
  restaurantSizeNumber: document.getElementById("restaurantSizeNumber"),
  restaurantFillColor: document.getElementById("restaurantFillColor"),
  restaurantStrokeColor: document.getElementById("restaurantStrokeColor"),
  restaurantStrokeWidth: document.getElementById("restaurantStrokeWidth"),
  restaurantStrokeWidthNumber: document.getElementById("restaurantStrokeWidthNumber"),
  useLogo: document.getElementById("useLogo"),
  logoSize: document.getElementById("logoSize"),
  logoSizeNumber: document.getElementById("logoSizeNumber"),
  logoOpacity: document.getElementById("logoOpacity"),
  logoOpacityNumber: document.getElementById("logoOpacityNumber"),
  showBorder: document.getElementById("showBorder"),
  photoDim: document.getElementById("photoDim"),
  photoDimNumber: document.getElementById("photoDimNumber"),
};

const state = {
  photo: null,
  photoBox: { x: 0, y: 0, width: 800, height: 800, initialized: false },
  logo: null,
  dragging: null,
  pinching: null,
  resizing: null,
  dragOffset: { x: 0, y: 0 },
  location: { x: 500, y: 625, size: 44 },
  restaurant: { x: 415, y: 720, size: 82 },
  logoBox: { x: 58, y: 52, size: 205 },
  hitBoxes: {},
};

const uiFont = `"Pretendard Local", "Noto Sans KR Local", "Malgun Gothic", sans-serif`;
const locationFont = `"Pyeongtaek Anbo Local", "Gmarket Sans Local", "Noto Sans KR", "Malgun Gothic", sans-serif`;
const restaurantFont = `"RiaSans Local", "Gmarket Sans Local", "Noto Sans KR", "Malgun Gothic", sans-serif`;
const locationDotPath = new Path2D(
  "M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 256a64 64 0 1 1 0-128 64 64 0 1 1 0 128z"
);

const syncedRanges = [
  ["restaurantSize", "restaurantSizeNumber"],
  ["restaurantStrokeWidth", "restaurantStrokeWidthNumber"],
  ["locationSize", "locationSizeNumber"],
  ["locationStrokeWidth", "locationStrokeWidthNumber"],
  ["locationIconSize", "locationIconSizeNumber"],
  ["logoSize", "logoSizeNumber"],
  ["logoOpacity", "logoOpacityNumber"],
  ["photoDim", "photoDimNumber"],
  ["photoScale", "photoScaleNumber"],
];

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function syncRangeValue(source, target) {
  const min = Number(source.min || target.min || 0);
  const max = Number(source.max || target.max || 100);
  const nextValue = clampNumber(source.value, min, max);
  source.value = String(nextValue);
  target.value = String(nextValue);
}

function setRangePairValue(rangeControl, value) {
  const pair = syncedRanges.find(([rangeId]) => controls[rangeId] === rangeControl);
  if (!pair) {
    rangeControl.value = String(value);
    return;
  }

  const range = controls[pair[0]];
  const number = controls[pair[1]];
  range.value = String(value);
  syncRangeValue(range, number);
}

function setupSyncedRanges() {
  syncedRanges.forEach(([rangeId, numberId]) => {
    const range = controls[rangeId];
    const number = controls[numberId];
    if (!range || !number) return;
    let touchGuard = null;

    range.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      touchGuard = {
        startValue: range.value,
        startX: touch.clientX,
        startY: touch.clientY,
        allowChange: false,
      };
    }, { passive: true });

    range.addEventListener("touchmove", (event) => {
      if (!touchGuard) return;
      const touch = event.touches[0];
      const dx = Math.abs(touch.clientX - touchGuard.startX);
      const dy = Math.abs(touch.clientY - touchGuard.startY);
      touchGuard.allowChange = dx > 18 && dx > dy;
    }, { passive: true });

    range.addEventListener("touchend", () => {
      if (touchGuard && !touchGuard.allowChange) {
        range.value = touchGuard.startValue;
        syncRangeValue(range, number);
        render();
      }
      touchGuard = null;
    });

    range.addEventListener("input", () => {
      if (touchGuard && !touchGuard.allowChange) {
        range.value = touchGuard.startValue;
        syncRangeValue(range, number);
        render();
        return;
      }
      syncRangeValue(range, number);
      render();
    });
    number.addEventListener("input", () => {
      syncRangeValue(number, range);
      render();
    });
    number.addEventListener("change", () => {
      syncRangeValue(number, range);
      render();
    });
    syncRangeValue(range, number);
  });
}

function loadImageFromFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => callback(image);
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function drawCoverImage(image) {
  const baseScale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const scale = baseScale * (Number(controls.photoScale.value) / 100);
  const width = image.width * scale;
  const height = image.height * scale;

  if (!state.photoBox.initialized) {
    state.photoBox.x = (canvas.width - width) / 2;
    state.photoBox.y = (canvas.height - height) / 2;
    state.photoBox.initialized = true;
  } else if (state.photoBox.width !== width || state.photoBox.height !== height) {
    const centerX = state.photoBox.x + state.photoBox.width / 2;
    const centerY = state.photoBox.y + state.photoBox.height / 2;
    state.photoBox.x = centerX - width / 2;
    state.photoBox.y = centerY - height / 2;
  }

  state.photoBox.width = width;
  state.photoBox.height = height;
  constrainPhotoBox();
  ctx.drawImage(image, state.photoBox.x, state.photoBox.y, width, height);
}

function constrainPhotoBox() {
  // Keep uploaded photos freely draggable, even when the image is wider or taller than the canvas.
}

function drawPlaceholder() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#4a4239");
  gradient.addColorStop(.5, "#1f1f1f");
  gradient.addColorStop(1, "#7a3a22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.font = `800 30px ${uiFont}`;
  ctx.textAlign = "center";
  ctx.fillText("사진을 업로드하세요", canvas.width / 2, canvas.height / 2);
}

function drawRoughBorder() {
  if (!controls.showBorder.checked) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 244, 178, .88)";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(55, 41, 0, .18)";
  ctx.shadowBlur = 1;

  const left = 23;
  const top = 22;
  const right = canvas.width - 23;
  const bottom = canvas.height - 18;
  const radius = 34;

  drawCrayonRoundRect(left, top, right, bottom, radius);
  ctx.restore();
}

function drawCrayonRoundRect(left, top, right, bottom, radius) {
  const path = new Path2D();
  path.moveTo(left + radius, top);
  path.lineTo(right - radius, top);
  path.quadraticCurveTo(right, top, right, top + radius);
  path.lineTo(right, bottom - radius);
  path.quadraticCurveTo(right, bottom, right - radius, bottom);
  path.lineTo(left + radius, bottom);
  path.quadraticCurveTo(left, bottom, left, bottom - radius);
  path.lineTo(left, top + radius);
  path.quadraticCurveTo(left, top, left + radius, top);
  path.closePath();

  const points = sampleRoundRectPoints(left, top, right, bottom, radius, 620);

  ctx.save();
  ctx.strokeStyle = "rgba(244, 231, 154, .62)";
  ctx.lineWidth = 2.4;
  ctx.stroke(path);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 251, 198, .84)";
  ctx.lineWidth = 1.35;
  ctx.stroke(path);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255, 247, 185, .58)";
  ctx.lineWidth = .8;
  ctx.lineCap = "round";
  points.forEach((point, index) => {
    if (index % 5 !== 0) return;
    const next = points[(index + 1) % points.length];
    const angle = Math.atan2(next.y - point.y, next.x - point.x);
    const normal = angle + Math.PI / 2;
    const centerOffset = Math.sin(index * 2.71) * .55;
    const fuzz = .65 + (Math.sin(index * 8.31) + 1) * .35;
    ctx.beginPath();
    ctx.moveTo(
      point.x + Math.cos(normal) * (centerOffset - fuzz),
      point.y + Math.sin(normal) * (centerOffset - fuzz)
    );
    ctx.lineTo(
      point.x + Math.cos(normal) * (centerOffset + fuzz),
      point.y + Math.sin(normal) * (centerOffset + fuzz)
    );
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(218, 202, 118, .28)";
  ctx.lineWidth = .55;
  ctx.lineCap = "round";
  points.forEach((point, index) => {
    if (index % 7 !== 0) return;
    const next = points[(index + 1) % points.length];
    const angle = Math.atan2(next.y - point.y, next.x - point.x);
    const normal = angle + Math.PI / 2;
    const offset = Math.cos(index * 3.11) * .9;
    const length = 1.5 + (Math.sin(index * 1.37) + 1) * 1.1;
    ctx.beginPath();
    ctx.moveTo(
      point.x + Math.cos(normal) * offset - Math.cos(angle) * length,
      point.y + Math.sin(normal) * offset - Math.sin(angle) * length
    );
    ctx.lineTo(
      point.x + Math.cos(normal) * offset + Math.cos(angle) * length,
      point.y + Math.sin(normal) * offset + Math.sin(angle) * length
    );
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 219, .42)";
  points.forEach((point, index) => {
    if (index % 8 !== 0) return;
    const dx = Math.sin(index * 2.19) * .9;
    const dy = Math.cos(index * 1.61) * .9;
    const size = .28 + (Math.sin(index * .77) + 1) * .16;
    ctx.beginPath();
    ctx.arc(point.x + dx, point.y + dy, size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function sampleRoundRectPoints(left, top, right, bottom, radius, count) {
  const points = [];
  const width = right - left;
  const height = bottom - top;
  const straightW = width - radius * 2;
  const straightH = height - radius * 2;
  const corner = Math.PI * radius / 2;
  const perimeter = straightW * 2 + straightH * 2 + corner * 4;

  for (let i = 0; i < count; i += 1) {
    let d = (perimeter * i) / count;
    if (d < straightW) {
      points.push({ x: left + radius + d, y: top });
    } else if ((d -= straightW) < corner) {
      const a = -Math.PI / 2 + d / radius;
      points.push({ x: right - radius + Math.cos(a) * radius, y: top + radius + Math.sin(a) * radius });
    } else if ((d -= corner) < straightH) {
      points.push({ x: right, y: top + radius + d });
    } else if ((d -= straightH) < corner) {
      const a = d / radius;
      points.push({ x: right - radius + Math.cos(a) * radius, y: bottom - radius + Math.sin(a) * radius });
    } else if ((d -= corner) < straightW) {
      points.push({ x: right - radius - d, y: bottom });
    } else if ((d -= straightW) < corner) {
      const a = Math.PI / 2 + d / radius;
      points.push({ x: left + radius + Math.cos(a) * radius, y: bottom - radius + Math.sin(a) * radius });
    } else if ((d -= corner) < straightH) {
      points.push({ x: left, y: bottom - radius - d });
    } else {
      d -= straightH;
      const a = Math.PI + d / radius;
      points.push({ x: left + radius + Math.cos(a) * radius, y: top + radius + Math.sin(a) * radius });
    }
  }

  return points;
}

function drawPin(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * .2, scale * .2);

  ctx.fillStyle = "rgba(0, 76, 177, .82)";
  ctx.beginPath();
  ctx.ellipse(246, 402, 86, 44, -.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff1135";
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 18;
  ctx.stroke(locationDotPath);
  ctx.fill(locationDotPath);
  ctx.restore();
}

function drawStackedText(text, x, y, size, options) {
  const {
    fill,
    outerStroke,
    outerWidth,
    innerStroke = null,
    innerWidth = 0,
    fontFamily = uiFont,
    fontWeight = 900,
    letterSpacing = 0,
  } = options;

  ctx.save();
  ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.miterLimit = 1.8;

  ctx.strokeStyle = outerStroke;
  ctx.lineWidth = outerWidth;
  drawTextWithSpacing(ctx.strokeText.bind(ctx), text, x, y, letterSpacing);

  if (innerStroke && innerWidth) {
    ctx.strokeStyle = innerStroke;
    ctx.lineWidth = innerWidth;
    drawTextWithSpacing(ctx.strokeText.bind(ctx), text, x, y, letterSpacing);
  }

  ctx.fillStyle = fill;
  drawTextWithSpacing(ctx.fillText.bind(ctx), text, x, y, letterSpacing);
  const metrics = measureTextWithSpacing(text, letterSpacing);
  const top = metrics.ascent || size;
  const bottom = metrics.descent || size * .18;
  ctx.restore();

  return {
    x: x - outerWidth,
    y: y - top - outerWidth,
    width: metrics.width + outerWidth * 2,
    height: top + bottom + outerWidth * 2,
  };
}

function drawTextWithSpacing(drawFn, text, x, y, spacing) {
  let cursor = x;
  [...text].forEach((char, index) => {
    drawFn(char, cursor, y);
    cursor += ctx.measureText(char).width + (index < [...text].length - 1 ? spacing : 0);
  });
}

function measureTextWithSpacing(text, spacing) {
  const chars = [...text];
  const metrics = chars.map((char) => ctx.measureText(char));
  const width = metrics.reduce((sum, metric) => sum + metric.width, 0) + Math.max(0, chars.length - 1) * spacing;
  return {
    width,
    ascent: Math.max(...metrics.map((metric) => metric.actualBoundingBoxAscent || 0)),
    descent: Math.max(...metrics.map((metric) => metric.actualBoundingBoxDescent || 0)),
  };
}

function joinBoxes(boxes) {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  const x1 = Math.min(...valid.map((box) => box.x));
  const y1 = Math.min(...valid.map((box) => box.y));
  const x2 = Math.max(...valid.map((box) => box.x + box.width));
  const y2 = Math.max(...valid.map((box) => box.y + box.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function drawLogo() {
  if (!controls.useLogo.checked || !state.logo) return null;
  const size = Number(controls.logoSize.value);
  const ratio = state.logo.width / state.logo.height;
  const width = ratio >= 1 ? size : size * ratio;
  const height = ratio >= 1 ? size / ratio : size;
  state.logoBox.size = size;

  ctx.save();
  ctx.globalAlpha = Number(controls.logoOpacity.value) / 100;
  ctx.drawImage(state.logo, state.logoBox.x, state.logoBox.y, width, height);
  ctx.restore();

  return { x: state.logoBox.x, y: state.logoBox.y, width, height };
}

function drawSelectionBox(box) {
  if (!box) return;
  const padding = 8;
  const x = box.x - padding;
  const y = box.y - padding;
  const width = box.width + padding * 2;
  const height = box.height + padding * 2;

  ctx.save();
  ctx.strokeStyle = "#2f80ff";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2f80ff";
  [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawPhotoSelectionGrid() {
  if (!state.photo) return;
  const x = state.photoBox.x;
  const y = state.photoBox.y;
  const width = state.photoBox.width;
  const height = state.photoBox.height;
  const columns = 4;
  const rows = 4;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.clip();
  ctx.strokeStyle = "rgba(47, 128, 255, .82)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  ctx.strokeStyle = "rgba(47, 128, 255, .46)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < columns; i += 1) {
    const lineX = x + (width / columns) * i;
    ctx.beginPath();
    ctx.moveTo(lineX, y);
    ctx.lineTo(lineX, y + height);
    ctx.stroke();
  }

  for (let i = 1; i < rows; i += 1) {
    const lineY = y + (height / rows) * i;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + width, lineY);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2f80ff";
  [
    [x, y],
    [x + width, y],
    [x, y + height],
    [x + width, y + height],
  ].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function render(options = {}) {
  const showSelection = options.showSelection !== false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.photo ? drawCoverImage(state.photo) : drawPlaceholder();

  const dim = Number(controls.photoDim.value) / 100;
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${dim})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawRoughBorder();
  state.hitBoxes.photo = state.photo
    ? { x: state.photoBox.x, y: state.photoBox.y, width: state.photoBox.width, height: state.photoBox.height }
    : { x: 0, y: 0, width: canvas.width, height: canvas.height };
  state.hitBoxes.logo = drawLogo();

  state.location.size = Number(controls.locationSize.value);
  state.restaurant.size = Number(controls.restaurantSize.value);
  state.hitBoxes.location = null;
  state.hitBoxes.restaurant = null;

  const locationText = controls.locationText.value.trim() || "상봉역 맛집";
  const restaurantText = controls.restaurantText.value.trim() || "함평국밥";

  if (controls.showLocationText.checked) {
    const pinScale = Number(controls.locationIconSize.value) / 43;
    const pinBox = {
      x: state.location.x - 64 * pinScale,
      y: state.location.y - 60 * pinScale,
      width: 55 * pinScale,
      height: 76 * pinScale,
    };
    drawPin(state.location.x - 64 * pinScale, state.location.y - 60 * pinScale, .72 * pinScale);
    const locationBox = drawStackedText(
      locationText,
      state.location.x,
      state.location.y,
      state.location.size,
      {
        fill: controls.locationFillColor.value,
        outerStroke: controls.locationStrokeColor.value,
        outerWidth: Number(controls.locationStrokeWidth.value),
        fontFamily: locationFont,
        fontWeight: 400,
        letterSpacing: 3,
      }
    );
    state.hitBoxes.location = joinBoxes([pinBox, locationBox]);
  }

  if (controls.showRestaurantText.checked) {
    state.hitBoxes.restaurant = drawStackedText(
      restaurantText,
      state.restaurant.x,
      state.restaurant.y,
      state.restaurant.size,
      {
        fill: controls.restaurantFillColor.value,
        outerStroke: controls.restaurantStrokeColor.value,
        outerWidth: Number(controls.restaurantStrokeWidth.value),
        fontFamily: restaurantFont,
        fontWeight: 700,
        letterSpacing: 2,
      }
    );
  }

  if (showSelection && controls.activeLayer.value === "photo") {
    drawPhotoSelectionGrid();
  } else if (showSelection && ["location", "restaurant", "logo"].includes(controls.activeLayer.value)) {
    drawSelectionBox(state.hitBoxes[controls.activeLayer.value]);
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const pointer = event.touches ? event.touches[0] : event;
  return {
    x: (pointer.clientX - rect.left) * (canvas.width / rect.width),
    y: (pointer.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function touchPoint(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (canvas.width / rect.width),
    y: (touch.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function midpointFromTouches(touches) {
  const first = touchPoint(touches[0]);
  const second = touchPoint(touches[1]);
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function distanceFromTouches(touches) {
  const first = touchPoint(touches[0]);
  const second = touchPoint(touches[1]);
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function sizeControlForLayer(layer) {
  if (layer === "photo") return controls.photoScale;
  if (layer === "location") return controls.locationSize;
  if (layer === "restaurant") return controls.restaurantSize;
  if (layer === "logo") return controls.logoSize;
  return null;
}

function hitTest(point) {
  const activeLayer = controls.activeLayer.value;
  const order = [
    ...(activeLayer !== "photo" ? [activeLayer] : []),
    "restaurant",
    "location",
    "logo",
    "photo",
  ];
  for (const key of [...new Set(order)]) {
    const box = state.hitBoxes[key];
    if (!box) continue;
    if (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    ) {
      return key;
    }
  }
  return controls.activeLayer.value;
}

function resizeHandleHitTest(point) {
  const layer = controls.activeLayer.value;
  if (!["photo", "location", "restaurant", "logo"].includes(layer)) return null;

  const box = state.hitBoxes[layer];
  if (!box) return null;

  const padding = 8;
  const handles = [
    { name: "nw", x: box.x - padding, y: box.y - padding },
    { name: "ne", x: box.x + box.width + padding, y: box.y - padding },
    { name: "sw", x: box.x - padding, y: box.y + box.height + padding },
    { name: "se", x: box.x + box.width + padding, y: box.y + box.height + padding },
  ];

  const hit = handles.find((handle) => Math.hypot(point.x - handle.x, point.y - handle.y) <= 14);
  return hit ? { layer, handle: hit.name, box } : null;
}

function layerPosition(layer) {
  if (layer === "photo") return state.photoBox;
  if (layer === "logo") return state.logoBox;
  return state[layer];
}

function startDrag(event) {
  event.preventDefault();
  if (event.touches && event.touches.length >= 2) {
    const point = midpointFromTouches(event.touches);
    const layer = hitTest(point);
    const sizeControl = sizeControlForLayer(layer);
    if (!sizeControl) return;

    state.dragging = null;
    state.pinching = {
      layer,
      startDistance: distanceFromTouches(event.touches),
      startSize: Number(sizeControl.value),
    };
    controls.activeLayer.value = layer;
    render();
    return;
  }

  const point = canvasPoint(event);
  const resizeHit = resizeHandleHitTest(point);
  if (resizeHit) {
    const sizeControl = sizeControlForLayer(resizeHit.layer);
    const center = {
      x: resizeHit.box.x + resizeHit.box.width / 2,
      y: resizeHit.box.y + resizeHit.box.height / 2,
    };
    state.dragging = null;
    state.resizing = {
      layer: resizeHit.layer,
      center,
      startDistance: Math.max(1, Math.hypot(point.x - center.x, point.y - center.y)),
      startSize: Number(sizeControl.value),
    };
    controls.activeLayer.value = resizeHit.layer;
    render();
    return;
  }

  const layer = hitTest(point);
  const target = layerPosition(layer);
  state.dragging = layer;
  state.dragOffset.x = point.x - target.x;
  state.dragOffset.y = point.y - target.y;
  controls.activeLayer.value = layer;
  render();
}

function moveDrag(event) {
  if (state.resizing) {
    event.preventDefault();
    const point = canvasPoint(event);
    const sizeControl = sizeControlForLayer(state.resizing.layer);
    const distance = Math.max(1, Math.hypot(point.x - state.resizing.center.x, point.y - state.resizing.center.y));
    const scale = distance / state.resizing.startDistance;
    const nextSize = Math.max(
      Number(sizeControl.min),
      Math.min(Number(sizeControl.max), Math.round(state.resizing.startSize * scale))
    );
    setRangePairValue(sizeControl, nextSize);
    render();
    return;
  }

  if (state.pinching && event.touches && event.touches.length >= 2) {
    event.preventDefault();
    const sizeControl = sizeControlForLayer(state.pinching.layer);
    if (!sizeControl) return;

    const scale = distanceFromTouches(event.touches) / state.pinching.startDistance;
    const nextSize = Math.max(
      Number(sizeControl.min),
      Math.min(Number(sizeControl.max), Math.round(state.pinching.startSize * scale))
    );
    setRangePairValue(sizeControl, nextSize);
    render();
    return;
  }

  if (!state.dragging) return;
  event.preventDefault();
  const point = canvasPoint(event);
  const target = layerPosition(state.dragging);
  target.x = Math.max(0, Math.min(canvas.width, point.x - state.dragOffset.x));
  target.y = Math.max(0, Math.min(canvas.height, point.y - state.dragOffset.y));
  if (state.dragging === "photo") {
    target.x = point.x - state.dragOffset.x;
    target.y = point.y - state.dragOffset.y;
    constrainPhotoBox();
  }
  render();
}

function endDrag() {
  state.dragging = null;
  state.pinching = null;
  state.resizing = null;
}

function updateCanvasCursor(event) {
  if (state.dragging || state.resizing) return;
  const point = canvasPoint(event);
  if (resizeHandleHitTest(point)) {
    canvas.style.cursor = "nwse-resize";
    return;
  }
  const layer = hitTest(point);
  canvas.style.cursor = ["location", "restaurant", "logo"].includes(layer) ? "grab" : "default";
}

function downloadImage() {
  render({ showSelection: false });
  try {
    const link = document.createElement("a");
    link.download = "thumbnail.png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    alert("다운로드가 막혔습니다. 로고 파일을 직접 선택한 뒤 다시 시도해 주세요.");
  }
  render();
}

function preloadLogo() {
  const image = new Image();
  image.onload = () => {
    state.logo = image;
    render();
  };
  image.onerror = () => render();
  image.src = window.DEFAULT_LOGO_DATA_URL || "mg_logo.png";
}

controls.photoInput.addEventListener("change", (event) => {
  loadImageFromFile(event.target.files[0], (image) => {
    state.photo = image;
    state.photoBox.initialized = false;
    render();
  });
});

controls.logoInput.addEventListener("change", (event) => {
  loadImageFromFile(event.target.files[0], (image) => {
    state.logo = image;
    controls.useLogo.checked = true;
    render();
  });
});

[
  controls.locationText,
  controls.restaurantText,
  controls.showLocationText,
  controls.showRestaurantText,
  controls.activeLayer,
  controls.locationFillColor,
  controls.locationStrokeColor,
  controls.restaurantFillColor,
  controls.restaurantStrokeColor,
  controls.useLogo,
  controls.showBorder,
].forEach((control) => control.addEventListener("input", render));

setupSyncedRanges();
controls.downloadBtn.addEventListener("click", downloadImage);
canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("mousemove", moveDrag);
canvas.addEventListener("mousemove", updateCanvasCursor);
window.addEventListener("mouseup", endDrag);
canvas.addEventListener("touchstart", startDrag, { passive: false });
canvas.addEventListener("touchmove", moveDrag, { passive: false });
window.addEventListener("touchend", endDrag);

preloadLogo();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(render);
} else {
  render();
}
