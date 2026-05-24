import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

// Canary: verifies the no-hardcoded-hex ESLint rule fires on hex literals in components.
// Same discipline as the engine's entropy-ban rule — enforcement is only useful if
// the rule is proven to bite before it's trusted as a guardrail.

const NO_HEX_RULE: Parameters<Linter['verify']>[1] = {
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
        message: 'No raw hex colours — use CSS custom properties via var(--token) instead.',
      },
    ],
  },
};

describe('no-hardcoded-hex ESLint rule — canary', () => {
  it('BITES: reports error when component contains a raw 6-digit hex colour', () => {
    const linter = new Linter();
    const code = `
      export function BadButton() {
        return <button style={{ color: '#ff0000' }}>Click</button>;
      }
    `;
    const messages = linter.verify(code, NO_HEX_RULE);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0]?.message).toContain('No raw hex colours');
  });

  it('BITES: reports error for 3-digit shorthand hex', () => {
    const linter = new Linter();
    const code = `const c = '#fff';`;
    const messages = linter.verify(code, NO_HEX_RULE);
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('PASSES: does not report when component uses CSS var()', () => {
    const linter = new Linter();
    const code = `
      export function GoodButton() {
        return <button style={{ color: 'var(--fg-default)' }}>Click</button>;
      }
    `;
    const messages = linter.verify(code, NO_HEX_RULE);
    expect(messages).toHaveLength(0);
  });

  it('PASSES: does not report non-hex strings that start with #', () => {
    const linter = new Linter();
    const code = `const id = '#my-anchor-link';`;
    const messages = linter.verify(code, NO_HEX_RULE);
    // Anchor-like strings are not hex — rule only fires on valid hex patterns
    expect(messages).toHaveLength(0);
  });
});
