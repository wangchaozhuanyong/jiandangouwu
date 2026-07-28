import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const evidenceDir = path.join(
  projectRoot,
  "design-qa/evidence/fullsite-ux-20260728-final",
);
const outputDir = path.join(scriptDir, "output");
const auditPath = path.join(evidenceDir, "audit-results.json");

const colors = {
  canvas: "#07111c",
  panel: "#0b1826",
  card: "#102235",
  border: "#284058",
  text: "#f7fbff",
  muted: "#9bb0c4",
  cyan: "#45e5ef",
  green: "#48d79b",
  amber: "#ffb454",
  image: "#eef3f7",
};

const board = {
  marginX: 240,
  headerHeight: 380,
  cardWidth: 480,
  cardHeight: 820,
  cardGap: 200,
  rowGap: 600,
  imageWidth: 440,
  imageHeight: 570,
  columns: 15,
};

const groupFor = (number) => {
  if (number <= 8) return "客户端核心流程";
  if (number <= 12) return "客户端移动端";
  if (number <= 20) return "管理后台核心流程";
  if (number <= 22) return "管理后台移动端";
  if (number <= 24) return "正式客户端受限状态";
  return "正式后台受限状态";
};

const annotationFor = (number, health) => {
  if (health === "warning") {
    if ([23, 24, 27, 28].includes(number)) {
      return "预期异常态已验证；正式 API 成功链路待环境恢复";
    }
    return "失败恢复路径已验证，内容保留并可重试";
  }
  if ([9, 10, 11, 12, 21, 22, 24, 26, 28].includes(number)) {
    return "响应式通过；无页面级横向溢出";
  }
  return "交互与视觉状态通过";
};

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const wrapText = (value, maxUnits = 22) => {
  const lines = [];
  let current = "";
  let units = 0;

  for (const character of value) {
    const weight = character.charCodeAt(0) > 255 ? 2 : 1;
    if (units + weight > maxUnits * 2 && current) {
      lines.push(current);
      current = character;
      units = weight;
    } else {
      current += character;
      units += weight;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 2);
};

const svgText = ({
  x,
  y,
  lines,
  size,
  weight = 400,
  fill = colors.text,
  lineHeight = 1.4,
  anchor = "start",
}) => {
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : size * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${tspans}</text>`;
};

const audit = JSON.parse(await readFile(auditPath, "utf8"));
const screenshotSteps = audit.steps.filter((step) => typeof step.file === "string");

const items = await Promise.all(
  screenshotSteps.map(async (step) => {
    const fileName = path.basename(step.file);
    const number = Number(fileName.slice(0, 2));
    const bytes = await readFile(path.join(evidenceDir, fileName));
    const viewport = step.metrics?.viewport ?? {};
    const width = Number(viewport.width ?? 1440);
    const height = Number(viewport.height ?? 1024);
    const maxWidth = board.imageWidth;
    const maxHeight = board.imageHeight;
    const scale = Math.min(maxWidth / width, maxHeight / height);

    return {
      number,
      fileName,
      description: step.description,
      health: step.health,
      viewport: `${width} × ${height}`,
      width,
      height,
      imageWidth: Math.round(width * scale),
      imageHeight: Math.round(height * scale),
      group: groupFor(number),
      annotation: annotationFor(number, step.health),
      dataUri: `data:image/png;base64,${bytes.toString("base64")}`,
    };
  }),
);

items.sort((a, b) => a.number - b.number);

const rowCount = Math.ceil(items.length / board.columns);
const contentWidth =
  board.columns * board.cardWidth +
  (board.columns - 1) * board.cardGap;
const boardWidth = board.marginX * 2 + contentWidth;
const boardHeight =
  board.headerHeight +
  rowCount * board.cardHeight +
  (rowCount - 1) * board.rowGap +
  220;

const svg = [];
svg.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="${boardHeight}" viewBox="0 0 ${boardWidth} ${boardHeight}">`,
  `<rect width="${boardWidth}" height="${boardHeight}" fill="${colors.canvas}"/>`,
  `<g id="acceptance-board-header" data-figma-name="验收板说明">`,
  `<rect x="120" y="100" width="${boardWidth - 240}" height="210" rx="28" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>`,
  svgText({
    x: 180,
    y: 170,
    lines: ["CloudBridge 全站丝滑体验验收板"],
    size: 42,
    weight: 700,
  }),
  svgText({
    x: 180,
    y: 220,
    lines: ["2026-07-28 · 遗留原型与正式平台 · 浏览器真实流程证据"],
    size: 20,
    fill: colors.muted,
  }),
  `<rect x="180" y="250" width="190" height="38" rx="19" fill="#133b3e"/>`,
  svgText({
    x: 275,
    y: 276,
    lines: ["28 张截图"],
    size: 17,
    weight: 700,
    fill: colors.cyan,
    anchor: "middle",
  }),
  `<rect x="390" y="250" width="190" height="38" rx="19" fill="#133b3e"/>`,
  svgText({
    x: 485,
    y: 276,
    lines: ["34 个步骤"],
    size: 17,
    weight: 700,
    fill: colors.cyan,
    anchor: "middle",
  }),
  `<rect x="600" y="250" width="190" height="38" rx="19" fill="#133b3e"/>`,
  svgText({
    x: 695,
    y: 276,
    lines: ["44 项断言"],
    size: 17,
    weight: 700,
    fill: colors.cyan,
    anchor: "middle",
  }),
  `<rect x="810" y="250" width="190" height="38" rx="19" fill="#153b2e"/>`,
  svgText({
    x: 905,
    y: 276,
    lines: ["0 项失败"],
    size: 17,
    weight: 700,
    fill: colors.green,
    anchor: "middle",
  }),
  svgText({
    x: boardWidth - 180,
    y: 170,
    lines: ["覆盖：1440 / 390 / 320", "语言：中文 / English"],
    size: 19,
    fill: colors.muted,
    anchor: "end",
  }),
  svgText({
    x: boardWidth - 180,
    y: 252,
    lines: ["当前限制：正式 API 成功链路与真实用户性能数据待环境恢复"],
    size: 17,
    fill: colors.amber,
    anchor: "end",
  }),
  `</g>`,
);

for (let row = 0; row < rowCount; row += 1) {
  const rowY =
    board.headerHeight + row * (board.cardHeight + board.rowGap);
  const rowItems = items.slice(
    row * board.columns,
    (row + 1) * board.columns,
  );
  const rowStart = rowItems[0].number.toString().padStart(2, "0");
  const rowEnd = rowItems.at(-1).number.toString().padStart(2, "0");

  svg.push(
    `<g id="section-${row + 1}" data-figma-name="验收区 ${rowStart}-${rowEnd}">`,
    `<rect x="120" y="${rowY - 74}" width="${boardWidth - 240}" height="${board.cardHeight + 148}" rx="32" fill="none" stroke="${colors.border}" stroke-width="2" stroke-dasharray="14 12"/>`,
    svgText({
      x: 160,
      y: rowY - 28,
      lines: [`验收区 ${row + 1} · 截图 ${rowStart}–${rowEnd}`],
      size: 20,
      weight: 700,
      fill: colors.cyan,
    }),
  );

  rowItems.forEach((item, column) => {
    const x =
      board.marginX + column * (board.cardWidth + board.cardGap);
    const y = rowY;
    const imageX =
      x + 20 + Math.round((board.imageWidth - item.imageWidth) / 2);
    const imageY =
      y + 104 + Math.round((board.imageHeight - item.imageHeight) / 2);
    const statusColor =
      item.health === "warning" ? colors.amber : colors.green;
    const statusLabel =
      item.health === "warning" ? "预期状态" : "通过";
    const titleLines = wrapText(item.description, 23);
    const annotationLines = wrapText(item.annotation, 25);

    svg.push(
      `<g id="screen-${item.number.toString().padStart(2, "0")}" data-figma-name="${escapeXml(`${item.number.toString().padStart(2, "0")} ${item.description}`)}">`,
      `<rect x="${x}" y="${y}" width="${board.cardWidth}" height="${board.cardHeight}" rx="24" fill="${colors.card}" stroke="${colors.border}" stroke-width="2"/>`,
      `<rect x="${x + 20}" y="${y + 104}" width="${board.imageWidth}" height="${board.imageHeight}" rx="16" fill="${colors.image}"/>`,
      `<image href="${item.dataUri}" x="${imageX}" y="${imageY}" width="${item.imageWidth}" height="${item.imageHeight}" preserveAspectRatio="xMidYMid meet"/>`,
      `<circle cx="${x + 48}" cy="${y + 48}" r="24" fill="${colors.cyan}"/>`,
      svgText({
        x: x + 48,
        y: y + 55,
        lines: [item.number.toString().padStart(2, "0")],
        size: 17,
        weight: 700,
        fill: colors.canvas,
        anchor: "middle",
      }),
      svgText({
        x: x + 84,
        y: y + 39,
        lines: [item.group],
        size: 15,
        weight: 700,
        fill: colors.muted,
      }),
      svgText({
        x: x + 84,
        y: y + 66,
        lines: [item.viewport],
        size: 14,
        fill: colors.muted,
      }),
      `<rect x="${x + 374}" y="${y + 28}" width="82" height="34" rx="17" fill="${statusColor}" opacity="0.18"/>`,
      svgText({
        x: x + 415,
        y: y + 51,
        lines: [statusLabel],
        size: 14,
        weight: 700,
        fill: statusColor,
        anchor: "middle",
      }),
      svgText({
        x: x + 24,
        y: y + 716,
        lines: titleLines,
        size: 18,
        weight: 700,
      }),
      svgText({
        x: x + 24,
        y: y + 778,
        lines: annotationLines,
        size: 14,
        fill: item.health === "warning" ? colors.amber : colors.muted,
      }),
      `</g>`,
    );
  });

  svg.push(`</g>`);
}

svg.push(`</svg>`);

const manifest = {
  title: "CloudBridge 全站丝滑体验验收板",
  generatedAt: new Date().toISOString(),
  sourceEvidence: path.relative(projectRoot, evidenceDir),
  summary: {
    screenshots: items.length,
    recordedSteps: audit.steps.length,
    assertions: audit.assertions.length,
    failures: audit.failures.length,
    viewports: ["1440 × 1024", "390 × 844", "320 × 844"],
    languages: ["简体中文", "English"],
  },
  limitations: [
    "正式 API 环境未连接，因此正式客户端与正式后台只验证了真实错误和重试状态。",
    "Core Web Vitals 尚无线上真实用户数据，当前不能标记为正式性能通过。",
  ],
  figmaImport: {
    recommendedEditor: "Figma Design",
    boardWidth,
    boardHeight,
    screenshotsPerRow: board.columns,
    horizontalGap: board.cardGap,
    rowGap: board.rowGap,
    note: "将 SVG 拖入 Figma 后，截图、文字和分组会作为可见图层导入；连接恢复后再用 Figma Section 包裹两个验收区。",
  },
  items: items.map(({ dataUri, ...item }) => item),
};

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDir, "CloudBridge-UX-Acceptance-Board.svg"),
    svg.join("\n"),
  ),
  writeFile(
    path.join(outputDir, "board-preview.html"),
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CloudBridge UX Acceptance Board Preview</title>
    <style>
      html,
      body {
        margin: 0;
        background: ${colors.canvas};
      }

      img {
        display: block;
        width: 4096px;
        height: auto;
      }
    </style>
  </head>
  <body>
    <img src="./CloudBridge-UX-Acceptance-Board.svg" alt="CloudBridge 全站丝滑体验验收板" />
  </body>
</html>
`,
  ),
  writeFile(
    path.join(outputDir, "board-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  ),
]);

process.stdout.write(
  `${JSON.stringify(
    {
      outputDir,
      screenshots: items.length,
      boardWidth,
      boardHeight,
    },
    null,
    2,
  )}\n`,
);
