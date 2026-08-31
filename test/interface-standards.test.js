import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');

function walk(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function token(name) {
  const css = readFileSync(path.join(SRC, 'index.css'), 'utf8');
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(match, `expected ${name} to be defined as a hex value`);
  return match[1];
}

test('text tokens meet the WCAG AA contrast minimum on every surface they sit on', () => {
  const surfaces = {
    'surface-card (white)': '#FFFFFF',
    'surface-page (paper)': '#FAFAF8',
    'surface-muted (mist)': '#E9EDF2',
  };

  for (const name of ['--color-ink-900', '--color-ink-700', '--color-ink-500', '--color-navy-900', '--color-navy-700']) {
    const colour = token(name);
    for (const [surfaceName, surface] of Object.entries(surfaces)) {
      const ratio = contrastRatio(colour, surface);
      assert.ok(
        ratio >= 4.5,
        `${name} (${colour}) on ${surfaceName} is ${ratio.toFixed(2)}:1, below the 4.5:1 minimum`,
      );
    }
  }
});

test('interface type never drops below the 12px floor', () => {
  // Certificate artwork renders at fixed physical dimensions and is then
  // scaled, so its type sizes are part of the design rather than UI chrome.
  const exempt = ['CertificatePreview.jsx', 'CertificateSignatureGrid.jsx', 'printCertificate.js'];
  const offenders = [];

  for (const file of walk(SRC)) {
    if (!/\.(css|jsx|js)$/.test(file)) continue;
    if (exempt.some(name => file.endsWith(name))) continue;
    const source = readFileSync(file, 'utf8');

    for (const [, size] of source.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      if (Number(size) < 12) offenders.push(`${path.relative(SRC, file)} font-size: ${size}px`);
    }
    for (const [, size] of source.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\s*[,}]/g)) {
      if (Number(size) < 12) offenders.push(`${path.relative(SRC, file)} fontSize: ${size}`);
    }
  }

  assert.deepEqual(offenders, [], `type below 12px:\n  ${offenders.join('\n  ')}`);
});

test('the legacy inline-style overrides only ever shrink', () => {
  // These selectors match on fragments of inline style attributes, so editing a
  // screen's inline styles silently changes its mobile behaviour. Screens are
  // being moved off them one at a time; this ratchet stops the file growing
  // back. Lower the budgets as more screens are converted.
  const css = readFileSync(path.join(SRC, 'responsive.css'), 'utf8');
  const inlineSelectors = (css.match(/style\*=/g) || []).length;
  const importantRules = (css.match(/!important/g) || []).length;

  // Started at 90 selectors and 68 !important rules before the conversion.
  assert.ok(inlineSelectors <= 33, `responsive.css has ${inlineSelectors} inline-style selectors, budget is 33`);
  assert.ok(importantRules <= 23, `responsive.css has ${importantRules} !important rules, budget is 23`);
});

test('every route-level screen can set its own document title', () => {
  const hook = readFileSync(path.join(SRC, 'lib', 'useDocumentTitle.js'), 'utf8');
  assert.match(hook, /document\.title/, 'the title hook should set document.title');
  assert.match(hook, /if \(!title\) return;/, 'an unresolved title should leave the previous one in place');
});
