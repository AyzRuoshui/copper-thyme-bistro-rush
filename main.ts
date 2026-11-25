import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const ENTRY_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyEntryDirectory(sourceSubdir: string, targetSubdir: string): void {
  const src = join(ENTRY_ROOT, sourceSubdir);
  const dst = join(OUTPUT_DIR, targetSubdir);
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  if (existsSync(src)) {
    cpSync(src, dst, { recursive: true });
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });
copyEntryDirectory('game', 'game');
copyEntryDirectory('screenshots', 'screenshots');

const dossierBytes = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossierBytes);
