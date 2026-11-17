/**
 * Guards the Clean Architecture dependency rule: source code may only depend
 * on layers further in. Inner layers never know about frameworks or I/O.
 *
 *   app → presentation → infrastructure → application → domain
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, it } from 'node:test';

const SRC = dirname(new URL(import.meta.url).pathname);

type Layer = 'domain' | 'application' | 'infrastructure' | 'presentation' | 'app';

const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'application', 'infrastructure'],
  presentation: ['domain', 'application', 'infrastructure', 'presentation'],
  app: ['presentation', 'app'],
};

/** Inner layers must stay pure TypeScript: no packages at all. */
const MAY_USE_PACKAGES: Record<Layer, boolean> = {
  domain: false,
  application: false,
  infrastructure: true,
  presentation: true,
  app: true,
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

function layerOf(path: string): Layer {
  return relative(SRC, path).split('/')[0] as Layer;
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function resolveLayer(file: string, specifier: string): Layer | 'package' | 'style' {
  if (specifier.endsWith('.css')) return 'style';
  if (specifier.startsWith('@/')) return specifier.slice(2).split('/')[0] as Layer;
  if (specifier.startsWith('.')) return layerOf(normalize(join(dirname(file), specifier)));
  return 'package';
}

describe('architecture', () => {
  const files = sourceFiles(SRC);

  it('finds the source files', () => {
    assert.ok(files.length > 40);
  });

  for (const layer of Object.keys(ALLOWED) as Layer[]) {
    it(`${layer} only depends on ${ALLOWED[layer].join(', ')}`, () => {
      const violations: string[] = [];
      for (const file of files.filter((f) => layerOf(f) === layer)) {
        for (const specifier of importsOf(file)) {
          const target = resolveLayer(file, specifier);
          if (target === 'style') continue;
          const ok = target === 'package' ? MAY_USE_PACKAGES[layer] : ALLOWED[layer].includes(target);
          if (!ok) violations.push(`${relative(SRC, file)} → ${specifier}`);
        }
      }
      assert.deepEqual(violations, []);
    });
  }
});
