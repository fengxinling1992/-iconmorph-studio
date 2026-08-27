# 用户图标库导入记录

- **来源文件：** `/home/ubuntu/upload/iconfont.html`。
- **原始结构：** 内嵌 `groups`、`icons` JSON 与 `fontBase64` WOFF2 图标字体。
- **转换方式：** 通过 `fontTools` 提取每个 Unicode 字形为上翻后的真实 SVG 路径，保留图标名称、编码和原始分组 ID。
- **导出资源：** `/manus-storage/iconfont-library_a900fc9a.json`。
- **规模：** 18 个非空分组、2,981 枚图标；最大单组 340 枚，左侧按活动分组或搜索结果渲染。
- **兼容性：** 生成的资产使用标准 `<svg viewBox>` 与 `<path>`，可直接进入 IconMorph 的轮廓采样、渐变、2.5D/3D 与导出流程。
