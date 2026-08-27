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
  sceneBase?: string;
  sceneDecor?: string;
};

export const styleCatalog: Array<{ id: StyleId; index: string; name: string; short: string; suggestion: string }> = [
  { id: "duotone", index: "01", name: "双色分层", short: "顶层与底层的色彩叠置", suggestion: "SVG / PNG 均适合" },
  { id: "gradient", index: "02", name: "线性渐变", short: "主题色驱动的轮廓填充", suggestion: "SVG / PNG 均适合" },
  { id: "glass", index: "03", name: "柔和玻璃", short: "低模糊与柔光高光", suggestion: "复杂效果建议 PNG" },
  { id: "extrude", index: "04", name: "2.5D 轻拟物", short: "正面、侧面与底面的两向挤出", suggestion: "复杂效果建议 PNG" },
  { id: "scene", index: "05", name: "3D 插画场景", short: "等轴底座上的毛玻璃实体", suggestion: "完整质感建议 PNG" },
];

const svgStart = /<svg\b([^>]*)>/i;
const STANDARD_VIEWBOX = "0 0 100 100";

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
  const extrusion = Math.max(2, params.extrusion);
  const crop = `0 0 ${size} ${size}`;
  const [sourceX = 0, sourceY = 0, sourceWidth = 24, sourceHeight = 24] = viewBox.split(/[\s,]+/).map(Number);
  const wholeGradient = (id: string) => {
    const x1 = sourceX + ((100 - Number(gradient.x)) / 100) * sourceWidth;
    const y1 = sourceY + ((100 - Number(gradient.y)) / 100) * sourceHeight;
    const x2 = sourceX + (Number(gradient.x) / 100) * sourceWidth;
    const y2 = sourceY + (Number(gradient.y) / 100) * sourceHeight;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}"><stop offset="0%" stop-color="${p}"/><stop offset="100%" stop-color="${s}"/></linearGradient>`;
  };
  const iconFrame = (x: number, y: number, width: number, height = width) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
  const gradientFrame = (x: number, y: number, width: number, height: number, gradientId: string) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><defs>${wholeGradient(gradientId)}</defs><g fill="url(#${gradientId})">${content}</g></svg>`;
  const current = iconFrame(52, 52, 216);
  const sceneCurrent = iconFrame(70, 62, 180);
  const gradientCurrent = gradientFrame(52, 52, 216, 216, `whole-${uid}-main`);
  const gradientSceneCurrent = gradientFrame(70, 62, 180, 180, `whole-${uid}-scene`);
  const createIntegratedExtrusion = (originX: number, originY: number, width: number, shiftScale: number, angle: number, maskKey: string) => {
    const radians = (angle * Math.PI) / 180;
    const shift = extrusion * shiftScale;
    const offsetX = Math.cos(radians) * shift;
    const offsetY = Math.sin(radians) * shift;
    const steps = Math.max(4, Math.round(extrusion / 3));
    const maskFrame = (x: number, y: number) => `<svg x="${x}" y="${y}" width="${width}" height="${width}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><g fill="#fff" stroke="#fff">${content}</g></svg>`;
    const maskCopies = Array.from({ length: steps + 1 }, (_, index) => {
      const ratio = index / steps;
      return maskFrame(originX + offsetX * ratio, originY + offsetY * ratio);
    }).join("");
    // 挤出双分面按四个角度象限选择相邻外边：右下、左下、左上、右上。
    // 两块局部四边形仅覆盖真实外露的挤出带，并在共享转角到挤出终点的斜线上连续衔接。
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const faces: ["right" | "bottom" | "left" | "top", "right" | "bottom" | "left" | "top"] = normalizedAngle < 90
      ? ["right", "bottom"]
      : normalizedAngle < 180
        ? ["bottom", "left"]
        : normalizedAngle < 270
          ? ["left", "top"]
          : ["top", "right"];
    // 顶边分面以源图形的可见左上、右上外轮廓为锚点，而非包含留白的 viewBox 边界；
    // 这样可避免轮廓较小的 SVG 从空白区域外扩，仍保持两个顶角同时出发。
    const leftTop = { x: originX + width * .18, y: originY + width * .18 };
    const leftBottom = { x: originX + width * .18, y: originY + width * .82 };
    const rightBottom = { x: originX + width * .82, y: originY + width * .82 };
    const rightTop = { x: originX + width * .82, y: originY + width * .18 };
    const overlap = Math.max(1.5, Math.min(3, extrusion * .12));
    const extendedLeftTop = { x: leftTop.x + offsetX, y: leftTop.y + offsetY };
    const extendedLeftBottom = { x: leftBottom.x + offsetX, y: leftBottom.y + offsetY };
    const extendedRightBottom = { x: rightBottom.x + offsetX, y: rightBottom.y + offsetY };
    const extendedRightTop = { x: rightTop.x + offsetX, y: rightTop.y + offsetY };
    const point = (target: { x: number; y: number }) => `${target.x.toFixed(2)} ${target.y.toFixed(2)}`;
    const edgePath = (edge: "right" | "bottom" | "left" | "top") => {
      if (edge === "right") return `M${point({ x: rightTop.x - overlap, y: rightTop.y })}L${point({ x: rightBottom.x - overlap, y: rightBottom.y })}L${point(extendedRightBottom)}L${point(extendedRightTop)}Z`;
      if (edge === "bottom") return `M${point({ x: leftBottom.x, y: leftBottom.y - overlap })}L${point({ x: rightBottom.x, y: rightBottom.y - overlap })}L${point(extendedRightBottom)}L${point(extendedLeftBottom)}Z`;
      if (edge === "left") return `M${point({ x: leftTop.x + overlap, y: leftTop.y })}L${point({ x: leftBottom.x + overlap, y: leftBottom.y })}L${point(extendedLeftBottom)}L${point(extendedLeftTop)}Z`;
      return `M${point({ x: leftTop.x, y: leftTop.y + overlap })}L${point({ x: rightTop.x, y: rightTop.y + overlap })}L${point(extendedRightTop)}L${point(extendedLeftTop)}Z`;
    };
    return `<defs><mask id="${maskKey}" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#000"/>${maskCopies}</mask></defs><g mask="url(#${maskKey})"><path d="${edgePath(faces[0])}" fill="${side}"/><path d="${edgePath(faces[1])}" fill="${bottom}"/></g>`;
  };
  const sceneBase = params.sceneBase || "/manus-storage/scene-base_62b9c12e.svg";
  const baseVisual = `<image href="${escapeXml(sceneBase)}" x="7" y="116" width="306" height="194" preserveAspectRatio="xMidYMid meet"/>`;
  const defaultDecorBehind = `<image href="/manus-storage/orbit_2a9dae30.png" x="4" y="43" width="312" height="160" preserveAspectRatio="xMidYMid meet" opacity=".88"/><image href="/manus-storage/ribbon_394fae47.png" x="18" y="42" width="284" height="145" preserveAspectRatio="xMidYMid meet" opacity=".84"/><image href="/manus-storage/accent-cube_cb8409c6.png" x="36" y="105" width="58" height="63" preserveAspectRatio="xMidYMid meet"/>`;
  const defaultDecorFront = `<image href="/manus-storage/glass-orb_3c311794.png" x="246" y="54" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>`;
  const sceneDecorBehind = params.sceneDecor
    ? `<image href="${escapeXml(params.sceneDecor)}" x="10" y="36" width="300" height="220" preserveAspectRatio="xMidYMid meet"/>`
    : defaultDecorBehind;
  const sceneDecorFront = params.sceneDecor ? "" : defaultDecorFront;
  const defs = `<defs><filter id="soft-${uid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${Math.max(0.4, params.blur / 16).toFixed(2)}"/></filter><filter id="lift-${uid}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="${Math.max(2, extrusion / 3)}" stdDeviation="${Math.max(2, extrusion / 2)}" flood-color="#1F3441" flood-opacity=".18"/></filter><filter id="glow-${uid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(1, params.blur / 6)}" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 .15  0 0 1 0 .12  0 0 0 ${Math.min(.72, params.opacity / 130)} 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  let artwork = "";

  if (style === "duotone") {
    const layerDistance = Math.max(4, params.shadowLength * .42);
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/><g transform="translate(${layerDistance.toFixed(1)} ${layerDistance.toFixed(1)})" fill="${s}">${current}</g><g fill="${p}" filter="url(#lift-${uid})">${current}</g>`;
  }
  if (style === "gradient") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/>${gradientCurrent}`;
  }
  if (style === "glass") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/><g transform="translate(5 7)" fill="#173746" opacity=".12" filter="url(#soft-${uid})">${current}</g><g opacity="${(params.opacity / 100).toFixed(2)}" filter="url(#glow-${uid})">${gradientCurrent}</g><g fill="none" stroke="white" stroke-width="2.5" opacity="${(params.highlight / 140).toFixed(2)}">${current}</g>`;
  }
  if (style === "extrude") {
    const integratedExtrusion = createIntegratedExtrusion(52, 52, 216, 1, params.extrusionAngle, `volume-${uid}`);
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/>${integratedExtrusion}<g fill="${front}" filter="url(#lift-${uid})">${current}</g>`;
  }
  if (style === "scene") {
    const integratedExtrusion = createIntegratedExtrusion(70, 62, 180, .55, params.extrusionAngle, `volume-${uid}`);
    artwork = `${baseVisual}${sceneDecorBehind}${integratedExtrusion}<g opacity="${(params.opacity / 100).toFixed(2)}" filter="url(#glow-${uid})">${gradientSceneCurrent}</g>${sceneDecorFront}`;
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
