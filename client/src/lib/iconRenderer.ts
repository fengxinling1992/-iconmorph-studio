/**
 * IconMorph Studio — 材料实验室渲染内核
 * 将 SVG 轮廓作为唯一源资产，用 SVG 原生滤镜、渐变和分层挤出创建可导出的变体。
 */

export type StyleId = "duotone" | "gradient" | "glass" | "shadow" | "extrude" | "scene";

export type IconAsset = {
  id: string;
  name: string;
  svg: string;
};

export type RenderParams = {
  primary: string;
  secondary: string;
  angle: number;
  shadowLength: number;
  extrusion: number;
  opacity: number;
  blur: number;
  highlight: number;
  retainStroke: boolean;
  sceneBase?: string;
  sceneDecor?: string;
};

export const styleCatalog: Array<{ id: StyleId; index: string; name: string; short: string; suggestion: string }> = [
  { id: "duotone", index: "01", name: "双色分层", short: "主色与辅助色的轻量分层", suggestion: "SVG / PNG 均适合" },
  { id: "gradient", index: "02", name: "线性渐变", short: "主题色驱动的轮廓填充", suggestion: "SVG / PNG 均适合" },
  { id: "glass", index: "03", name: "柔和玻璃", short: "低模糊与柔光高光", suggestion: "复杂效果建议 PNG" },
  { id: "shadow", index: "04", name: "长阴影", short: "可控方向与长度的投影", suggestion: "SVG / PNG 均适合" },
  { id: "extrude", index: "05", name: "2.5D 轻拟物", short: "分面挤出与柔和光影", suggestion: "复杂效果建议 PNG" },
  { id: "scene", index: "06", name: "3D 插画场景", short: "等轴底座上的毛玻璃实体", suggestion: "完整质感建议 PNG" },
];

const svgStart = /<svg\b([^>]*)>/i;

export function safeSvg(source: string) {
  const cleaned = source
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  const start = cleaned.match(svgStart)?.[1] ?? "";
  const viewBox = start.match(/viewBox=("[^"]*"|'[^']*')/i)?.[1]?.replace(/["']/g, "") ?? "0 0 24 24";
  const content = cleaned
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "")
    .trim();
  return { viewBox, content };
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

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normal = value.length === 3 ? value.split("").map((x) => x + x).join("") : value;
  const r = Number.parseInt(normal.slice(0, 2), 16);
  const g = Number.parseInt(normal.slice(2, 4), 16);
  const b = Number.parseInt(normal.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function simpleBase() {
  return `<path d="M33 77L66 59L98 77L66 95Z" fill="#EEE6DA"/><path d="M33 77L66 95V105L33 87Z" fill="#DDD2C2"/><path d="M98 77L66 95V105L98 87Z" fill="#CFC2B0"/>`;
}

export function renderVariantSvg(asset: IconAsset, style: StyleId, params: RenderParams, size = 320) {
  const { viewBox, content } = safeSvg(asset.svg);
  const uid = `${asset.id.replace(/[^a-zA-Z0-9]/g, "")}-${style}`;
  const gradient = gradientAngle(params.angle);
  const p = escapeXml(params.primary);
  const s = escapeXml(params.secondary);
  const shadow = Math.max(4, params.shadowLength);
  const extrusion = Math.max(2, params.extrusion);
  const lineStyle = params.retainStroke ? "" : "stroke:none;";
  const crop = `0 0 ${size} ${size}`;
  const baseVisual = params.sceneBase
    ? `<image href="${escapeXml(params.sceneBase)}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" opacity=".92"/>`
    : `<image href="/manus-storage/iconmorph-isometric-base_fe785eef.png" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" opacity=".86"/><rect width="${size}" height="${size}" rx="28" fill="#F7F4EE" opacity=".12"/>${simpleBase()}`;
  const decor = params.sceneDecor
    ? `<image href="${escapeXml(params.sceneDecor)}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" opacity=".48"/>`
    : `<circle cx="276" cy="72" r="18" fill="${s}" opacity=".72"/><path d="M236 225h38v8h-38z" fill="${p}" opacity=".3"/>`;

  const defs = `
    <defs>
      <linearGradient id="grad-${uid}" x1="${100 - Number(gradient.x)}%" y1="${100 - Number(gradient.y)}%" x2="${gradient.x}%" y2="${gradient.y}%"><stop offset="0%" stop-color="${p}"/><stop offset="100%" stop-color="${s}"/></linearGradient>
      <linearGradient id="side-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s}"/><stop offset="1" stop-color="#102B38" stop-opacity=".55"/></linearGradient>
      <filter id="soft-${uid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${Math.max(0.4, params.blur / 16).toFixed(2)}"/></filter>
      <filter id="lift-${uid}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="${Math.max(2, extrusion / 3)}" stdDeviation="${Math.max(2, extrusion / 2)}" flood-color="#1F3441" flood-opacity=".18"/></filter>
      <filter id="glow-${uid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(1, params.blur / 6)}" result="blur"/><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 .15  0 0 1 0 .12  0 0 0 ${Math.min(.72, params.opacity / 130)} 0"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;

  const centerTransform = `translate(52 52) scale(9)`;
  const current = `<g transform="${centerTransform}" style="${lineStyle}">${content}</g>`;
  const maskCurrent = `<g transform="${centerTransform}" style="${lineStyle}">${content}</g>`;
  let artwork = "";

  if (style === "duotone") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/><circle cx="250" cy="78" r="88" fill="${s}" opacity=".14"/><g transform="translate(12 14)" fill="${s}" opacity=".48" filter="url(#soft-${uid})">${maskCurrent}</g><g fill="${p}" filter="url(#lift-${uid})">${current}</g><path d="M43 276H277" stroke="${p}" stroke-opacity=".16" stroke-width="2"/>`;
  }
  if (style === "gradient") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/><path d="M32 256C104 220 188 293 286 224" fill="none" stroke="url(#grad-${uid})" stroke-width="34" stroke-linecap="round" opacity=".12"/><g fill="url(#grad-${uid})" stroke="url(#grad-${uid})" filter="url(#lift-${uid})">${current}</g><circle cx="264" cy="66" r="11" fill="${s}" opacity=".65"/>`;
  }
  if (style === "glass") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#E9F0EE"/><rect x="20" y="20" width="280" height="280" rx="24" fill="url(#grad-${uid})" opacity=".13"/><g transform="translate(8 12)" fill="#173746" opacity=".14" filter="url(#soft-${uid})">${current}</g><g fill="url(#grad-${uid})" opacity="${(params.opacity / 100).toFixed(2)}" filter="url(#glow-${uid})">${current}</g><g fill="none" stroke="white" stroke-width="2.5" opacity="${(params.highlight / 140).toFixed(2)}">${current}</g><path d="M64 84C117 39 208 38 258 77" fill="none" stroke="white" stroke-opacity=".65" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (style === "shadow") {
    const dx = Math.cos((params.angle * Math.PI) / 180) * shadow;
    const dy = Math.sin((params.angle * Math.PI) / 180) * shadow;
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F7F4EE"/><g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})" fill="${s}" opacity=".35">${current}</g><g fill="${p}" filter="url(#lift-${uid})">${current}</g><path d="M45 269H275" stroke="#18323C" stroke-opacity=".12" stroke-width="2"/>`;
  }
  if (style === "extrude") {
    artwork = `<rect width="${size}" height="${size}" rx="28" fill="#F4F2EB"/><path d="M35 244L156 286L286 223L166 182Z" fill="${p}" opacity=".1"/><g transform="translate(${extrusion} ${extrusion})" fill="url(#side-${uid})" opacity=".92">${current}</g><g transform="translate(${(extrusion * .68).toFixed(1)} ${(extrusion * .68).toFixed(1)})" fill="${s}" opacity=".7">${current}</g><g fill="url(#grad-${uid})" filter="url(#lift-${uid})">${current}</g><path d="M70 93C118 58 194 55 234 81" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" opacity=".32"/>`;
  }
  if (style === "scene") {
    const layers = Array.from({ length: Math.max(4, Math.round(extrusion / 2)) }, (_, index) => {
      const ratio = index / Math.max(4, Math.round(extrusion / 2));
      return `<g transform="translate(${70 + ratio * extrusion * .32} ${62 + ratio * extrusion * .45}) scale(7)" fill="url(#side-${uid})" opacity="${(0.32 + ratio * .5).toFixed(2)}">${content}</g>`;
    }).join("");
    artwork = `${baseVisual}<rect x="24" y="28" width="272" height="264" rx="26" fill="#F8F6F0" opacity=".24"/>${decor}<ellipse cx="164" cy="237" rx="87" ry="25" fill="#15313C" opacity=".14" filter="url(#soft-${uid})"/>${layers}<g transform="translate(70 62) scale(7)" fill="url(#grad-${uid})" opacity="${(params.opacity / 100).toFixed(2)}" filter="url(#glow-${uid})">${content}</g><g transform="translate(70 62) scale(7)" fill="none" stroke="white" stroke-width=".32" opacity="${(params.highlight / 150).toFixed(2)}">${content}</g><path d="M49 250L164 287L276 236" fill="none" stroke="white" stroke-opacity=".64"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(asset.name)} ${style}" preserveAspectRatio="xMidYMid meet">${defs}${artwork}</svg>`;
}

export function dataUrlToBlob(dataUrl: string) {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/svg+xml";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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

export const rgbaFromHex = hexToRgba;
