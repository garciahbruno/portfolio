import { HOLD_IMAGES } from "./hold-images.js";

const gridRoot = document.getElementById("infinite-grid");

if (!gridRoot) {
  throw new Error("Grid root not found.");
}

const resolvedImages = HOLD_IMAGES.filter((item) => item && item.src).map((item) => ({
  src: item.src,
  srcEscaped: item.src.replaceAll('"', "\\\""),
  hueBin: Number.isFinite(item.hueBin) ? positiveMod(Math.round(item.hueBin), 12) : 0,
  saturation: Number.isFinite(item.saturation) ? clamp(item.saturation, 0, 1) : 0.5,
  scale: Number.isFinite(item.scale) ? clamp(item.scale, 0.48, 1.12) : 1,
  quality: Number.isFinite(item.quality) ? clamp(item.quality, 0, 1) : 0.75,
}));

if (resolvedImages.length === 0) {
  throw new Error("No hold images configured. Populate hold-images.js.");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const physics = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  pointerX: window.innerWidth * 0.5,
  pointerY: window.innerHeight * 0.5,
  dragging: false,
  lastDragX: 0,
  lastDragY: 0,
  lastDragTime: 0,
  frameTime: performance.now(),
};

const tuning = {
  gap: 28,
  overscan: 3,
  friction: 0.905,
  maxVelocity: 56,
  wheelX: 0.16,
  wheelY: 1.0,
  wheelDrift: 0.04,
  keyNudge: 10,
};

let overlayOpen = false;
let tiles = [];
let tileSize = 228;
let pitchX = 256;
let pitchY = 256;

const assignmentCache = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positiveMod(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function hash2(x, y) {
  const result = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return result - Math.floor(result);
}

function keyFor(col, row) {
  return `${col},${row}`;
}

function isNeutral(hold) {
  return hold.saturation < 0.14;
}

function hueDistance(binA, binB) {
  const raw = Math.abs(binA - binB);
  return Math.min(raw, 12 - raw);
}

function sameColorFamily(a, b) {
  if (!a || !b) {
    return false;
  }

  if (isNeutral(a) || isNeutral(b)) {
    return isNeutral(a) && isNeutral(b);
  }

  return hueDistance(a.hueBin, b.hueBin) <= 1;
}

function selectImageId(worldCol, worldRow, leftId, topId) {
  const left = Number.isInteger(leftId) ? resolvedImages[leftId] : null;
  const top = Number.isInteger(topId) ? resolvedImages[topId] : null;

  let bestScore = -Infinity;
  let bestIds = [];

  for (let index = 0; index < resolvedImages.length; index += 1) {
    const hold = resolvedImages[index];

    let score = hash2(worldCol * 0.77 + index * 0.31, worldRow * 0.91 - index * 0.27);
    score += hold.quality * 0.15;

    if (leftId === index) {
      score -= 8;
    }
    if (topId === index) {
      score -= 8;
    }

    if (left && sameColorFamily(hold, left)) {
      score -= 5.6;
    }
    if (top && sameColorFamily(hold, top)) {
      score -= 5.6;
    }

    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestIds = [index];
      continue;
    }

    if (Math.abs(score - bestScore) <= 0.08) {
      bestIds.push(index);
    }
  }

  const tieSeed = (Math.imul(worldCol, 374761393) ^ Math.imul(worldRow, 668265263)) >>> 0;
  return bestIds[positiveMod(tieSeed, bestIds.length)];
}

function resolveImageId(worldCol, worldRow, frameAssignments) {
  const key = keyFor(worldCol, worldRow);
  const cachedId = assignmentCache.get(key);

  if (Number.isInteger(cachedId)) {
    frameAssignments.set(key, cachedId);
    return cachedId;
  }

  const leftKey = keyFor(worldCol - 1, worldRow);
  const topKey = keyFor(worldCol, worldRow - 1);

  const leftId =
    frameAssignments.get(leftKey) !== undefined
      ? frameAssignments.get(leftKey)
      : assignmentCache.get(leftKey);

  const topId =
    frameAssignments.get(topKey) !== undefined
      ? frameAssignments.get(topKey)
      : assignmentCache.get(topKey);

  const nextId = selectImageId(worldCol, worldRow, leftId, topId);
  assignmentCache.set(key, nextId);
  frameAssignments.set(key, nextId);

  return nextId;
}

function readTileSize() {
  const css = window.getComputedStyle(document.documentElement);
  tileSize = Number.parseFloat(css.getPropertyValue("--tile-size")) || 228;
  pitchX = tileSize + tuning.gap;
  pitchY = tileSize + tuning.gap;
}

function buildGrid() {
  readTileSize();

  const visibleCols = Math.ceil(window.innerWidth / pitchX);
  const visibleRows = Math.ceil(window.innerHeight / pitchY);

  gridRoot.replaceChildren();
  tiles = [];

  for (
    let row = -tuning.overscan;
    row <= visibleRows + tuning.overscan;
    row += 1
  ) {
    for (
      let col = -tuning.overscan;
      col <= visibleCols + tuning.overscan;
      col += 1
    ) {
      const tile = document.createElement("div");
      tile.className = "grid-tile";
      tile.style.width = `${tileSize}px`;
      tile.style.height = `${tileSize}px`;

      const media = document.createElement("div");
      media.className = "tile-image";
      media.setAttribute("aria-hidden", "true");
      tile.appendChild(media);
      gridRoot.appendChild(tile);

      const spin = (hash2(col * 1.7, row * 2.1) - 0.5) * 10.2;
      const scale = 0.9 + hash2(col * 2.9, row * 3.7) * 0.16;
      const lift = hash2(col * 7.3, row * 4.9) * 6;

      tiles.push({
        element: tile,
        media,
        baseCol: col,
        baseRow: row,
        spin,
        scale,
        lift,
        imageId: -1,
        imageScale: -1,
      });
    }
  }
}

function clampVelocity() {
  physics.vx = clamp(physics.vx, -tuning.maxVelocity, tuning.maxVelocity);
  physics.vy = clamp(physics.vy, -tuning.maxVelocity, tuning.maxVelocity);
}

function setImageForTile(tile, worldCol, worldRow, frameAssignments) {
  const imageId = resolveImageId(worldCol, worldRow, frameAssignments);
  const hold = resolvedImages[imageId];

  if (imageId !== tile.imageId) {
    tile.media.style.backgroundImage = `url("${hold.srcEscaped}")`;
    tile.imageId = imageId;
  }

  if (tile.imageScale !== hold.scale) {
    tile.media.style.transform = `translateZ(18px) scale(${hold.scale.toFixed(3)})`;
    tile.imageScale = hold.scale;
  }
}

function renderGrid() {
  const colShift = Math.floor(physics.x / pitchX);
  const rowShift = Math.floor(physics.y / pitchY);
  const fracX = physics.x - colShift * pitchX;
  const fracY = physics.y - rowShift * pitchY;
  const centerX = window.innerWidth * 0.5;
  const centerY = window.innerHeight * 0.5;
  const range = Math.max(window.innerWidth, window.innerHeight);
  const velocitySpin = clamp(physics.vx * 0.012 + physics.vy * 0.009, -7.5, 7.5);

  const frameAssignments = new Map();

  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i];
    const x = tile.baseCol * pitchX - fracX;
    const y = tile.baseRow * pitchY - fracY;
    const worldCol = tile.baseCol + colShift;
    const worldRow = tile.baseRow + rowShift;

    setImageForTile(tile, worldCol, worldRow, frameAssignments);

    const itemCenterX = x + tileSize * 0.5;
    const itemCenterY = y + tileSize * 0.5;
    const pointerDx = (physics.pointerX - itemCenterX) / window.innerWidth;
    const pointerDy = (physics.pointerY - itemCenterY) / window.innerHeight;
    const tiltX = clamp(-pointerDy * 8, -6, 6);
    const tiltY = clamp(pointerDx * 8, -6, 6);

    const distance = Math.hypot(itemCenterX - centerX, itemCenterY - centerY);
    const proximity = clamp(1 - distance / range, 0, 1);
    const scale = tile.scale + proximity * 0.06;
    const z = (proximity * 22 + tile.lift).toFixed(2);
    const spin = (tile.spin + velocitySpin).toFixed(2);

    if (reducedMotion.matches) {
      tile.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(
        2,
      )}px, ${z}px) rotate(${spin}deg) scale(${scale.toFixed(3)})`;
    } else {
      tile.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(
        2,
      )}px, ${z}px) rotate(${spin}deg) rotateX(${tiltX.toFixed(
        2,
      )}deg) rotateY(${tiltY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }
  }
}

function animationFrame(now) {
  const dt = clamp((now - physics.frameTime) / 16.6667, 0.2, 2.7);
  physics.frameTime = now;

  if (overlayOpen) {
    if (Math.abs(physics.vx) > 0.02 || Math.abs(physics.vy) > 0.02) {
      const damp = Math.pow(0.65, dt);
      physics.vx *= damp;
      physics.vy *= damp;
      physics.x += physics.vx * dt;
      physics.y += physics.vy * dt;
      renderGrid();
    }

    requestAnimationFrame(animationFrame);
    return;
  }

  if (!reducedMotion.matches && !physics.dragging) {
    const damp = Math.pow(tuning.friction, dt);
    physics.vx *= damp;
    physics.vy *= damp;
  }

  physics.x += physics.vx * dt;
  physics.y += physics.vy * dt;

  renderGrid();
  requestAnimationFrame(animationFrame);
}

function onWheel(event) {
  if (overlayOpen) {
    return;
  }

  event.preventDefault();

  const modeScale =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 18
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1;

  const deltaX = event.deltaX * modeScale;
  const deltaY = event.deltaY * modeScale;

  const verticalIntent = deltaY;
  const horizontalIntent = deltaX + (event.shiftKey ? deltaY : 0);

  if (reducedMotion.matches) {
    physics.x += horizontalIntent * tuning.wheelX + verticalIntent * tuning.wheelDrift;
    physics.y += verticalIntent * tuning.wheelY;
    renderGrid();
    return;
  }

  physics.vx += horizontalIntent * tuning.wheelX + verticalIntent * tuning.wheelDrift;
  physics.vy += verticalIntent * tuning.wheelY;
  clampVelocity();
}

function onPointerDown(event) {
  if (overlayOpen) {
    return;
  }

  if (event.button !== 0) {
    return;
  }

  if (event.target.closest("a, button, input, textarea, select, summary")) {
    return;
  }

  physics.dragging = true;
  physics.lastDragX = event.clientX;
  physics.lastDragY = event.clientY;
  physics.lastDragTime = performance.now();
  document.body.classList.add("dragging");
}

function onPointerMove(event) {
  physics.pointerX = event.clientX;
  physics.pointerY = event.clientY;

  if (!physics.dragging) {
    return;
  }

  const now = performance.now();
  const dt = Math.max(10, now - physics.lastDragTime);
  const dx = event.clientX - physics.lastDragX;
  const dy = event.clientY - physics.lastDragY;

  physics.x -= dx;
  physics.y -= dy;
  physics.vx = (-dx / dt) * 16;
  physics.vy = (-dy / dt) * 16;
  clampVelocity();

  physics.lastDragX = event.clientX;
  physics.lastDragY = event.clientY;
  physics.lastDragTime = now;
}

function stopDragging() {
  physics.dragging = false;
  document.body.classList.remove("dragging");
}

function onKeyDown(event) {
  if (overlayOpen) {
    return;
  }

  let handled = true;

  switch (event.key) {
    case "ArrowUp":
      physics.vy -= tuning.keyNudge;
      break;
    case "ArrowDown":
      physics.vy += tuning.keyNudge;
      break;
    case "ArrowLeft":
      physics.vx -= tuning.keyNudge;
      break;
    case "ArrowRight":
      physics.vx += tuning.keyNudge;
      break;
    case "PageUp":
      physics.vy -= tuning.keyNudge * 2;
      break;
    case "PageDown":
      physics.vy += tuning.keyNudge * 2;
      break;
    default:
      handled = false;
      break;
  }

  if (handled) {
    event.preventDefault();
    clampVelocity();
  }
}

function onResize() {
  buildGrid();
  renderGrid();
}

window.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", stopDragging);
window.addEventListener("pointercancel", stopDragging);
window.addEventListener("mouseleave", stopDragging);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", onResize);

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    physics.vx = 0;
    physics.vy = 0;
  }
});

buildGrid();
renderGrid();
requestAnimationFrame(animationFrame);

const menuOverlay = document.getElementById("menu-overlay");
const menuTriggers = Array.from(document.querySelectorAll(".menu-trigger"));
const menuPanels = Array.from(document.querySelectorAll(".mega-panel"));

let activeMenuId = null;

function createPanelDetailPopover(panel) {
  const lineContainer = panel.querySelector(".mega-lines");
  if (lineContainer) {
    lineContainer.removeAttribute("aria-hidden");
  }

  const lines = Array.from(panel.querySelectorAll(".mega-line"));
  const cards = Array.from(panel.querySelectorAll(".footer-col"));

  if (lines.length === 0 || cards.length === 0) {
    return null;
  }

  const details = cards.map((card) => ({
    title: card.querySelector(".footer-title")?.textContent?.trim() || "",
    meta: card.querySelector(".footer-meta")?.textContent?.trim() || "",
    copy: card.querySelector(".footer-copy")?.textContent?.trim() || "",
    points: Array.from(card.querySelectorAll(".footer-more li"))
      .map((item) => item.textContent?.trim() || "")
      .filter(Boolean),
  }));

  const popover = document.createElement("aside");
  popover.className = "line-detail-popover";
  popover.setAttribute("aria-hidden", "true");

  const title = document.createElement("p");
  title.className = "detail-title";

  const meta = document.createElement("p");
  meta.className = "detail-meta";

  const copy = document.createElement("p");
  copy.className = "detail-copy";

  const points = document.createElement("ul");
  points.className = "detail-points";

  popover.append(title, meta, copy, points);
  panel.appendChild(popover);

  let activeIndex = -1;
  let popoverAnimation = null;

  function animatePopover(fromClosed) {
    if (reducedMotion.matches || !popover.animate) {
      return;
    }

    if (popoverAnimation) {
      popoverAnimation.cancel();
    }

    const keyframes = fromClosed
      ? [
          { opacity: 0, transform: "translate3d(42px, 32px, 0) scale(0.7)" },
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ]
      : [
          { opacity: 0.7, transform: "translate3d(24px, 8px, 0) scale(0.92)" },
          { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        ];

    popoverAnimation = popover.animate(keyframes, {
      duration: fromClosed ? 640 : 460,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "both",
    });
  }

  function applyDetail(detail) {
    title.textContent = detail.title;
    meta.textContent = detail.meta;
    copy.textContent = detail.copy;

    points.replaceChildren();
    for (let i = 0; i < detail.points.length; i += 1) {
      const bullet = document.createElement("li");
      bullet.textContent = detail.points[i];
      points.appendChild(bullet);
    }
  }

  function placePopover(line, pointerClientX = null, pointerClientY = null) {
    const panelRect = panel.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth || 420;
    const popoverHeight = popover.offsetHeight || 320;

    const fallbackCenterY = lineRect.top - panelRect.top + lineRect.height * 0.52;
    const pointerCenterY =
      Number.isFinite(pointerClientY) ? pointerClientY - panelRect.top : fallbackCenterY;

    const preferredTop = pointerCenterY - popoverHeight * 0.5;
    const minTop = 88;
    const maxTop = Math.max(minTop, panelRect.height - popoverHeight - 26);
    const top = clamp(preferredTop, minTop, maxTop);

    const lineLeft = lineRect.left - panelRect.left;
    const lineRight = lineRect.right - panelRect.left;
    const pointerX = Number.isFinite(pointerClientX)
      ? pointerClientX - panelRect.left
      : lineLeft + lineRect.width * 0.5;

    const normalized = clamp((pointerX - lineLeft) / Math.max(1, lineRight - lineLeft), 0, 1);

    // Follow cursor freely across text while keeping the box to the right of pointer.
    const offsetX = 52;
    const floatLeft = pointerX + offsetX + (normalized - 0.5) * 24;
    const minLeft = 18;
    const maxLeft = Math.max(minLeft, panelRect.width - popoverWidth - 18);
    const left = clamp(floatLeft, minLeft, maxLeft);

    popover.style.left = `${left.toFixed(2)}px`;
    popover.style.right = "auto";
    popover.style.top = `${top.toFixed(2)}px`;
  }

  function setActive(nextIndex, pointerClientX = null, pointerClientY = null) {
    if (nextIndex === activeIndex) {
      if (nextIndex >= 0 && lines[nextIndex]) {
        placePopover(lines[nextIndex], pointerClientX, pointerClientY);
      }
      return;
    }

    const previousIndex = activeIndex;
    activeIndex = nextIndex;

    for (let i = 0; i < lines.length; i += 1) {
      lines[i].classList.toggle("active-detail", i === activeIndex);
    }

    if (activeIndex < 0) {
      if (popoverAnimation) {
        popoverAnimation.cancel();
      }

      popover.classList.remove("active");
      popover.setAttribute("aria-hidden", "true");
      return;
    }

    const detail = details[Math.min(activeIndex, details.length - 1)];
    applyDetail(detail);
    placePopover(lines[activeIndex], pointerClientX, pointerClientY);
    popover.classList.add("active");
    popover.setAttribute("aria-hidden", "false");
    animatePopover(previousIndex < 0);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line.hasAttribute("tabindex")) {
      line.tabIndex = 0;
    }

    line.addEventListener("mouseenter", (event) => {
      setActive(i, event.clientX, event.clientY);
    });

    line.addEventListener("mousemove", (event) => {
      if (activeIndex !== i) {
        setActive(i, event.clientX, event.clientY);
        return;
      }

      placePopover(line, event.clientX, event.clientY);
    });

    line.addEventListener("focus", () => {
      setActive(i);
    });
  }

  panel.addEventListener("mousemove", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const hoveredLine = target.closest(".mega-line");
    if (!hoveredLine || !panel.contains(hoveredLine)) {
      if (activeIndex >= 0) {
        setActive(-1);
      }
      return;
    }

    const index = lines.indexOf(hoveredLine);
    if (index < 0) {
      if (activeIndex >= 0) {
        setActive(-1);
      }
      return;
    }

    if (activeIndex !== index) {
      setActive(index, event.clientX, event.clientY);
      return;
    }

    placePopover(hoveredLine, event.clientX, event.clientY);
  });

  panel.addEventListener("mouseleave", () => {
    setActive(-1);
  });

  document.addEventListener("mousemove", (event) => {
    if (!panel.classList.contains("active")) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      if (activeIndex >= 0) {
        setActive(-1);
      }
      return;
    }

    const hoveredLine = target.closest(".mega-line");
    if (!hoveredLine || !panel.contains(hoveredLine)) {
      if (activeIndex >= 0) {
        setActive(-1);
      }
    }
  });

  panel.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (!(next instanceof Element) || !panel.contains(next)) {
      setActive(-1);
    }
  });

  return {
    panel,
    clear() {
      setActive(-1);
    },
    refresh() {
      if (activeIndex >= 0 && lines[activeIndex]) {
        placePopover(lines[activeIndex], null, null);
      }
    },
  };
}

const panelDetailControllers = menuPanels
  .map((panel) => createPanelDetailPopover(panel))
  .filter(Boolean);

function setMenuState(nextMenuId) {
  activeMenuId = nextMenuId;

  for (let i = 0; i < menuTriggers.length; i += 1) {
    const trigger = menuTriggers[i];
    const isActive = trigger.dataset.menuTarget === activeMenuId;
    trigger.setAttribute("aria-expanded", isActive ? "true" : "false");
  }

  for (let i = 0; i < menuPanels.length; i += 1) {
    const panel = menuPanels[i];
    const isActive = panel.dataset.menuPanel === activeMenuId;
    panel.classList.toggle("active", isActive);
  }

  for (let i = 0; i < panelDetailControllers.length; i += 1) {
    const controller = panelDetailControllers[i];
    const keepOpen = controller.panel.dataset.menuPanel === activeMenuId;
    if (!keepOpen) {
      controller.clear();
    }
  }

  if (menuOverlay) {
    const open = Boolean(activeMenuId);
    overlayOpen = open;

    if (open) {
      physics.vx = 0;
      physics.vy = 0;
      stopDragging();
    }

    menuOverlay.classList.toggle("active", open);
    menuOverlay.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("overlay-open", open);
  }
}

function toggleMenu(menuId) {
  setMenuState(activeMenuId === menuId ? null : menuId);
}

for (let i = 0; i < menuTriggers.length; i += 1) {
  const trigger = menuTriggers[i];

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    toggleMenu(trigger.dataset.menuTarget || null);
  });
}


document.addEventListener("click", (event) => {
  if (!activeMenuId) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest(".top-links")) {
    return;
  }

  if (!target.closest(".mega-panel")) {
    setMenuState(null);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenuState(null);
  }
});

window.addEventListener("resize", () => {
  for (let i = 0; i < panelDetailControllers.length; i += 1) {
    panelDetailControllers[i].refresh();
  }

  if (window.innerWidth <= 520) {
    setMenuState(null);
  }
});
