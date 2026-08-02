const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..", "public", "characters", "interact");

async function crop(src, left, top, width, height, out) {
  await sharp(src)
    .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) })
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function main() {
  const idle = path.join(root, "sheet-idle.png");
  const miAct = path.join(root, "sheet-action-mi.png");
  const zhuAct = path.join(root, "sheet-action-zhu.png");

  // Idle sheet: bottom area 3 cols x 2 rows of scenes
  // Empirically: content grid starts ~y=430 after intro block
  const idleMeta = await sharp(idle).metadata();
  const iw = idleMeta.width;
  const ih = idleMeta.height;
  const gridTop = Math.round(ih * 0.42);
  const gridH = ih - gridTop - 8;
  const cellW = Math.floor(iw / 3);
  const cellH = Math.floor(gridH / 2);
  const idleNames = ["nuzzle", "snack", "sleep", "read", "hold", "feed"];
  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    await crop(
      idle,
      col * cellW + 6,
      gridTop + row * cellH + 4,
      cellW - 12,
      cellH - 10,
      path.join(root, "idle", `${idleNames[i]}.png`)
    );
  }

  // Mi-action sheet (fig2): 2x2 — spank, pinch / fart, hug
  // Note: fart panel is zhu farting on mi — used when zhu acts fart
  const miNames = [
    ["spank", 0, 0],
    ["pinch", 1, 0],
    ["fart_receive", 0, 1], // zhu farts at mi
    ["hug", 1, 1],
  ];
  const half = 512;
  for (const [name, c, r] of miNames) {
    await crop(miAct, c * half + 8, r * half + 8, half - 16, half - 16, path.join(root, "actions", `mi_${name}.png`));
  }

  // Zhu-action sheet (fig3): 1024x819 — 3 panels in one row? or 2+1
  // Visual: likely 3 columns one row, or top 2 bottom 1. Description says 3 panels.
  const zhuMeta = await sharp(zhuAct).metadata();
  const zw = zhuMeta.width;
  const zh = zhuMeta.height;
  // Try 3 equal columns full height
  const zCell = Math.floor(zw / 3);
  const zhuNames = ["spank", "pinch", "fart"];
  for (let i = 0; i < 3; i++) {
    await crop(
      zhuAct,
      i * zCell + 6,
      10,
      zCell - 12,
      zh - 20,
      path.join(root, "actions", `zhu_${zhuNames[i]}.png`)
    );
  }

  // Also extract standalone portraits from top of idle sheet for avatars/fallback
  await crop(idle, 40, 40, 280, 320, path.join(root, "portrait_mi.png"));
  await crop(idle, 400, 60, 300, 300, path.join(root, "portrait_zhu.png"));

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
