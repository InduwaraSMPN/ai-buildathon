import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1200;
const H = 630;

// Brand palette — matches tokens.css / logo
const C = {
	veil: [244, 244, 245], // #f4f4f5
	paper: [255, 255, 255],
	ink: [9, 9, 11], // #09090b approx
	slate: [82, 82, 91], // #52525b
	muted: [113, 113, 122], // #71717a
	brand: [0, 130, 54], // #008236
	ruleSoft: [228, 228, 231], // #e4e4e7
	ruleFaint: [228, 228, 231], // same, will use as 1px
};

// Simple 5x7 pixel font for ASCII (only chars we need). Each char is 5 columns x 7 rows.
// Bits: row 0 top. 1 = filled.
// Source: tiny handmade font, sufficient for OG placeholder.
const FONT5x7 = {
	" ": [0, 0, 0, 0, 0, 0, 0],
	A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
	B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
	C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
	D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
	E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
	F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
	G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
	H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
	I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
	J: [0b00111, 0b00010, 0b00010, 0b00010, 0b10010, 0b10010, 0b01100],
	K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
	L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
	M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
	N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
	O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
	P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
	Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
	R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
	S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
	T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
	U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
	V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
	W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
	X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
	Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
	Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
	a: [0b00000, 0b00000, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111],
	b: [0b10000, 0b10000, 0b10110, 0b11001, 0b10001, 0b10001, 0b11110],
	c: [0b00000, 0b00000, 0b01110, 0b10001, 0b10000, 0b10001, 0b01110],
	d: [0b00001, 0b00001, 0b01101, 0b10011, 0b10001, 0b10001, 0b01111],
	e: [0b00000, 0b00000, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110],
	f: [0b00110, 0b01001, 0b01000, 0b11100, 0b01000, 0b01000, 0b01000],
	g: [0b00000, 0b01111, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110],
	h: [0b10000, 0b10000, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001],
	i: [0b00100, 0b00000, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110],
	j: [0b00010, 0b00000, 0b00110, 0b00010, 0b00010, 0b10010, 0b01100],
	k: [0b10000, 0b10000, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010],
	l: [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
	m: [0b00000, 0b00000, 0b11010, 0b10101, 0b10101, 0b10101, 0b10101],
	n: [0b00000, 0b00000, 0b10110, 0b11001, 0b10001, 0b10001, 0b10001],
	o: [0b00000, 0b00000, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
	p: [0b00000, 0b10110, 0b11001, 0b10001, 0b11110, 0b10000, 0b10000],
	q: [0b00000, 0b01101, 0b10011, 0b10001, 0b01111, 0b00001, 0b00001],
	r: [0b00000, 0b00000, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000],
	s: [0b00000, 0b00000, 0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
	t: [0b01000, 0b01000, 0b11100, 0b01000, 0b01000, 0b01001, 0b00110],
	u: [0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b10011, 0b01101],
	v: [0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
	w: [0b00000, 0b00000, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
	x: [0b00000, 0b00000, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
	y: [0b00000, 0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b01000],
	z: [0b00000, 0b00000, 0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
	".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
	",": [0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b00100, 0b01000],
	"-": [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
	"/": [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b10000, 0b00000],
	":": [0b00000, 0b01100, 0b01100, 0b00000, 0b01100, 0b01100, 0b00000],
	"—": [0b00000, 0b00000, 0b00000, 0b11111, 0b11111, 0b00000, 0b00000],
	"→": [0b00000, 0b00100, 0b00010, 0b11111, 0b00010, 0b00100, 0b00000],
};

function drawBuffer() {
	// RGBA buffer for simplicity then convert to RGB for PNG
	// We'll use RGB only for PNG truecolor.
	const stride = W * 3;
	const raw = Buffer.alloc((stride + 1) * H); // +1 filter byte per row
	let offset = 0;
	for (let y = 0; y < H; y++) {
		raw[offset++] = 0; // filter type 0
		for (let x = 0; x < W; x++) {
			let r = C.veil[0],
				g = C.veil[1],
				b = C.veil[2];
			// Panel: rounded rect approx (axis-aligned, no radius for PNG simplicity)
			const inPanel = x >= 24 && x < 24 + 1152 && y >= 24 && y < 24 + 582;
			if (inPanel) {
				r = C.paper[0];
				g = C.paper[1];
				b = C.paper[2];
				// 1px border inside panel edge
				if (x === 24 || x === 24 + 1152 - 1 || y === 24 || y === 24 + 582 - 1) {
					r = C.ruleSoft[0];
					g = C.ruleSoft[1];
					b = C.ruleSoft[2];
				}
			}
			// Brand green top accent 64x4 at 72,72
			if (x >= 72 && x < 136 && y >= 72 && y < 76) {
				r = C.brand[0];
				g = C.brand[1];
				b = C.brand[2];
			}
			// Faint rule 1056x1 at 72,96 -> use ruleSoft 1px
			if (y === 96 && x >= 72 && x < 72 + 1056) {
				// mix 8% ink over paper -> approximate
				r = 240;
				g = 240;
				b = 241;
				if (inPanel) {
					// keep subtle
				}
			}
			// Bottom rule at 484
			if (y === 484 && x >= 72 && x < 72 + 1056) {
				r = 240;
				g = 240;
				b = 241;
			}
			// Small dossier hint box bottom-right: rect 100x64 at 1028,494
			if (x >= 1028 && x < 1128 && y >= 494 && y < 558) {
				const onBorder = x === 1028 || x === 1127 || y === 494 || y === 557;
				if (onBorder) {
					r = C.ink[0];
					g = C.ink[1];
					b = C.ink[2];
					// lower opacity approx 0.10 => mix with paper
					// blend: 10% ink + 90% paper
					r = Math.round(0.1 * C.ink[0] + 0.9 * C.paper[0]);
					g = Math.round(0.1 * C.ink[1] + 0.9 * C.paper[1]);
					b = Math.round(0.1 * C.ink[2] + 0.9 * C.paper[2]);
				} else if ((y === 520 && x >= 1044 && x < 1112) || (y === 536 && x >= 1044 && x < 1096)) {
					r = Math.round(0.1 * C.ink[0] + 0.9 * C.paper[0]);
					g = Math.round(0.1 * C.ink[1] + 0.9 * C.paper[1]);
					b = Math.round(0.1 * C.ink[2] + 0.9 * C.paper[2]);
				}
			}
			raw[offset++] = r;
			raw[offset++] = g;
			raw[offset++] = b;
		}
	}
	return raw;
}

// Text rendering with pixel font, scaled.
function drawText(raw, text, x0, y0, scale, color) {
	const charW = 5 * scale + scale; // +1 gap
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		// Normalize accented chars
		let key = ch;
		if (ch === "ō" || ch === "Ō") key = ch === "ō" ? "o" : "O";
		if (ch === "—") key = "—";
		const glyph = FONT5x7[key] ?? FONT5x7[" "] ?? [0, 0, 0, 0, 0, 0, 0];
		const cx = x0 + i * charW;
		for (let row = 0; row < 7; row++) {
			const bits = glyph[row];
			for (let col = 0; col < 5; col++) {
				const bit = (bits >> (4 - col)) & 1;
				if (!bit) continue;
				for (let sy = 0; sy < scale; sy++) {
					for (let sx = 0; sx < scale; sx++) {
						const px = cx + col * scale + sx;
						const py = y0 + row * scale + sy;
						if (px < 0 || px >= W || py < 0 || py >= H) continue;
						const idx = py * (W * 3 + 1) + 1 + px * 3;
						raw[idx] = color[0];
						raw[idx + 1] = color[1];
						raw[idx + 2] = color[2];
					}
				}
			}
		}
	}
}

function crc32(buf) {
	let table = crc32.table;
	if (!table) {
		table = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			table[n] = c;
		}
		crc32.table = table;
	}
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(typeStr, data) {
	const type = Buffer.from(typeStr, "ascii");
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const crcBuf = Buffer.alloc(4);
	const crcVal = crc32(Buffer.concat([type, data]));
	crcBuf.writeUInt32BE(crcVal >>> 0, 0);
	return Buffer.concat([len, type, data, crcBuf]);
}

function buildPNG(raw) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(W, 0);
	ihdr.writeUInt32BE(H, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type truecolor
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;
	const ihdrChunk = chunk("IHDR", ihdr);
	const compressed = deflateSync(raw);
	const idatChunk = chunk("IDAT", compressed);
	const iendChunk = chunk("IEND", Buffer.alloc(0));
	return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const raw = drawBuffer();
// Draw text layers — scale chosen to approximate design
// Eyebrow 13px mono -> scale 2 yields ~14px tall (7*2)
drawText(raw, "AI IT SUPPORT / ONE ACCOUNTABLE LOOP", 72, 124, 2, C.muted);
// Axioma wordmark: large — scale 8 => 56px tall, wide
drawText(raw, "Axioma", 72, 184, 8, C.ink);
// Subtitle: from symptom to resolution.
drawText(raw, "from symptom to resolution.", 72, 292, 3, C.ink);
// Brand dot for the word 'to' — recolor that word segment? Keep ink for simplicity; brand emphasis via green dot already at top.
// Lede lines scale 2
drawText(raw, "Gives Axel the context and tools to carry a ticket", 72, 360, 2, C.slate);
drawText(raw, "from report to verified fix - or a clear handoff.", 72, 384, 2, C.slate);
// Bottom meta
drawText(raw, "AXIOMA.DEV", 72, 496, 2, C.muted);
drawText(raw, "TICKET -> EVIDENCE -> ACTION -> OUTCOME", 72, 520, 2, C.muted);

const png = buildPNG(raw);
const outPath = join(process.cwd(), "public", "og.png");
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} ${W}x${H} ${png.length} bytes`);
