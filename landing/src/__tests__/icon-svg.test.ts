import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LOGO } from '@/lib/logo';

const svg = readFileSync(path.resolve(__dirname, '../app/icon.svg'), 'utf8');

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`<${tag}\\b[^>]*?\\s${name}="([^"]*)"`).exec(svg)?.[1];
}

describe('app/icon.svg', () => {
  it('uses the same geometry as lib/logo.ts', () => {
    expect(attr('svg', 'viewBox')).toBe(LOGO.viewBox);
    expect(Number(attr('circle', 'cx'))).toBe(LOGO.ring.cx);
    expect(Number(attr('circle', 'cy'))).toBe(LOGO.ring.cy);
    expect(Number(attr('circle', 'r'))).toBe(LOGO.ring.r);
    expect(Number(attr('circle', 'stroke-width'))).toBe(LOGO.ring.strokeWidth);
    expect(attr('polyline', 'points')).toBe(LOGO.check.points);
    expect(Number(attr('polyline', 'stroke-width'))).toBe(LOGO.check.strokeWidth);
  });

  it('is drawn in the design-system light primary on a transparent background', () => {
    expect(attr('svg', 'stroke')).toBe('#2678b6');
    expect(svg).not.toMatch(/<rect\b/);
  });
});
