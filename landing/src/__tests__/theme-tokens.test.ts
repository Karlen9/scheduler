import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const LANDING = readFileSync(path.resolve(__dirname, '../styles/theme.css'), 'utf8');
const MINI_APP = readFileSync(
  path.resolve(__dirname, '../../../mini-app/src/styles/theme.css'),
  'utf8',
);

// Returns the body of the first top-level block that starts with `selector {`.
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`Missing block ${selector}`);
  }
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        return css.slice(css.indexOf('{', start) + 1, i);
      }
    }
  }
  throw new Error(`Unclosed block ${selector}`);
}

function tokens(body: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    result.set(name, value.trim());
  }
  return result;
}

const REQUIRED = [
  '--tg-theme-bg-color',
  '--tg-theme-text-color',
  '--tg-theme-hint-color',
  '--tg-theme-link-color',
  '--tg-theme-button-color',
  '--tg-theme-button-text-color',
  '--tg-theme-secondary-bg-color',
  '--app-text',
  '--app-subtext',
  '--app-primary',
  '--app-primary-text',
  '--app-destructive',
  '--app-divider',
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--primary',
  '--primary-foreground',
  '--muted-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--ring',
  '--radius',
  '--surface',
  '--surface-hover',
  '--surface-border',
  '--brand',
  '--brand-hover',
  '--status-pending-bg',
  '--status-confirmed-text',
  '--action-confirm-bg',
  '--timeline-1-bg',
  '--timeline-4-border',
  '--warning',
  '--success',
  '--error',
  '--card-shadow',
];

describe.each([
  [':root', 'light'],
  [':root.dark', 'dark'],
])('%s (%s theme)', (selector) => {
  const landing = tokens(block(LANDING, selector));
  const miniApp = tokens(block(MINI_APP, selector));

  it('keeps every landing token identical to the mini-app', () => {
    expect(landing.size).toBeGreaterThan(0);
    for (const [name, value] of landing) {
      expect(miniApp.get(name), `${selector} ${name}`).toBe(value);
    }
  });

  if (selector === ':root') {
    it('defines all required tokens', () => {
      for (const name of REQUIRED) {
        expect(landing.has(name), name).toBe(true);
      }
    });
  }
});

describe('theme.css', () => {
  it('keeps the dark custom variant', () => {
    expect(LANDING).toContain('@custom-variant dark (&:is(.dark *));');
  });
});
