/**
 * Gemini API Token Comparison Test
 * 
 * Tests 3 code files: sends formatted (original) vs unformatted (stripped)
 * to Gemini 2.0 Flash and compares token usage + response quality.
 * 
 * Rate limit: 5 RPM, 20 RPD — 15s delay enforced between calls.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL   = 'gemini-2.0-flash';  // free tier
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// Delay between API calls (ms) — 15s keeps well under 5 RPM
const CALL_DELAY_MS = 15000;

// ─── Sample files ─────────────────────────────────────────────────────────────

const FILES = [
  { name: 'sample1.js',  lang: 'JavaScript' },
  { name: 'sample2.py',  lang: 'Python'     },
  { name: 'sample3.ts',  lang: 'TypeScript' },
];

// ─── Common prompt ────────────────────────────────────────────────────────────

const PROMPT = 'Explain what this code does in 2-3 sentences. Focus only on the core logic.';

// ─── Stripping (mirrors stripEngine logic, no imports needed) ─────────────────

function stripFormatted(content, filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  // Universal rules first
  let result = content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Python/YAML: preserve relative indent, normalise to 2-space
  if (ext === 'py' || ext === 'yml' || ext === 'yaml') {
    const lines = result.split('\n');
    const indents = lines.map(l => l.match(/^(\s+)/)?.[1].length ?? 0).filter(n => n > 0);
    const base = indents.length > 0 ? Math.min(...indents) : 4;
    return lines.map(line => {
      const m = line.match(/^(\s*)(.*)/);
      if (!m) return line;
      const [, spaces, rest] = m;
      if (!rest.trim()) return '';
      const level = Math.round(spaces.length / base);
      return ' '.repeat(level * 2) + rest.trimEnd();
    }).filter((l, i, a) => l.length > 0 || (i > 0 && a[i-1].length > 0)).join('\n').trim();
  }

  // JS/TS: full strip — remove all leading whitespace
  if (['js','jsx','ts','tsx','mjs','cjs','go','java','rs','cs'].includes(ext)) {
    return result
      .split('\n')
      .map(l => l.trimStart())
      .filter((l, i, a) => l.length > 0 || (i > 0 && a[i-1].length > 0))
      .join('\n')
      .trim();
  }

  return result;
}

// ─── Token estimator (4 chars ≈ 1 token) ─────────────────────────────────────

function estTokens(text) {
  return Math.ceil(text.length / 4);
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function callGemini(systemContext, userPrompt) {
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemContext}\n\n${userPrompt}` }]
      }
    ],
    generationConfig: {
      maxOutputTokens: 200,
      temperature: 0.1,
    }
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[No response]';
  const usageMeta = json.usageMetadata ?? {};

  return {
    responseText: text,
    promptTokens:    usageMeta.promptTokenCount    ?? estTokens(systemContext + userPrompt),
    outputTokens:    usageMeta.candidatesTokenCount ?? estTokens(text),
    totalTokens:     usageMeta.totalTokenCount      ?? estTokens(systemContext + userPrompt + text),
  };
}

// ─── Throttle helper ─────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error('Error: Please set the GEMINI_API_KEY environment variable.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Token Reducer — Gemini API Formatted vs Unformatted Test');
  console.log(`  Model : ${MODEL}`);
  console.log(`  Files : ${FILES.map(f => f.name).join(', ')}`);
  console.log(`  Prompt: "${PROMPT}"`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = [];
  let callCount = 0;

  for (const file of FILES) {
    const filePath = path.join(__dirname, file.name);
    const original = fs.readFileSync(filePath, 'utf8');
    const stripped = stripFormatted(original, file.name);

    const origEstTokens = estTokens(original);
    const stripEstTokens = estTokens(stripped);
    const localSavedPct = Math.round(((origEstTokens - stripEstTokens) / origEstTokens) * 100);

    console.log(`┌─ File: ${file.name} (${file.lang})`);
    console.log(`│  Formatted   : ${original.length} chars  (~${origEstTokens} tokens estimated)`);
    console.log(`│  Unformatted : ${stripped.length} chars  (~${stripEstTokens} tokens estimated)`);
    console.log(`│  Local save  : ${localSavedPct}%`);
    console.log('│');

    // ── Call 1: FORMATTED ─────────────────────────────────────────────────────
    callCount++;
    console.log(`│  [Call ${callCount}] Sending FORMATTED to Gemini...`);
    let formattedResult;
    try {
      formattedResult = await callGemini(
        `File: ${file.name}\n\n\`\`\`\n${original}\n\`\`\``,
        PROMPT
      );
      console.log(`│  ✅ Formatted  — prompt: ${formattedResult.promptTokens} tokens, output: ${formattedResult.outputTokens} tokens`);
      console.log(`│     Response  : "${formattedResult.responseText.replace(/\n/g, ' ').slice(0, 120)}..."`);
    } catch (e) {
      console.error(`│  ❌ Formatted call failed: ${e.message}`);
      formattedResult = { promptTokens: 0, outputTokens: 0, totalTokens: 0, responseText: 'ERROR' };
    }

    // Throttle: wait before next call
    console.log(`│  ⏳ Waiting ${CALL_DELAY_MS/1000}s before next call (rate limit)...`);
    await sleep(CALL_DELAY_MS);

    // ── Call 2: UNFORMATTED ───────────────────────────────────────────────────
    callCount++;
    console.log(`│  [Call ${callCount}] Sending UNFORMATTED to Gemini...`);
    let strippedResult;
    try {
      strippedResult = await callGemini(
        `File: ${file.name}\n\n\`\`\`\n${stripped}\n\`\`\``,
        PROMPT
      );
      console.log(`│  ✅ Unformatted — prompt: ${strippedResult.promptTokens} tokens, output: ${strippedResult.outputTokens} tokens`);
      console.log(`│     Response  : "${strippedResult.responseText.replace(/\n/g, ' ').slice(0, 120)}..."`);
    } catch (e) {
      console.error(`│  ❌ Unformatted call failed: ${e.message}`);
      strippedResult = { promptTokens: 0, outputTokens: 0, totalTokens: 0, responseText: 'ERROR' };
    }

    const promptTokenSaved = formattedResult.promptTokens - strippedResult.promptTokens;
    const promptSavedPct   = formattedResult.promptTokens > 0
      ? Math.round((promptTokenSaved / formattedResult.promptTokens) * 100)
      : 0;

    console.log('│');
    console.log(`│  📊 DELTA: ${promptTokenSaved} prompt tokens saved (${promptSavedPct}% reduction via API)`);
    console.log('└───────────────────────────────────────────────────────────\n');

    results.push({
      file: file.name,
      lang: file.lang,
      localEstimatedSavePct: localSavedPct,
      formatted: {
        chars: original.length,
        localEstTokens: origEstTokens,
        apiPromptTokens: formattedResult.promptTokens,
        apiOutputTokens: formattedResult.outputTokens,
        response: formattedResult.responseText,
      },
      unformatted: {
        chars: stripped.length,
        localEstTokens: stripEstTokens,
        apiPromptTokens: strippedResult.promptTokens,
        apiOutputTokens: strippedResult.outputTokens,
        response: strippedResult.responseText,
      },
      apiPromptTokensSaved: promptTokenSaved,
      apiSavedPct: promptSavedPct,
    });

    // Throttle between files too
    if (FILES.indexOf(file) < FILES.length - 1) {
      console.log(`⏳ Waiting ${CALL_DELAY_MS/1000}s between files...\n`);
      await sleep(CALL_DELAY_MS);
    }
  }

  // ─── Final Summary ──────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${'File'.padEnd(15)} ${'Fmt Tokens'.padStart(10)} ${'Unfmt Tokens'.padStart(13)} ${'API Saved'.padStart(10)} ${'Saved %'.padStart(8)}`);
  console.log('─'.repeat(60));
  for (const r of results) {
    console.log(
      `${r.file.padEnd(15)} ${String(r.formatted.apiPromptTokens).padStart(10)} ` +
      `${String(r.unformatted.apiPromptTokens).padStart(13)} ` +
      `${String(r.apiPromptTokensSaved).padStart(10)} ` +
      `${String(r.apiSavedPct + '%').padStart(8)}`
    );
  }

  const totalFmt   = results.reduce((s, r) => s + r.formatted.apiPromptTokens, 0);
  const totalUnfmt = results.reduce((s, r) => s + r.unformatted.apiPromptTokens, 0);
  const totalSaved = totalFmt - totalUnfmt;
  const totalPct   = totalFmt > 0 ? Math.round((totalSaved / totalFmt) * 100) : 0;
  console.log('─'.repeat(60));
  console.log(`${'TOTAL'.padEnd(15)} ${String(totalFmt).padStart(10)} ${String(totalUnfmt).padStart(13)} ${String(totalSaved).padStart(10)} ${String(totalPct + '%').padStart(8)}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Save JSON report
  const reportPath = path.join(__dirname, 'comparison-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`📄 Full report saved to: ${reportPath}`);
  console.log(`🔢 Total API calls made: ${callCount} / 20 daily`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
