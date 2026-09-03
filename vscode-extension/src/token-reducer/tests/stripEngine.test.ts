/**
 * Token Reducer — Unit Tests for stripEngine
 *
 * Run with: npx ts-mocha src/token-reducer/tests/stripEngine.test.ts
 */

import * as assert from 'assert';
import {
  applyUniversalRules,
  stripFillerPhrases,
  stripFileContent,
  stripPromptText,
  estimateTokens,
} from '../stripEngine';

// ─── Universal Rules ──────────────────────────────────────────────────────────

describe('applyUniversalRules', () => {
  it('removes trailing whitespace', () => {
    assert.strictEqual(applyUniversalRules('hello   \nworld  '), 'hello\nworld');
  });
  it('normalises CRLF to LF', () => {
    assert.strictEqual(applyUniversalRules('a\r\nb'), 'a\nb');
  });
  it('collapses 3+ blank lines to 1', () => {
    assert.strictEqual(applyUniversalRules('a\n\n\n\nb'), 'a\n\nb');
  });
  it('trims leading/trailing file whitespace', () => {
    assert.strictEqual(applyUniversalRules('\n\nhello\n\n'), 'hello');
  });
});

// ─── Filler Phrases ───────────────────────────────────────────────────────────

describe('stripFillerPhrases', () => {
  it('removes "please"', () => {
    assert.ok(!stripFillerPhrases('please fix this bug').includes('please'));
  });
  it('removes "can you"', () => {
    assert.ok(!stripFillerPhrases('can you help me').includes('can you'));
  });
  it('removes "thank you"', () => {
    assert.ok(!stripFillerPhrases('thank you for the help').includes('thank you'));
  });
  it('preserves technical content', () => {
    const result = stripFillerPhrases('please fix the null pointer in login.ts');
    assert.ok(result.includes('null pointer'));
    assert.ok(result.includes('login.ts'));
  });
});

// ─── Full Strip (JS/TS) ───────────────────────────────────────────────────────

describe('stripFileContent — JS/TS full strip', () => {
  const input = `
function hello() {
    const x = 1;
    return x;
}
`;
  it('removes leading indentation', () => {
    const result = stripFileContent(input, 'test.ts');
    assert.ok(!result.minified.includes('    '));
  });
  it('minified token count is less than original', () => {
    const result = stripFileContent(input, 'test.ts');
    assert.ok(result.minifiedTokenEstimate < result.originalTokenEstimate);
  });
  it('savedPercent > 0', () => {
    const result = stripFileContent(input, 'test.ts');
    assert.ok(result.savedPercent > 0);
  });
});

// ─── Python Relative Strip ────────────────────────────────────────────────────

describe('stripFileContent — Python relative strip', () => {
  const input = `
def greet(name):
    if name:
        print(name)
    return name
`;
  it('preserves relative indentation', () => {
    const result = stripFileContent(input, 'test.py');
    const lines = result.minified.split('\n');
    // if block should be indented more than def
    const defLine = lines.findIndex(l => l.startsWith('def'));
    const ifLine = lines.findIndex(l => l.trimStart().startsWith('if'));
    const printLine = lines.findIndex(l => l.trimStart().startsWith('print'));
    assert.ok(defLine >= 0 && ifLine >= 0 && printLine >= 0);
    const ifIndent = lines[ifLine].match(/^(\s*)/)?.[1].length ?? 0;
    const printIndent = lines[printLine].match(/^(\s*)/)?.[1].length ?? 0;
    assert.ok(printIndent > ifIndent, 'print should be more indented than if');
  });
  it('is not skipped', () => {
    const result = stripFileContent(input, 'test.py');
    assert.strictEqual(result.skipped, false);
  });
});

// ─── JSON Minification ────────────────────────────────────────────────────────

describe('stripFileContent — JSON', () => {
  const input = `{
  "name" : "test",
  "version" : "1.0.0"
}`;
  it('minifies to single line', () => {
    const result = stripFileContent(input, 'config.json');
    assert.strictEqual(result.minified, '{"name":"test","version":"1.0.0"}');
  });
});

// ─── Excluded Files ───────────────────────────────────────────────────────────

describe('stripFileContent — exclusions', () => {
  it('skips .png files', () => {
    const result = stripFileContent('binary', 'image.png');
    assert.strictEqual(result.skipped, true);
  });
  it('skips .lock files', () => {
    const result = stripFileContent('data', 'package.lock');
    assert.strictEqual(result.skipped, true);
  });
});

// ─── !full override ───────────────────────────────────────────────────────────

describe('stripFileContent — !full override', () => {
  it('returns original when fullOverride=true', () => {
    const content = 'function a(){\n    return 1;\n}';
    const result = stripFileContent(content, 'test.ts', { fullOverride: true });
    assert.strictEqual(result.minified, content);
    assert.strictEqual(result.skipped, true);
    assert.ok(result.skipReason?.includes('override'));
  });
});

// ─── Token Estimation ─────────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('4 chars ≈ 1 token', () => {
    assert.strictEqual(estimateTokens('abcd'), 1);
    assert.strictEqual(estimateTokens('abcdefgh'), 2);
  });
});

// ─── Prompt Strip ────────────────────────────────────────────────────────────

describe('stripPromptText', () => {
  it('reduces token count for filler-heavy prompt', () => {
    const prompt = 'Please can you help me fix the null pointer exception in the login service, thank you';
    const result = stripPromptText(prompt);
    assert.ok(result.minifiedTokenEstimate < result.originalTokenEstimate);
    assert.ok(result.minified.includes('null pointer exception'));
  });
});
