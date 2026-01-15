const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIcoMod = require("png-to-ico");
const pngToIco = pngToIcoMod.default || pngToIcoMod;

(async () => {
  const src = path.join(__dirname, "..", "assets", "icon.png");
  const out = path.join(__dirname, "..", "assets", "icon.ico");
  const tmpDir = path.join(__dirname, "..", "assets", "_ico_tmp");

  if (!fs.existsSync(src)) throw new Error("Nao achei: " + src);

  fs.mkdirSync(tmpDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const files = [];

  for (const s of sizes) {
    const p = path.join(tmpDir, `icon-${s}.png`);
    await sharp(src)
      .resize(s, s, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(p);
    files.push(p);
  }

  const buf = await pngToIco(files);
  fs.writeFileSync(out, buf);

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("OK ->", out);
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
