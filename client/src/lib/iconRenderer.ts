/**
 * IconMorph Studio — 材料实验室渲染内核
 * 所有源 SVG 均嵌入统一的 100 × 100 规范画布；非 3D 场景模板使用无装饰的纯色背景。
 */

export type StyleId = "duotone" | "gradient" | "glass" | "extrude" | "scene";

export type IconAsset = { id: string; name: string; svg: string };

export type RenderParams = {
  primary: string;
  secondary: string;
  sideColor: string;
  bottomColor: string;
  frontColor: string;
  angle: number;
  extrusionAngle: number;
  shadowLength: number;
  extrusion: number;
  opacity: number;
  blur: number;
  highlight: number;
  safeExtrusion: boolean;
  sceneExtrusion: number;
  sceneExtrusionAngle: number;
  sceneSkewAngle: number;
  sceneObjectHeight: number;
  sceneMotionHeight: number;
  sceneObjectDecor: "none" | "orb" | "cube";
  sceneMotionDecor: "none" | "ribbon" | "orbit";
  sceneBase?: string;
  sceneDecor?: string;
};

export const styleCatalog: Array<{ id: StyleId; index: string; name: string; short: string; suggestion: string }> = [
  { id: "duotone", index: "01", name: "双色分层", short: "顶层与底层的色彩叠置", suggestion: "SVG / PNG 均适合" },
  { id: "gradient", index: "02", name: "线性渐变", short: "主题色驱动的轮廓填充", suggestion: "SVG / PNG 均适合" },
  { id: "glass", index: "03", name: "柔和玻璃", short: "低模糊与柔光高光", suggestion: "复杂效果建议 PNG" },
  { id: "extrude", index: "04", name: "2.5D 轻拟物", short: "30° 等角投影与三档分面明暗", suggestion: "复杂效果建议 PNG" },
  { id: "scene", index: "05", name: "3D 插画场景", short: "等轴底座上的毛玻璃实体", suggestion: "完整质感建议 PNG" },
];

const svgStart = /<svg\b([^>]*)>/i;
const STANDARD_VIEWBOX = "0 0 100 100";
type VisibleBounds = { x: number; y: number; width: number; height: number };
type ContourPoint = { x: number; y: number };
type SvgContour = { points: ContourPoint[]; closed: boolean };
export type ExtrusionSafetyInfo = { recommendedThickness: number; riskScore: number; rationale: string };
const visibleBoundsCache = new Map<string, VisibleBounds>();
const contourCache = new Map<string, SvgContour[]>();

function numericSize(value?: string) {
  const number = Number.parseFloat(value ?? "");
  return Number.isFinite(number) && number > 0 ? number : 24;
}

export function safeSvg(source: string) {
  const cleaned = source
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  const start = cleaned.match(svgStart)?.[1] ?? "";
  const rawViewBox = start.match(/viewBox=("[^"]*"|'[^']*')/i)?.[1]?.replace(/["']/g, "");
  const width = numericSize(start.match(/\bwidth=("[^"]*"|'[^']*')/i)?.[1]?.replace(/["']/g, ""));
  const height = numericSize(start.match(/\bheight=("[^"]*"|'[^']*')/i)?.[1]?.replace(/["']/g, ""));
  const viewBox = rawViewBox || `0 0 ${width} ${height}`;
  const content = cleaned.replace(/^[\s\S]*?<svg\b[^>]*>/i, "").replace(/<\/svg>[\s\S]*$/i, "").trim();
  return { viewBox, content, standardViewBox: STANDARD_VIEWBOX };
}

function getVisibleBounds(sourceKey: string, viewBox: string, content: string, fallback: VisibleBounds): VisibleBounds {
  const cached = visibleBoundsCache.get(sourceKey);
  if (cached) return cached;
  if (typeof document === "undefined" || !document.body) return fallback;
  const measurementSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const measurementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  measurementSvg.setAttribute("viewBox", viewBox);
  measurementSvg.setAttribute("aria-hidden", "true");
  measurementSvg.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:visible";
  measurementGroup.innerHTML = content;
  measurementSvg.appendChild(measurementGroup);
  document.body.appendChild(measurementSvg);
  try {
    const box = measurementGroup.getBBox();
    const measured = Number.isFinite(box.x) && Number.isFinite(box.y) && box.width > 0 && box.height > 0
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : fallback;
    visibleBoundsCache.set(sourceKey, measured);
    return measured;
  } catch {
    return fallback;
  } finally {
    measurementSvg.remove();
  }
}

function getSvgContours(sourceKey: string, viewBox: string, content: string): SvgContour[] {
  const cached = contourCache.get(sourceKey);
  if (cached) return cached;
  if (typeof document === "undefined" || !document.body) return [];
  const measurementSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const measurementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  measurementSvg.setAttribute("viewBox", viewBox);
  measurementSvg.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:visible";
  measurementGroup.innerHTML = content;
  measurementSvg.appendChild(measurementGroup);
  document.body.appendChild(measurementSvg);
  try {
    const nodes = Array.from(measurementGroup.querySelectorAll("path,rect,circle,ellipse,polygon,polyline,line"));
    const contours = nodes.flatMap((node) => {
      const geometry = node as SVGGeometryElement;
      if (typeof geometry.getTotalLength !== "function" || typeof geometry.getPointAtLength !== "function") return [];
      const length = geometry.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return [];
      const tag = node.tagName.toLowerCase();
      const closed = ["rect", "circle", "ellipse", "polygon"].includes(tag) || /z\s*$/i.test(node.getAttribute("d") ?? "");
      const count = Math.max(closed ? 16 : 8, Math.min(72, Math.ceil(length / .85)));
      const points = Array.from({ length: count }, (_, index) => {
        const point = geometry.getPointAtLength((index / (closed ? count : count - 1)) * length);
        return { x: point.x, y: point.y };
      });
      return points.length > 1 ? [{ points, closed }] : [];
    });
    contourCache.set(sourceKey, contours);
    return contours;
  } catch {
    return [];
  } finally {
    measurementSvg.remove();
  }
}

export function getExtrusionSafetyInfo(asset: IconAsset, requestedThickness: number): ExtrusionSafetyInfo {
  const { viewBox, content } = safeSvg(asset.svg);
  const contours = getSvgContours(asset.svg, viewBox, content);
  if (!contours.length) return { recommendedThickness: requestedThickness, riskScore: 0, rationale: "当前轮廓可直接使用设定厚度" };
  const totalPoints = contours.reduce((total, contour) => total + contour.points.length, 0);
  const openContours = contours.filter((contour) => !contour.closed).length;
  const sharpTurns = contours.reduce((total, contour) => {
    if (!contour.closed || contour.points.length < 4) return total;
    return total + contour.points.reduce((count, currentPoint, index) => {
      const previousPoint = contour.points[(index - 1 + contour.points.length) % contour.points.length];
      const nextPoint = contour.points[(index + 1) % contour.points.length];
      const incoming = { x: currentPoint.x - previousPoint.x, y: currentPoint.y - previousPoint.y };
      const outgoing = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };
      const magnitude = Math.hypot(incoming.x, incoming.y) * Math.hypot(outgoing.x, outgoing.y);
      const cosine = magnitude ? (incoming.x * outgoing.x + incoming.y * outgoing.y) / magnitude : 1;
      return cosine < .28 ? count + 1 : count;
    }, 0);
  }, 0);
  const riskScore = Math.min(1, (openContours ? .28 : 0) + (contours.length > 4 ? .28 : 0) + (sharpTurns >= 6 && contours.length <= 2 ? .26 : 0) + (totalPoints > 104 ? .14 : 0));
  const factor = riskScore >= .62 ? .48 : riskScore >= .36 ? .66 : riskScore >= .18 ? .8 : 1;
  const recommendedThickness = Math.max(4, Math.min(requestedThickness, Math.round(requestedThickness * factor)));
  const rationale = riskScore >= .62 ? "尖角与开放路径风险较高，已显著收窄" : riskScore >= .36 ? "检测到复杂子路径，已收窄" : riskScore >= .18 ? "检测到尖角密度，已轻度收窄" : "当前轮廓可直接使用设定厚度";
  return { recommendedThickness, riskScore, rationale };
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] || char);
}

function gradientAngle(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * 50;
  const y = 50 + Math.sin(radians) * 50;
  return { x: x.toFixed(1), y: y.toFixed(1) };
}

export function normalizedSvgMarkup(asset: IconAsset, fill = "currentColor") {
  const { viewBox, content } = safeSvg(asset.svg);
  return `<svg viewBox="${STANDARD_VIEWBOX}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><svg x="0" y="0" width="100" height="100" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><g fill="${fill}">${content}</g></svg></svg>`;
}

export function renderVariantSvg(asset: IconAsset, style: StyleId, params: RenderParams, size = 320) {
  const { viewBox, content } = safeSvg(asset.svg);
  const uid = `${asset.id.replace(/[^a-zA-Z0-9]/g, "")}-${style}`;
  const gradient = gradientAngle(params.angle);
  const p = escapeXml(params.primary);
  const s = escapeXml(params.secondary);
  const side = escapeXml(params.sideColor);
  const bottom = escapeXml(params.bottomColor);
  const front = escapeXml(params.frontColor);
  const requestedExtrusion = Math.max(2, params.extrusion);
  const requestedSceneExtrusion = Math.max(2, params.sceneExtrusion);
  const extrusionSafety = getExtrusionSafetyInfo(asset, requestedExtrusion);
  const sceneExtrusionSafety = getExtrusionSafetyInfo(asset, requestedSceneExtrusion);
  const extrusion = params.safeExtrusion ? extrusionSafety.recommendedThickness : requestedExtrusion;
  const sceneExtrusion = params.safeExtrusion ? sceneExtrusionSafety.recommendedThickness : requestedSceneExtrusion;
  const [sourceX = 0, sourceY = 0, sourceWidth = 24, sourceHeight = 24] = viewBox.split(/[\s,]+/).map(Number);
  const sourceContours = getSvgContours(asset.svg, viewBox, content);
  const wholeGradient = (id: string) => {
    const x1 = sourceX + ((100 - Number(gradient.x)) / 100) * sourceWidth;
    const y1 = sourceY + ((100 - Number(gradient.y)) / 100) * sourceHeight;
    const x2 = sourceX + (Number(gradient.x) / 100) * sourceWidth;
    const y2 = sourceY + (Number(gradient.y) / 100) * sourceHeight;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}"><stop offset="0%" stop-color="${p}"/><stop offset="100%" stop-color="${s}"/></linearGradient>`;
  };
  const iconFrame = (x: number, y: number, width: number, height = width) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
  const colorizedFrame = (x: number, y: number, width: number, height: number, color: string, label: string) => {
    const paintClass = `paint-${uid}-${label}`;
    return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><style>.${paintClass} *{fill:${color}!important}.${paintClass} [fill="none"]{fill:none!important;stroke:${color}!important}.${paintClass} [stroke]{stroke:${color}!important}.${paintClass} [fill="#fff"],.${paintClass} [fill="#ffffff"],.${paintClass} [fill="white"],.${paintClass} [fill="#F7F4EE"]{fill:#F7F4EE!important}</style><g class="${paintClass}">${content}</g></svg>`;
  };
  const gradientFrame = (x: number, y: number, width: number, height: number, gradientId: string) => {
    const paintClass = `gradient-${uid}-${gradientId}`;
    return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><defs>${wholeGradient(gradientId)}</defs><style>.${paintClass} *{fill:url(#${gradientId})!important}.${paintClass} [fill="none"]{fill:none!important;stroke:url(#${gradientId})!important}.${paintClass} [stroke]{stroke:url(#${gradientId})!important}.${paintClass} [fill="#fff"],.${paintClass} [fill="#ffffff"],.${paintClass} [fill="white"],.${paintClass} [fill="#F7F4EE"]{fill:#F7F4EE!important}</style><g class="${paintClass}">${content}</g></svg>`;
  };
  const current = colorizedFrame(52, 52, 216, 216, front, "front");
  const sceneCurrent = colorizedFrame(70, 62, 180, 180, front, "scene-front");
  const primaryCurrent = colorizedFrame(52, 52, 216, 216, p, "primary");
  const secondaryOffset = (distance: number) => colorizedFrame(52 + distance, 52 + distance, 216, 216, s, "secondary");
  const darkOffset = colorizedFrame(57, 59, 216, 216, "#173746", "glass-shadow");
  const gradientCurrent = gradientFrame(52, 52, 216, 216, `whole-${uid}-main`);
  const sceneOrigin = { x: 78, y: 114, width: 164 };
  const sceneRightEdge = sceneOrigin.x + sceneOrigin.width;
  const sceneShear = Math.tan((params.sceneSkewAngle * Math.PI) / 180);
  const sceneExtrusionShift = sceneExtrusion * .55;
  const sceneExtrusionRadians = (params.sceneExtrusionAngle * Math.PI) / 180;
  const sceneOffsetX = Math.cos(sceneExtrusionRadians) * sceneExtrusionShift;
  const sceneOffsetY = Math.sin(sceneExtrusionRadians) * sceneExtrusionShift;
  const projectedSceneTop = sceneOrigin.y - sceneShear * sceneOrigin.width;
  const projectedSceneBottom = sceneOrigin.y + sceneOrigin.width;
  const sceneCropPadding = style === "scene" ? Math.max(0, Math.ceil(Math.max(
    -(projectedSceneTop + Math.min(0, sceneOffsetY)) + 12,
    projectedSceneBottom + Math.max(0, sceneOffsetY) - 320 + 12,
    -(sceneOrigin.x + Math.min(0, sceneOffsetX)) + 12,
    sceneRightEdge + Math.max(0, sceneOffsetX) - 320 + 12,
  ))) : 0;
  const crop = style === "scene" ? `${-sceneCropPadding} ${-sceneCropPadding} ${320 + sceneCropPadding * 2} ${320 + sceneCropPadding * 2}` : `0 0 ${size} ${size}`;
  const decorLift = Math.min(76, Math.max(7, sceneExtrusion * .42));
  const gradientSceneCurrent = gradientFrame(sceneOrigin.x, sceneOrigin.y, sceneOrigin.width, sceneOrigin.width, `whole-${uid}-scene`);
  const sceneIsoTransform = `matrix(1 ${sceneShear} 0 1 0 ${(-sceneShear * sceneRightEdge).toFixed(3)})`;
  const projectedSceneCurrent = `<g transform="${sceneIsoTransform}">${gradientSceneCurrent}</g>`;
  const createIntegratedExtrusion = (originX: number, originY: number, width: number, shiftScale: number, angle: number, maskKey: string, depth: number, isometric = false) => {
    // 标准等角参考以 30° 为基准：默认右侧和底侧外扩均与水平轴形成 30° 关系。
    const radians = (angle * Math.PI) / 180;
    const shift = depth * shiftScale;
    const offsetX = Math.cos(radians) * shift;
    const offsetY = Math.sin(radians) * shift;
    // 将每段实际轮廓沿同一向量平移，圆形、圆角及异形路径都会得到等距的连续挤出带。
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const faces: ["right" | "bottom" | "left" | "top", "right" | "bottom" | "left" | "top"] = normalizedAngle < 90
      ? ["right", "bottom"]
      : normalizedAngle < 180
        ? ["bottom", "left"]
        : normalizedAngle < 270
        ? ["left", "top"]
          : ["top", "right"];
    const mapPoint = (point: ContourPoint) => {
      const x = originX + ((point.x - sourceX) / sourceWidth) * width;
      const y = originY + ((point.y - sourceY) / sourceHeight) * width;
      if (!isometric) return { x, y };
      const rightEdge = originX + width;
      return { x, y: y + sceneShear * (x - rightEdge) };
    };
    const contourCenter = { x: originX + width / 2, y: originY + width / 2 };
    const point = (target: ContourPoint) => `${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
    const faceBucketForSegment = (midpoint: ContourPoint) => {
      const horizontal = midpoint.x - contourCenter.x;
      const vertical = midpoint.y - contourCenter.y;
      if (faces[0] === "right" && faces[1] === "bottom") return horizontal >= vertical ? "primary" : "secondary";
      if (faces[0] === "bottom" && faces[1] === "left") return vertical >= -horizontal ? "primary" : "secondary";
      if (faces[0] === "left" && faces[1] === "top") return -horizontal >= -vertical ? "primary" : "secondary";
      return -vertical >= horizontal ? "primary" : "secondary";
    };
    const facePaths = { primary: [] as string[], secondary: [] as string[] };
    sourceContours.forEach((contour) => {
      const mapped = contour.points.map(mapPoint);
      const segmentCount = contour.closed ? mapped.length : Math.max(0, mapped.length - 1);
      const signedArea = contour.closed ? mapped.reduce((area, currentPoint, index) => {
        const nextPoint = mapped[(index + 1) % mapped.length];
        return area + currentPoint.x * nextPoint.y - nextPoint.x * currentPoint.y;
      }, 0) / 2 : 1;
      Array.from({ length: segmentCount }, (_, index) => {
        const from = mapped[index];
        const to = mapped[(index + 1) % mapped.length];
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const extrudedFrom = { x: from.x + offsetX, y: from.y + offsetY };
        const extrudedTo = { x: to.x + offsetX, y: to.y + offsetY };
        const segmentX = to.x - from.x;
        const segmentY = to.y - from.y;
        const segmentLength = Math.hypot(segmentX, segmentY);
        const outwardNormal = signedArea >= 0 ? { x: segmentY, y: -segmentX } : { x: -segmentY, y: segmentX };
        const facesDirection = outwardNormal.x * offsetX + outwardNormal.y * offsetY;
        const isDiscontinuous = segmentLength > Math.hypot(width, width) * .34;
        if (segmentLength > .02 && facesDirection > .02 && !isDiscontinuous) {
          facePaths[faceBucketForSegment(midpoint)].push(`M${point(from)}L${point(to)}L${point(extrudedTo)}L${point(extrudedFrom)}Z`);
        }
      });
    });
    const geometryFaces = `${facePaths.primary.length ? `<path d="${facePaths.primary.join("")}" fill="${side}"/>` : ""}${facePaths.secondary.length ? `<path d="${facePaths.secondary.join("")}" fill="${bottom}"/>` : ""}`;
    const fallback = `<g fill="${side}">${iconFrame(originX + offsetX, originY + offsetY, width)}</g>`;
    return geometryFaces || fallback;
  };
  const sceneBase = params.sceneBase || "/manus-storage/scene-base_62b9c12e.svg";
  const baseVisual = `<image href="${escapeXml(sceneBase)}" x="7" y="116" width="306" height="194" preserveAspectRatio="xMidYMid meet"/>`;
  const motionDecor = params.sceneMotionDecor === "orbit"
    ? `<image href="/manus-storage/orbit_2a9dae30.png" x="4" y="${(43 - decorLift * .45 - params.sceneMotionHeight).toFixed(1)}" width="312" height="160" preserveAspectRatio="xMidYMid meet" opacity=".88"/>`
    : params.sceneMotionDecor === "ribbon"
      ? `<image href="/manus-storage/ribbon_394fae47.png" x="18" y="${(42 - decorLift * .45 - params.sceneMotionHeight).toFixed(1)}" width="284" height="145" preserveAspectRatio="xMidYMid meet" opacity=".84"/>`
      : "";
  const accentAsset = params.sceneObjectDecor === "cube" ? "/manus-storage/accent-cube_cb8409c6.png" : "/manus-storage/glass-orb_3c311794.png";
  const objectDecorBehind = params.sceneObjectDecor === "none"
    ? ""
    : `<image href="${accentAsset}" x="48" y="${(132 - decorLift - params.sceneObjectHeight).toFixed(1)}" width="16" height="17" preserveAspectRatio="xMidYMid meet"/>`;
  const objectDecorFront = params.sceneObjectDecor === "none"
    ? ""
    : `<image href="${accentAsset}" x="247" y="${(81 - decorLift - params.sceneObjectHeight).toFixed(1)}" width="23" height="25" preserveAspectRatio="xMidYMid meet"/>`;
  const defaultDecorBehind = `${motionDecor}${objectDecorBehind}`;
  const defaultDecorFront = objectDecorFront;
  const sceneDecorBehind = params.sceneDecor
    ? `<image href="${escapeXml(params.sceneDecor)}" x="10" y="${(36 - params.sceneMotionHeight).toFixed(1)}" width="300" height="220" preserveAspectRatio="xMidYMid meet"/>`
    : defaultDecorBehind;
  const sceneDecorFront = params.sceneDecor ? "" : defaultDecorFront;
  const defs = `<defs><filter id="soft-${uid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${Math.max(0.4, params.blur / 16).toFixed(2)}"/></filter><filter id="lift-${uid}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="${Math.max(2, extrusion / 3)}" stdDeviation="${Math.max(2, extrusion / 2)}" flood-color="#1F3441" flood-opacity=".18"/></filter><filter id="glow-${uid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(1, params.blur / 6)}" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 .15  0 0 1 0 .12  0 0 0 ${Math.min(.72, params.opacity / 130)} 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  let artwork = "";

  if (style === "duotone") {
    const layerDistance = Math.max(4, params.shadowLength * .42);
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/>${secondaryOffset(layerDistance)}<g filter="url(#lift-${uid})">${primaryCurrent}</g>`;
  }
  if (style === "gradient") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/>${gradientCurrent}`;
  }
  if (style === "glass") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/><g opacity=".12" filter="url(#soft-${uid})">${darkOffset}</g><g opacity="${(params.opacity / 100).toFixed(2)}" filter="url(#glow-${uid})">${gradientCurrent}</g><g fill="none" stroke="white" stroke-width="2.5" opacity="${(params.highlight / 140).toFixed(2)}">${current}</g>`;
  }
  if (style === "extrude") {
    const integratedExtrusion = createIntegratedExtrusion(52, 52, 216, 1, params.extrusionAngle, `volume-${uid}`, extrusion);
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/>${integratedExtrusion}<g filter="url(#lift-${uid})">${current}</g>`;
  }
  if (style === "scene") {
    const integratedExtrusion = createIntegratedExtrusion(sceneOrigin.x, sceneOrigin.y, sceneOrigin.width, .55, params.sceneExtrusionAngle, `volume-${uid}`, sceneExtrusion, true);
    artwork = `${baseVisual}${sceneDecorBehind}${integratedExtrusion}<g opacity="${(params.opacity / 100).toFixed(2)}" filter="url(#glow-${uid})">${projectedSceneCurrent}</g>${sceneDecorFront}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(asset.name)} ${style}" preserveAspectRatio="xMidYMid meet">${defs}${artwork}</svg>`;
}

export function defaultIcons(): IconAsset[] {
  return [
    { id: "archive", name: "归档盒", svg: '<svg viewBox="0 0 24 24"><path d="M4 5.5h16v14H4z"/><path d="M3 3h18v4H3z"/><path fill="#F7F4EE" d="M9 10h6v2H9z"/></svg>' },
    { id: "spark", name: "闪光", svg: '<svg viewBox="0 0 24 24"><path d="m12 1.5 2.2 7.2 7.3 2.3-7.3 2.2-2.2 7.3-2.3-7.3-7.2-2.2 7.2-2.3z"/></svg>' },
    { id: "layers", name: "分层", svg: '<svg viewBox="0 0 24 24"><path d="m12 2 10 5-10 5L2 7z"/><path d="m2 11 10 5 10-5v3l-10 5-10-5z"/><path d="m2 17 10 5 10-5v-2l-10 5-10-5z"/></svg>' },
    { id: "orbit", name: "轨道", svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M20.5 12c0 4.7-3.8 8.5-8.5 8.5S3.5 16.7 3.5 12 7.3 3.5 12 3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="18.5" cy="5.5" r="2"/></svg>' },
    { id: "ribbon", name: "折带", svg: '<svg viewBox="0 0 24 24"><path d="M4 4h16v5H4z"/><path d="M7 9h13v5H7z"/><path d="M4 14h13v6H4z"/></svg>' },
  ];
}
