import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDossier, htmlFacts, importOrder, isRelativeRef, resolveGamePath, sourceImports } from '../vendor/makefun-game.ts';

const ENTRY_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pngOrJpegDimensions(bytes) {
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return {
      format: 'png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  // JPEG SOF0/SOF2
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          format: 'jpeg',
          height: bytes.readUInt16BE(i + 5),
          width: bytes.readUInt16BE(i + 7),
        };
      }
      const segLen = bytes.readUInt16BE(i + 2);
      i += 2 + segLen;
    }
  }
  return null;
}

test('LICENSE exists and declares SPDX-License-Identifier: MIT', () => {
  const lic = readFileSync(join(ENTRY_ROOT, 'LICENSE'), 'utf8');
  assert.match(lic, /SPDX-License-Identifier:\s*MIT/);
  assert.match(lic, /Permission is hereby granted, free of charge/);
});

test('vendor/makefun-game.ts matches the official kit sha256 unchanged', () => {
  const bytes = readFileSync(join(ENTRY_ROOT, 'vendor', 'makefun-game.ts'));
  assert.equal(sha256(bytes), 'dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129');
});

test('game/ references are strictly local relative files with zero network URLs', () => {
  const gameDir = join(ENTRY_ROOT, 'game');
  const html = readFileSync(join(gameDir, 'index.html'), 'utf8');
  const facts = htmlFacts(html);

  assert.equal(facts.importMaps.length, 0);
  for (const link of facts.links) {
    assert.ok(isRelativeRef(link.href), `Non-relative link href: ${link.href}`);
    const resolved = resolveGamePath(link.href, 'index.html');
    assert.ok(resolved && existsSync(join(gameDir, resolved)), `Missing linked file: ${link.href}`);
  }
  for (const script of facts.scripts) {
    assert.ok(script.src && isRelativeRef(script.src), `Invalid script src: ${script.src}`);
    const resolved = resolveGamePath(script.src, 'index.html');
    assert.ok(resolved && existsSync(join(gameDir, resolved)), `Missing script: ${script.src}`);
  }

  const srcFiles = readdirSync(join(gameDir, 'src')).map((f) => ({
    path: `src/${f}`,
    bytes: readFileSync(join(gameDir, 'src', f)),
  }));
  const ordered = importOrder(srcFiles, facts);
  assert.ok(ordered.includes('src/main.js'));

  for (const sf of srcFiles) {
    const code = sf.bytes.toString('utf8');
    assert.equal(/\beval\s*\(|\bnew\s+Function\b|https?:\/\//.test(code), false, `Forbidden pattern in ${sf.path}`);
    for (const spec of sourceImports(code)) {
      const target = resolveGamePath(spec, sf.path);
      assert.ok(target && existsSync(join(gameDir, target)), `Broken import ${spec} in ${sf.path}`);
    }
  }
});

test('screenshots/ contains 3 or 4 valid PNG/JPEG captures meeting size and dimension limits', () => {
  const shotsDir = join(ENTRY_ROOT, 'screenshots');
  const files = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  assert.ok(files.length >= 3 && files.length <= 4, `Expected 3-4 screenshots, found ${files.length}`);

  for (const name of files) {
    assert.match(name, /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/);
    const full = join(shotsDir, name);
    const st = statSync(full);
    assert.ok(st.isFile() && st.size <= 262144, `${name} exceeds 256 KiB (${st.size})`);
    const dims = pngOrJpegDimensions(readFileSync(full));
    assert.ok(dims, `${name} is not a valid PNG or JPEG`);
    const longSide = Math.max(dims.width, dims.height);
    const shortSide = Math.min(dims.width, dims.height);
    assert.ok(longSide <= 1280, `${name} long side ${longSide} > 1280`);
    assert.ok(shortSide >= 480, `${name} short side ${shortSide} < 480`);
  }
});

test('main.ts executes cleanly, honors MAKEFUN_OUTPUT_DIR, is deterministic, and matches buildDossier', () => {
  const out1 = mkdtempSync(join(tmpdir(), 'makefun-out1-'));
  const out2 = mkdtempSync(join(tmpdir(), 'makefun-out2-'));
  try {
    execFileSync(process.execPath, [join(ENTRY_ROOT, 'main.ts')], {
      env: { ...process.env, MAKEFUN_OUTPUT_DIR: out1 },
    });
    execFileSync(process.execPath, [join(ENTRY_ROOT, 'main.ts')], {
      env: { ...process.env, MAKEFUN_OUTPUT_DIR: out2 },
    });

    const d1 = readFileSync(join(out1, 'dossier.json'));
    const d2 = readFileSync(join(out2, 'dossier.json'));
    assert.ok(d1.equals(d2), 'main.ts dossier.json output is not deterministic across runs');
    assert.ok(d1.length <= 1572864, `dossier.json exceeds 1.5 MiB (${d1.length})`);

    const expected = buildDossier(out1, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    });
    assert.ok(d1.equals(Buffer.from(expected)), 'dossier.json differs from buildDossier output');
  } finally {
    rmSync(out1, { recursive: true, force: true });
    rmSync(out2, { recursive: true, force: true });
  }
});
