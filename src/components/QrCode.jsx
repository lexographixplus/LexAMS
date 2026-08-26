import { useMemo } from 'react';

// Small dependency-free QR encoder for LexAMS public URLs.
// It emits Version 5 / Level L QR codes (37x37 modules), which comfortably
// fits the short tokenized LexAMS registration, pass, and check-in URLs.
const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const FORMAT_GENERATOR = 0x537;
const FORMAT_MASK = 0x5412;

function bitLength(value) {
  let n = 0;
  while (value) { n += 1; value >>>= 1; }
  return n;
}

function formatBits(maskPattern = 0) {
  // QR error correction bits: L = 01.
  const data = (1 << 3) | maskPattern;
  let d = data << 10;
  while (bitLength(d) - bitLength(FORMAT_GENERATOR) >= 0) {
    d ^= FORMAT_GENERATOR << (bitLength(d) - bitLength(FORMAT_GENERATOR));
  }
  return ((data << 10) | d) ^ FORMAT_MASK;
}

function gfMultiply(a, b) {
  let out = 0;
  while (b > 0) {
    if (b & 1) out ^= a;
    b >>>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
  }
  return out;
}

function generatorPolynomial(degree) {
  let poly = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMultiply(poly[j], root);
    }
    poly = next;
    root = gfMultiply(root, 2);
  }
  return poly;
}

function reedSolomon(data, count) {
  const gen = generatorPolynomial(count);
  const msg = [...data, ...new Array(count).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = msg[i];
    if (!factor) continue;
    for (let j = 0; j < gen.length; j += 1) {
      msg[i + j] ^= gfMultiply(gen[j], factor);
    }
  }
  return msg.slice(data.length);
}

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push(Boolean((value >>> i) & 1));
}

function encodePayload(value) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 106) throw new Error('QR payload is too long');
  const bits = [];
  pushBits(bits, 0b0100, 4); // byte mode
  pushBits(bits, bytes.length, 8);
  bytes.forEach(byte => pushBits(bits, byte, 8));

  const maxBits = DATA_CODEWORDS * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(false);
  while (bits.length % 8) bits.push(false);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | (bits[i + j] ? 1 : 0);
    codewords.push(byte);
  }
  let pad = true;
  while (codewords.length < DATA_CODEWORDS) {
    codewords.push(pad ? 0xec : 0x11);
    pad = !pad;
  }
  const ecc = reedSolomon(codewords, ECC_CODEWORDS);
  return [...codewords, ...ecc];
}

function setFinder(matrix, row, col) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) continue;
      const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (
        r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      );
      matrix[y][x] = dark;
    }
  }
}

function setAlignment(matrix, centerRow, centerCol) {
  if (matrix[centerRow][centerCol] !== null) return;
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      matrix[centerRow + r][centerCol + c] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }
}

function reserveFormat(matrix) {
  for (let i = 0; i < 15; i += 1) {
    let row;
    if (i < 6) row = i;
    else if (i < 8) row = i + 1;
    else row = SIZE - 15 + i;
    matrix[row][8] = false;

    let col;
    if (i < 8) col = SIZE - i - 1;
    else if (i === 8) col = 7;
    else col = 15 - i - 1;
    matrix[8][col] = false;
  }
  matrix[SIZE - 8][8] = true;
}

function placeFormat(matrix, maskPattern = 0) {
  const value = formatBits(maskPattern);
  for (let i = 0; i < 15; i += 1) {
    const dark = Boolean((value >>> i) & 1);
    let row;
    if (i < 6) row = i;
    else if (i < 8) row = i + 1;
    else row = SIZE - 15 + i;
    matrix[row][8] = dark;

    let col;
    if (i < 8) col = SIZE - i - 1;
    else if (i === 8) col = 7;
    else col = 15 - i - 1;
    matrix[8][col] = dark;
  }
  matrix[SIZE - 8][8] = true;
}

function qrMatrix(value) {
  const matrix = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  setFinder(matrix, 0, 0);
  setFinder(matrix, SIZE - 7, 0);
  setFinder(matrix, 0, SIZE - 7);
  setAlignment(matrix, 30, 30);

  for (let i = 8; i < SIZE - 8; i += 1) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }
  reserveFormat(matrix);

  const codewords = encodePayload(value);
  const bits = [];
  codewords.forEach(byte => pushBits(bits, byte, 8));
  let bitIndex = 0;
  let row = SIZE - 1;
  let direction = -1;
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = col - offset;
        if (matrix[row][x] !== null) continue;
        let dark = bitIndex < bits.length ? bits[bitIndex] : false;
        bitIndex += 1;
        if ((row + x) % 2 === 0) dark = !dark; // mask pattern 0
        matrix[row][x] = dark;
      }
      row += direction;
      if (row < 0 || row >= SIZE) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
  placeFormat(matrix, 0);
  return matrix;
}

export default function QrCode({ value, size = 184, label = 'QR code' }) {
  const matrix = useMemo(() => {
    try { return qrMatrix(String(value || '')); }
    catch { return null; }
  }, [value]);

  if (!matrix) {
    return <div style={{ width: size, minHeight: size, display: 'grid', placeItems: 'center', border: '1px solid var(--border-default)', borderRadius: 12, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 12 }}>QR unavailable<br/>Use the link or PIN instead.</div>;
  }

  const quiet = 4;
  const view = SIZE + quiet * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${view} ${view}`} role="img" aria-label={label} shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 10 }}>
      <rect width={view} height={view} fill="#fff" />
      {matrix.flatMap((row, y) => row.map((dark, x) => dark ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="#002B54" /> : null))}
    </svg>
  );
}
