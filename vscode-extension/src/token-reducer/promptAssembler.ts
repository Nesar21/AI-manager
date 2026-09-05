/**
 * Token Reducer — Structured Prompt Assembler
 * Assembles minified file contents + user prompt into a structured schema.
 * Static content (files) goes FIRST to trigger LLM prompt cache discounts.
 */

export interface AttachedFile {
  filename: string;
  minifiedContent: string;
  originalTokens: number;
  minifiedTokens: number;
  savedPercent: number;
  skipped: boolean;
  skipReason?: string;
}

export interface AssembledPrompt {
  structured: string;
  totalOriginalTokens: number;
  totalMinifiedTokens: number;
  totalSavedPercent: number;
}

/**
 * Assembles the final prompt in token-efficient order:
 * 1. [FILES]    — static, cache-friendly (largest savings)
 * 2. [OBJECTIVE] — user's stripped query
 * 3. [CONSTRAINTS] — optional
 * 4. [HANDOFF]   — optional prior context / expected output
 */
export function assemblePrompt(
  strippedPrompt: string,
  files: AttachedFile[],
  opts: {
    constraints?: string;
    handoff?: string;
    promptOriginalTokens: number;
    promptMinifiedTokens: number;
  }
): AssembledPrompt {
  const parts: string[] = [];

  // 1. FILES first (static → cached by LLM provider)
  if (files.length > 0) {
    parts.push('[FILES]');
    for (const f of files) {
      parts.push(`// ${f.filename}`);
      parts.push(f.minifiedContent);
      parts.push('');
    }
  }

  // 2. OBJECTIVE (user query)
  parts.push(`[OBJECTIVE]: ${strippedPrompt}`);

  // 3. CONSTRAINTS (optional)
  if (opts.constraints?.trim()) {
    parts.push(`[CONSTRAINTS]: ${opts.constraints.trim()}`);
  }

  // 4. HANDOFF (optional prior context + expected output)
  if (opts.handoff?.trim()) {
    parts.push(`[HANDOFF]: ${opts.handoff.trim()}`);
  }

  const structured = parts.join('\n');

  // Token accounting
  const fileOriginalTokens = files.reduce((s, f) => s + f.originalTokens, 0);
  const fileMinifiedTokens = files.reduce((s, f) => s + f.minifiedTokens, 0);
  const totalOriginalTokens = opts.promptOriginalTokens + fileOriginalTokens;
  const totalMinifiedTokens = opts.promptMinifiedTokens + fileMinifiedTokens;
  const totalSavedPercent = totalOriginalTokens > 0
    ? Math.round(((totalOriginalTokens - totalMinifiedTokens) / totalOriginalTokens) * 100)
    : 0;

  return { structured, totalOriginalTokens, totalMinifiedTokens, totalSavedPercent };
}
