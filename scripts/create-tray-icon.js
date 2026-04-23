const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = row + 1 + x * 4;
      raw[di] = rgba[si];
      raw[di + 1] = rgba[si + 1];
      raw[di + 2] = rgba[si + 2];
      raw[di + 3] = rgba[si + 3];
    }
  }

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", zlib.deflateSync(raw)),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ===== Gear icon generator =====
const size = 32;
const rgba = Buffer.alloc(size * size * 4);
const cx = size / 2;
const cy = size / 2;

// Gear parameters
const bodyRadius = 9; // inner ring radius
const outerRadius = 13; // tooth tip radius
const holeRadius = 4; // center hole radius
const teeth = 8; // number of teeth
const toothWidth = 0.35; // tooth angular width (fraction of tooth spacing)

// Colors
const R = 59,
  G = 130,
  B = 246; // #3b82f6

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const dx = x - cx + 0.5;
    const dy = y - cy + 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + Math.PI; // [0, 2PI]

    // Center hole
    if (dist <= holeRadius) {
      rgba[i + 3] = 0;
      continue;
    }

    // Tooth check: divide circle into teeth segments
    const toothSpacing = (Math.PI * 2) / teeth;
    const toothAngle = angle % toothSpacing;
    const halfTooth = toothSpacing * toothWidth * 0.5;
    const inToothRegion =
      toothAngle < halfTooth || toothAngle > toothSpacing - halfTooth;

    const effectiveOuter = inToothRegion ? outerRadius : bodyRadius;

    if (dist <= effectiveOuter) {
      rgba[i] = R;
      rgba[i + 1] = G;
      rgba[i + 2] = B;
      rgba[i + 3] = 255;

      // Anti-alias outer edge
      if (dist > effectiveOuter - 1.2) {
        const edgeFade = Math.max(0, Math.min(1, effectiveOuter - dist + 0.5));
        rgba[i + 3] = Math.round(255 * edgeFade);
      }
    } else {
      rgba[i + 3] = 0;
    }
  }
}

const outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });

// Write tray icon
const trayPath = path.join(outDir, "tray-icon.png");
fs.writeFileSync(trayPath, createPNG(size, size, rgba));
console.log("Created", trayPath);

// Write app icon (256x256 for Windows .ico source)
const iconSize = 256;
const iconRgba = Buffer.alloc(iconSize * iconSize * 4);
const icx = iconSize / 2;
const icy = iconSize / 2;
const iBody = 90;
const iOuter = 130;
const iHole = 40;
const iTeeth = 8;
const iToothWidth = 0.35;

for (let y = 0; y < iconSize; y++) {
  for (let x = 0; x < iconSize; x++) {
    const i = (y * iconSize + x) * 4;
    const dx = x - icx + 0.5;
    const dy = y - icy + 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + Math.PI;

    if (dist <= iHole) {
      iconRgba[i + 3] = 0;
      continue;
    }

    const toothSpacing = (Math.PI * 2) / iTeeth;
    const toothAngle = angle % toothSpacing;
    const halfTooth = toothSpacing * iToothWidth * 0.5;
    const inToothRegion =
      toothAngle < halfTooth || toothAngle > toothSpacing - halfTooth;
    const effectiveOuter = inToothRegion ? iOuter : iBody;

    if (dist <= effectiveOuter) {
      iconRgba[i] = R;
      iconRgba[i + 1] = G;
      iconRgba[i + 2] = B;
      iconRgba[i + 3] = 255;

      if (dist > effectiveOuter - 2) {
        const edgeFade = Math.max(0, Math.min(1, effectiveOuter - dist + 1));
        iconRgba[i + 3] = Math.round(255 * edgeFade);
      }
    } else {
      iconRgba[i + 3] = 0;
    }
  }
}

const iconPath = path.join(outDir, "app-icon.png");
fs.writeFileSync(iconPath, createPNG(iconSize, iconSize, iconRgba));
console.log("Created", iconPath);
