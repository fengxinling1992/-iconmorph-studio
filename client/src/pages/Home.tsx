/**
 * IconMorph Studio — 材料实验室页面
 * 以源 SVG 与其风格化材料标本并置的三栏工作台，强调参数可见、来源可追溯与批量导出。
 */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Archive,
  ArrowDownToLine,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Download,
  FileImage,
  FolderUp,
  Layers3,
  MousePointer2,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { defaultIcons, IconAsset, normalizedSvgMarkup, RenderParams, renderVariantSvg, StyleId, styleCatalog } from "@/lib/iconRenderer";

type OutputFormat = "svg" | "png";

const INITIAL_PARAMS: RenderParams = {
  primary: "#A696FC",
  secondary: "#67A7FB",
  topColor: "#C8BEFF",
  sideColor: "#5B7DE8",
  frontColor: "#8B9AF7",
  angle: 135,
  extrusionAngle: 42,
  shadowLength: 34,
  extrusion: 18,
  opacity: 72,
  blur: 8,
  highlight: 54,
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-|-$/g, "") || "icon";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 400);
}

async function svgToPng(svg: string, resolution: number) {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("SVG 转 PNG 时发生错误"));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 320 * resolution;
  canvas.height = 320 * resolution;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持 Canvas 导出");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG 编码失败"))), "image/png"));
}

function SliderField({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <div className="parameter-field">
      <div className="parameter-label"><span>{label}</span><strong>{value}{suffix}</strong></div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} aria-label={label} />
    </div>
  );
}

function ColorField({ label, color, onChange }: { label: string; color: string; onChange: (color: string) => void }) {
  return <label className="color-field"><span>{label}</span><div className="color-input"><input type="color" value={color} onChange={(event) => onChange(event.target.value)} /><code>{color.toUpperCase()}</code></div></label>;
}

function SourcePreview({ asset }: { asset: IconAsset }) {
  return (
    <div className="source-stage">
      <div className="crosshair crosshair-x" />
      <div className="crosshair crosshair-y" />
      <span className="stage-coordinate stage-coordinate-top">0,0</span>
      <span className="stage-coordinate stage-coordinate-bottom">100 × 100</span>
      <div className="source-art" dangerouslySetInnerHTML={{ __html: normalizedSvgMarkup(asset, "#173743") }} />
    </div>
  );
}

function VariantPreview({ asset, style, params, compact = false }: { asset: IconAsset; style: StyleId; params: RenderParams; compact?: boolean }) {
  return <div className={compact ? "variant-art variant-art-compact" : "variant-art"} dangerouslySetInnerHTML={{ __html: renderVariantSvg(asset, style, params) }} />;
}

export default function Home() {
  const [assets, setAssets] = useState<IconAsset[]>(defaultIcons());
  const [activeId, setActiveId] = useState("archive");
  const [selectedStyle, setSelectedStyle] = useState<StyleId>("extrude");
  const [params, setParams] = useState<RenderParams>(INITIAL_PARAMS);
  const [selectedVariants, setSelectedVariants] = useState<StyleId[]>(["gradient", "glass", "extrude", "scene"]);
  const [formats, setFormats] = useState<OutputFormat[]>(["png"]);
  const [resolution, setResolution] = useState(3);
  const [compareMode, setCompareMode] = useState(false);
  const [isBatch, setIsBatch] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");
  const assetInput = useRef<HTMLInputElement>(null);
  const baseInput = useRef<HTMLInputElement>(null);
  const decorInput = useRef<HTMLInputElement>(null);

  const activeAsset = useMemo(() => assets.find((asset) => asset.id === activeId) ?? assets[0], [assets, activeId]);
  const selectedTemplate = styleCatalog.find((style) => style.id === selectedStyle) ?? styleCatalog[0];

  const updateParam = <K extends keyof RenderParams>(key: K, value: RenderParams[K]) => setParams((current) => ({ ...current, [key]: value }));

  const parseAssets = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg"));
    if (!files.length) return;
    Promise.all(files.map(async (file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name.replace(/\.svg$/i, ""),
      svg: await file.text(),
    }))).then((imported) => {
      setAssets((current) => [...current, ...imported]);
      setActiveId(imported[0].id);
      setIsBatch(imported.length > 1 || isBatch);
      setExportNote(`已载入 ${imported.length} 枚 SVG 源资产`);
    });
    event.target.value = "";
  };

  const readSceneAsset = (event: ChangeEvent<HTMLInputElement>, field: "sceneBase" | "sceneDecor") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateParam(field, String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const toggleVariant = (style: StyleId) => {
    setSelectedVariants((current) => current.includes(style) ? current.filter((item) => item !== style) : [...current, style]);
  };

  const buildExports = async (asset: IconAsset, style: StyleId) => {
    const svg = renderVariantSvg(asset, style, params, 512);
    const outputs: Array<{ name: string; blob: Blob }> = [];
    if (formats.includes("svg")) outputs.push({ name: `${slug(asset.name)}-${style}.svg`, blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }) });
    if (formats.includes("png")) outputs.push({ name: `${slug(asset.name)}-${style}@${resolution}x.png`, blob: await svgToPng(svg, resolution) });
    return outputs;
  };

  const exportSingle = async (style: StyleId) => {
    if (!formats.length) { setExportNote("请至少选择一种输出格式"); return; }
    setIsExporting(true);
    try {
      const output = await buildExports(activeAsset, style);
      output.forEach((file) => downloadBlob(file.blob, file.name));
      setExportNote(`已下载「${styleCatalog.find((item) => item.id === style)?.name}」${output.length > 1 ? " 的 SVG 与 PNG" : ""}`);
    } catch (error) {
      setExportNote(error instanceof Error ? error.message : "导出失败，请重试");
    } finally { setIsExporting(false); }
  };

  const exportBundle = async () => {
    if (!formats.length || !selectedVariants.length) { setExportNote("请选择至少一个变体和输出格式"); return; }
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const targetAssets = isBatch ? assets : [activeAsset];
      for (const asset of targetAssets) {
        for (const style of selectedVariants) {
          const outputs = await buildExports(asset, style);
          outputs.forEach((file) => zip.file(file.name, file.blob));
        }
      }
      const bundle = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(bundle, `iconmorph-${isBatch ? "batch" : slug(activeAsset.name)}.zip`);
      setExportNote(`已打包 ${targetAssets.length * selectedVariants.length} 个风格结果`);
    } catch (error) {
      setExportNote(error instanceof Error ? error.message : "打包失败，请重试");
    } finally { setIsExporting(false); }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src="/manus-storage/iconmorph-mark_cff258a8.png" alt="" className="brand-mark" />
          <div><p className="brand-name">IconMorph <span>Studio</span></p><p className="brand-subtitle">SVG MATERIAL LAB</p></div>
        </div>
        <div className="topbar-middle"><span className="project-dot" /> <span>源资产工作台</span><span className="slash">/</span><span className="muted-topcopy">保留路径与分组结构</span></div>
        <div className="topbar-actions">
          <button className="help-button" aria-label="使用指南"><CircleHelp size={17} /></button>
          <Button onClick={() => assetInput.current?.click()} className="import-button"><FolderUp size={16} /> 导入 SVG</Button>
          <input ref={assetInput} className="visually-hidden" type="file" accept=".svg,image/svg+xml" multiple onChange={parseAssets} />
        </div>
      </header>

      <main className="workspace">
        <aside className="asset-rail">
          <div className="rail-head"><div><span className="eyebrow">A / 资产库</span><h2>SVG 真源</h2></div><button className="icon-button" onClick={() => assetInput.current?.click()} aria-label="上传 SVG"><Plus size={17} /></button></div>
          <button className="library-import" onClick={() => assetInput.current?.click()}><Upload size={17}/><span>上传图标</span><small>支持多选</small></button>
          <div className="library-label"><span>项目字体图标</span><span>{assets.length}</span></div>
          <div className="asset-list">
            {assets.map((asset) => <button key={asset.id} onClick={() => setActiveId(asset.id)} className={`asset-row ${asset.id === activeId ? "asset-row-active" : ""}`}>
              <span className="asset-thumbnail" dangerouslySetInnerHTML={{ __html: normalizedSvgMarkup(asset) }} />
              <span><strong>{asset.name}</strong><small>SVG · 统一画布</small></span>
              {asset.id === activeId && <Check size={15} />}
            </button>)}
          </div>
          <div className="rail-footer"><span className="status-led"/> 真源模式已开启</div>
        </aside>

        <section className="canvas-column">
          <div className="context-strip">
            <div className="breadcrumb"><Archive size={14}/><span>资产库</span><ChevronDown size={14}/><strong>{activeAsset.name}</strong></div>
            <div className="mode-switch"><button className={!isBatch ? "mode-active" : ""} onClick={() => setIsBatch(false)}><MousePointer2 size={14}/> 单图</button><button className={isBatch ? "mode-active" : ""} onClick={() => setIsBatch(true)}><Layers3 size={14}/> 批量 <span>{assets.length}</span></button></div>
          </div>

          <div className="canvas-header"><div><span className="eyebrow">B / 生成预览</span><h1>沿用轮廓，换一种材料语言。</h1><p>每个变体均由当前 SVG 路径实时生成，不使用垫图或导出后再编辑。</p></div><Button variant="outline" className="regenerate" onClick={() => { setParams({ ...params }); setExportNote("已按当前参数刷新全部预览"); }}><RefreshCw size={15}/> 基于当前参数重新生成</Button></div>

          <div className={compareMode ? "preview-board compare-open" : "preview-board"}>
            <article className="source-card">
              <div className="card-kicker"><span>SOURCE / 01</span><button aria-label="更多源图操作"><Settings2 size={15}/></button></div>
              <SourcePreview asset={activeAsset} />
              <div className="source-caption"><div><strong>{activeAsset.name}.svg</strong><span>统一 100 × 100 画布，轮廓完整适配</span></div><span className="file-chip">SVG</span></div>
              <section className="style-library style-library-inline"><div className="inline-library-head"><span className="eyebrow">风格模板</span><span>{styleCatalog.length}</span></div><div className="style-rail">{styleCatalog.map((style) => <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`template-chip template-${style.id} ${style.id === selectedStyle ? "template-chip-active" : ""}`}><span>{style.index}</span><div><strong>{style.name}</strong><small>{style.id === selectedStyle ? "当前编辑" : style.suggestion}</small></div>{style.id === selectedStyle && <Check size={14}/>}</button>)}</div></section>
            </article>
            <div className="variant-zone">
              <div className="variant-zone-head"><div><span className="eyebrow">{styleCatalog.length} 个材料变体</span><strong>点击标本以载入参数</strong></div><label className="compare-toggle"><span>对比源图</span><Switch checked={compareMode} onCheckedChange={setCompareMode} /></label></div>
              <div className="variant-grid">
                {styleCatalog.map((style) => <article key={style.id} className={`variant-card ${selectedStyle === style.id ? "variant-card-selected" : ""}`} onClick={() => setSelectedStyle(style.id)}>
                  <div className="variant-meta"><span>{style.index}</span><Checkbox checked={selectedVariants.includes(style.id)} onCheckedChange={() => toggleVariant(style.id)} onClick={(event) => event.stopPropagation()} aria-label={`选择${style.name}导出`} /></div>
                  <VariantPreview asset={activeAsset} style={style.id} params={params} compact />
                  <div className="variant-card-footer"><div><strong>{style.name}</strong><small>{style.short}</small></div><button aria-label={`下载${style.name}`} onClick={(event) => { event.stopPropagation(); exportSingle(style.id); }}><Download size={15}/></button></div>
                </article>)}
              </div>
            </div>
          </div>

          {isBatch && <section className="batch-strip"><div className="batch-strip-head"><div><span className="eyebrow">C / 批量队列</span><h2>{assets.length} 枚图标 × {selectedVariants.length} 种已选风格</h2></div><span className="batch-status"><Zap size={14}/> 预览同步</span></div><div className="batch-grid">{assets.map((asset) => <button key={asset.id} className={`batch-cell ${asset.id === activeId ? "batch-cell-active" : ""}`} onClick={() => { setActiveId(asset.id); setIsBatch(false); }}><SourcePreview asset={asset}/><strong>{asset.name}</strong><span>{selectedVariants.length} 结果待导出</span></button>)}</div></section>}

        </section>

        <aside className="control-rail">
          <div className="control-head"><div><span className="eyebrow">D / 模板专属参数</span><h2>{selectedTemplate.name}</h2></div><button className="icon-button" onClick={() => setParams(INITIAL_PARAMS)} title="重置当前工作参数"><RefreshCw size={15}/></button></div>
          <p className="control-description">{selectedTemplate.short}。此处只显示当前模板会使用的配置项；所有预览均在统一规范画布内等比完整显示。</p>
          {selectedStyle === "duotone" && <><div className="parameter-group"><div className="group-title"><Palette size={15}/><span>分层颜色</span></div><div className="color-row"><ColorField label="顶层颜色" color={params.primary} onChange={(value) => updateParam("primary", value)} /><ColorField label="底层颜色" color={params.secondary} onChange={(value) => updateParam("secondary", value)} /></div></div><div className="parameter-group"><div className="group-title"><WandSparkles size={15}/><span>层间投影</span></div><SliderField label="投影远近" value={params.shadowLength} min={8} max={76} suffix=" px" onChange={(value) => updateParam("shadowLength", value)} /></div></>}
          {selectedStyle === "gradient" && <div className="parameter-group"><div className="group-title"><Palette size={15}/><span>线性渐变</span></div><div className="color-row"><ColorField label="起始色" color={params.primary} onChange={(value) => updateParam("primary", value)} /><ColorField label="结束色" color={params.secondary} onChange={(value) => updateParam("secondary", value)} /></div><SliderField label="渐变角度" value={params.angle} min={0} max={360} suffix="°" onChange={(value) => updateParam("angle", value)} /></div>}
          {selectedStyle === "glass" && <><div className="parameter-group"><div className="group-title"><Palette size={15}/><span>玻璃着色</span></div><div className="color-row"><ColorField label="起始色" color={params.primary} onChange={(value) => updateParam("primary", value)} /><ColorField label="结束色" color={params.secondary} onChange={(value) => updateParam("secondary", value)} /></div><SliderField label="渐变角度" value={params.angle} min={0} max={360} suffix="°" onChange={(value) => updateParam("angle", value)} /></div><div className="parameter-group"><div className="group-title"><WandSparkles size={15}/><span>玻璃质感</span></div><SliderField label="材质透明度" value={params.opacity} min={20} max={94} suffix="%" onChange={(value) => updateParam("opacity", value)} /><SliderField label="磨砂模糊" value={params.blur} min={0} max={24} suffix=" px" onChange={(value) => updateParam("blur", value)} /><SliderField label="边缘高光" value={params.highlight} min={0} max={100} suffix="%" onChange={(value) => updateParam("highlight", value)} /></div></>}
          {selectedStyle === "extrude" && <><div className="parameter-group"><div className="group-title"><WandSparkles size={15}/><span>挤出结构</span></div><SliderField label="挤出厚度" value={params.extrusion} min={4} max={42} suffix=" px" onChange={(value) => updateParam("extrusion", value)} /><SliderField label="挤出角度" value={params.extrusionAngle} min={0} max={360} suffix="°" onChange={(value) => updateParam("extrusionAngle", value)} /></div><div className="parameter-group face-color-group"><div className="group-title"><Layers3 size={15}/><span>分面配色</span></div><p>顶面、侧面与正面分别应用独立颜色，挤出厚度与 3D 场景共用逐层结构。</p><div className="face-color-grid"><ColorField label="顶面" color={params.topColor} onChange={(value) => updateParam("topColor", value)} /><ColorField label="侧面" color={params.sideColor} onChange={(value) => updateParam("sideColor", value)} /><ColorField label="正面" color={params.frontColor} onChange={(value) => updateParam("frontColor", value)} /></div></div></>}
          {selectedStyle === "scene" && <><div className="parameter-group"><div className="group-title"><Palette size={15}/><span>主体颜色</span></div><div className="color-row"><ColorField label="起始色" color={params.primary} onChange={(value) => updateParam("primary", value)} /><ColorField label="结束色" color={params.secondary} onChange={(value) => updateParam("secondary", value)} /></div><SliderField label="渐变角度" value={params.angle} min={0} max={360} suffix="°" onChange={(value) => updateParam("angle", value)} /></div><div className="parameter-group"><div className="group-title"><WandSparkles size={15}/><span>实体与玻璃</span></div><SliderField label="挤出厚度" value={params.extrusion} min={4} max={42} suffix=" px" onChange={(value) => updateParam("extrusion", value)} /><SliderField label="材质透明度" value={params.opacity} min={20} max={94} suffix="%" onChange={(value) => updateParam("opacity", value)} /><SliderField label="磨砂模糊" value={params.blur} min={0} max={24} suffix=" px" onChange={(value) => updateParam("blur", value)} /><SliderField label="边缘高光" value={params.highlight} min={0} max={100} suffix="%" onChange={(value) => updateParam("highlight", value)} /></div><div className="parameter-group scene-assets"><div className="group-title"><Clapperboard size={15}/><span>场景素材</span></div><p>仅作用于「3D 插画场景」。所有素材将对齐同一套等轴透视。</p><button onClick={() => baseInput.current?.click()} className="scene-upload"><span className="scene-swatch base-swatch"/><div><strong>{params.sceneBase ? "已自定义底座" : "默认底座"}</strong><small>上传 SVG / PNG 覆盖</small></div><Upload size={15}/></button><button onClick={() => decorInput.current?.click()} className="scene-upload"><span className="scene-swatch decor-swatch"/><div><strong>{params.sceneDecor ? "已自定义装饰" : "默认周边装饰"}</strong><small>上传 SVG / PNG 覆盖</small></div><Upload size={15}/></button><input ref={baseInput} className="visually-hidden" type="file" accept="image/svg+xml,image/png" onChange={(event) => readSceneAsset(event, "sceneBase")} /><input ref={decorInput} className="visually-hidden" type="file" accept="image/svg+xml,image/png" onChange={(event) => readSceneAsset(event, "sceneDecor")} /></div></>}
          <div className="export-panel"><div className="export-head"><div><span className="eyebrow">E / 导出产物</span><h2>准备下载</h2></div><FileImage size={19}/></div><div className="format-options"><button onClick={() => setFormats((current) => current.includes("svg") ? current.filter((format) => format !== "svg") : [...current, "svg"])} className={formats.includes("svg") ? "format-option format-selected" : "format-option"}><span className="format-check">{formats.includes("svg") && <Check size={12}/>}</span><div><strong>可编辑 SVG</strong><small>保留轮廓与可编辑路径</small></div></button><button onClick={() => setFormats((current) => current.includes("png") ? current.filter((format) => format !== "png") : [...current, "png"])} className={formats.includes("png") ? "format-option format-selected" : "format-option"}><span className="format-check">{formats.includes("png") && <Check size={12}/>}</span><div><strong>透明底 PNG</strong><small>保留完整光影与玻璃质感</small></div></button></div><div className="resolution-row"><span>PNG 分辨率</span><div>{[2,3,4].map((value) => <button key={value} onClick={() => setResolution(value)} className={resolution === value ? "resolution-active" : ""}>{value}×</button>)}</div></div><p className="export-tip"><Sparkles size={14}/> 3D 与复杂玻璃效果导出 SVG 时会简化部分光影，想保留完整质感建议输出 PNG。</p><Button disabled={isExporting} onClick={exportBundle} className="bundle-button">{isExporting ? <RefreshCw className="spin-icon" size={16}/> : <ArrowDownToLine size={16}/>} {isExporting ? "正在打包…" : `打包下载 ${isBatch ? "批量结果" : "已选结果"}`}</Button>{exportNote && <p className="export-note"><Check size={13}/>{exportNote}</p>}</div>
        </aside>
      </main>
    </div>
  );
}
