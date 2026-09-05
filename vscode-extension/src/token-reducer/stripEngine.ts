/**
 * Token Reducer — Stripping Rules Engine
 * Runs entirely in RAM. No disk writes.
 */

// ─── Language Classification ──────────────────────────────────────────────────

/** Languages where indentation is purely cosmetic — safe to fully strip */
const FULL_STRIP_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'go', 'java', 'rs', 'cs', 'cpp', 'c', 'h',
  'php', 'rb', 'kt', 'swift', 'scala',
]);

/** Languages where indentation is syntactic — only collapse excess */
const RELATIVE_STRIP_EXTENSIONS = new Set([
  'py', 'pyw', 'yaml', 'yml',
]);

/** Data formats — full minification safe */
const MINIFY_EXTENSIONS = new Set([
  'json', 'jsonc',
]);

/** Always excluded */
const EXCLUDED_EXTENSIONS = new Set([
  'png','jpg','jpeg','gif','svg','ico','webp',
  'mp4','mov','avi','mkv',
  'woff','woff2','ttf','eot',
  'zip','tar','gz','rar',
  'exe','dll','so','dylib',
  'pdf','docx','xlsx',
]);

/** Max file size to process: 100 KB */
const MAX_FILE_BYTES = 100 * 1024;

// ─── Filler Phrases ───────────────────────────────────────────────────────────

const FILLER_PATTERNS: RegExp[] = [
  /\b(please|kindly)\b\s*/gi,
  /\bcan you\b\s*/gi,
  /\bcould you\b\s*/gi,
  /\bi want you to\b\s*/gi,
  /\bi need you to\b\s*/gi,
  /\bwould you\b\s*/gi,
  /\bi would like you to\b\s*/gi,
  /\bthank(?:s| you)[.!]?\s*/gi,
  /\bhelp me\b\s*/gi,
];

// ─── Rule Group A: Universal ──────────────────────────────────────────────────

export function applyUniversalRules(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Prompt Filler Removal ────────────────────────────────────────────────────

export function stripFillerPhrases(prompt: string): string {
  let result = prompt;
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.replace(/  +/g, ' ').trim();
}

// ─── Rule Group B: Full Strip (JS/TS/Go etc.) ────────────────────────────────

function fullStripCode(content: string, stripComments: boolean): string {
  let lines = content.split('\n');
  if (stripComments) {
    lines = removeInlineComments(lines);
    lines = removeBlockComments(lines);
  }
  return lines
    .map(line => line.trimStart())
    .filter((line, i, arr) => {
      if (line.length > 0) { return true; }
      return i > 0 && arr[i - 1].length > 0;
    })
    .join('\n')
    .trim();
}

// ─── Rule Group B: Relative Strip (Python/YAML) ──────────────────────────────

function relativeStripCode(content: string, stripComments: boolean): string {
  let lines = content.split('\n');
  if (stripComments) {
    lines = removeInlineComments(lines, '#');
  }
  const indents = lines
    .map(l => l.match(/^(\s+)/)?.[1].length ?? 0)
    .filter(n => n > 0);
  const baseIndent = indents.length > 0 ? Math.min(...indents) : 4;
  const targetUnit = 2;

  return lines
    .map(line => {
      const match = line.match(/^(\s*)(.*)/);
      if (!match) { return line; }
      const [, spaces, rest] = match;
      if (!rest.trim()) { return ''; }
      const level = Math.round(spaces.length / baseIndent);
      return ' '.repeat(level * targetUnit) + rest.trimEnd();
    })
    .filter((line, i, arr) => {
      if (line.length > 0) { return true; }
      return i > 0 && arr[i - 1].length > 0;
    })
    .join('\n')
    .trim();
}

// ─── Rule Group C: JSON ───────────────────────────────────────────────────────

function minifyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content));
  } catch {
    return applyUniversalRules(content);
  }
}

// ─── Comment Helpers ──────────────────────────────────────────────────────────

function removeInlineComments(lines: string[], commentChar?: string): string[] {
  const marker = commentChar ?? '//';
  return lines.map(line => {
    const idx = line.indexOf(marker);
    if (idx === -1) { return line; }
    const before = line.slice(0, idx);
    const sq = (before.match(/'/g) || []).length % 2;
    const dq = (before.match(/"/g) || []).length % 2;
    if (sq !== 0 || dq !== 0) { return line; }
    return before.trimEnd();
  }).filter(l => l.trim().length > 0);
}

function removeBlockComments(lines: string[]): string[] {
  const joined = lines.join('\n');
  const stripped = joined
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/'''[\s\S]*?'''/g, '');
  return stripped.split('\n').filter(l => l.trim().length > 0);
}

// ─── Token Estimation ─────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface StripOptions {
  stripComments?: boolean;
  fullOverride?: boolean;
}

export interface StripResult {
  original: string;
  minified: string;
  originalTokenEstimate: number;
  minifiedTokenEstimate: number;
  savedPercent: number;
  language: string;
  skipped: boolean;
  skipReason?: string;
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function stripFileContent(
  content: string,
  filename: string,
  options: StripOptions = {}
): StripResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const byteSize = Buffer.byteLength(content, 'utf8');
  const originalTokens = estimateTokens(content);

  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return makeSkipped(content, originalTokens, 'Binary or lock file — excluded');
  }
  if (byteSize > MAX_FILE_BYTES) {
    return makeSkipped(content, originalTokens, 'File > 100KB — excluded');
  }
  if (options.fullOverride) {
    return makeSkipped(content, originalTokens, 'User override (!full)');
  }

  let minified: string;
  let language: string;

  if (MINIFY_EXTENSIONS.has(ext)) {
    language = 'json';
    minified = minifyJson(content);
  } else if (FULL_STRIP_EXTENSIONS.has(ext)) {
    language = ext;
    minified = fullStripCode(applyUniversalRules(content), options.stripComments ?? false);
  } else if (RELATIVE_STRIP_EXTENSIONS.has(ext)) {
    language = ext;
    minified = relativeStripCode(applyUniversalRules(content), options.stripComments ?? false);
  } else {
    language = ext || 'unknown';
    minified = applyUniversalRules(content);
  }

  const minifiedTokens = estimateTokens(minified);
  const savedPercent = originalTokens > 0
    ? Math.round(((originalTokens - minifiedTokens) / originalTokens) * 100)
    : 0;

  return { original: content, minified, originalTokenEstimate: originalTokens,
    minifiedTokenEstimate: minifiedTokens, savedPercent, language, skipped: false };
}

export function stripPromptText(prompt: string): StripResult {
  const originalTokens = estimateTokens(prompt);
  const minified = applyUniversalRules(stripFillerPhrases(prompt));
  const minifiedTokens = estimateTokens(minified);
  const savedPercent = originalTokens > 0
    ? Math.round(((originalTokens - minifiedTokens) / originalTokens) * 100)
    : 0;
  return { original: prompt, minified, originalTokenEstimate: originalTokens,
    minifiedTokenEstimate: minifiedTokens, savedPercent, language: 'prompt', skipped: false };
}

function makeSkipped(content: string, tokens: number, reason: string): StripResult {
  return { original: content, minified: content, originalTokenEstimate: tokens,
    minifiedTokenEstimate: tokens, savedPercent: 0, language: 'skipped', skipped: true,
    skipReason: reason };
}
