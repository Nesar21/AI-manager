/**
 * Token Reducer — VS Code Integration Manager
 *
 * Registers with VS Code's Copilot Chat participant API to intercept
 * prompt text and attached files BEFORE they are sent to the model.
 *
 * All stripping happens in RAM. Original files are never modified.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { stripFileContent, stripPromptText, estimateTokens, StripOptions } from './stripEngine';
import { assemblePrompt, AttachedFile } from './promptAssembler';

const CONFIG_SECTION = 'aiEngineeringFluency.tokenReducer';
const STATUS_BAR_PRIORITY = 200;

// ─── Telemetry entry written to local log for EOD reconciliation ──────────────

export interface TokenReducerLogEntry {
  timestamp: string;
  originalTokens: number;
  minifiedTokens: number;
  savedTokens: number;
  savedPercent: number;
  filesProcessed: number;
}

// ─── Manager class ────────────────────────────────────────────────────────────

export class TokenReducerManager {
  private statusBarItem: vscode.StatusBarItem;
  private log: (message: string) => void;
  private telemetryLog: TokenReducerLogEntry[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    logFn: (message: string) => void
  ) {
    this.log = logFn;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_PRIORITY
    );
    this.statusBarItem.tooltip = 'Token Reducer: click for session summary';
    this.statusBarItem.command = 'aiEngineeringFluency.tokenReducerSummary';
    context.subscriptions.push(this.statusBarItem);

    // Register summary command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'aiEngineeringFluency.tokenReducerSummary',
        () => this.showSessionSummary()
      )
    );

    // Watch config changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(CONFIG_SECTION)) {
          this.log('Token Reducer config changed');
        }
      })
    );

    this.updateStatusBar(0, 0);
    this.statusBarItem.show();
    this.log('Token Reducer Manager initialised');
  }

  // ─── Check if enabled ───────────────────────────────────────────────────────

  public isEnabled(): boolean {
    return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>('enabled', true);
  }

  private getStripOptions(): StripOptions {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
      stripComments: cfg.get<boolean>('stripComments', false),
    };
  }

  // ─── File Intercept ─────────────────────────────────────────────────────────

  /**
   * Called when user attaches a file via #file: or / picker.
   * Returns stripped content in RAM. Original file untouched.
   *
   * @param filePath Absolute path to the file
   * @param overrideFlag Whether user appended !full
   */
  public processAttachedFile(filePath: string, overrideFlag = false): AttachedFile {
    const filename = path.basename(filePath);
    let content: string;

    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      this.log(`Token Reducer: could not read ${filePath}: ${err}`);
      return {
        filename,
        minifiedContent: '',
        originalTokens: 0,
        minifiedTokens: 0,
        savedPercent: 0,
        skipped: true,
        skipReason: 'File read error',
      };
    }

    const result = stripFileContent(content, filename, {
      ...this.getStripOptions(),
      fullOverride: overrideFlag,
    });

    this.log(
      `Token Reducer [${filename}]: ${result.originalTokenEstimate} → ` +
      `${result.minifiedTokenEstimate} tokens (-${result.savedPercent}%)` +
      (result.skipped ? ` [SKIPPED: ${result.skipReason}]` : '')
    );

    return {
      filename,
      minifiedContent: result.minified,
      originalTokens: result.originalTokenEstimate,
      minifiedTokens: result.minifiedTokenEstimate,
      savedPercent: result.savedPercent,
      skipped: result.skipped,
      skipReason: result.skipReason,
    };
  }

  // ─── Prompt Text Intercept ──────────────────────────────────────────────────

  /**
   * Called with raw user prompt text. Returns stripped version.
   */
  public processPrompt(rawPrompt: string): { minified: string; savedPercent: number; originalTokens: number; minifiedTokens: number } {
    const result = stripPromptText(rawPrompt);
    return {
      minified: result.minified,
      savedPercent: result.savedPercent,
      originalTokens: result.originalTokenEstimate,
      minifiedTokens: result.minifiedTokenEstimate,
    };
  }

  // ─── Full Prompt Assembly ───────────────────────────────────────────────────

  /**
   * Assembles final structured prompt and updates the status bar.
   */
  public buildFinalPrompt(
    rawPrompt: string,
    attachedFilePaths: Array<{ filePath: string; fullOverride: boolean }>
  ): string {
    if (!this.isEnabled()) {
      return rawPrompt;
    }

    // Strip prompt
    const promptResult = this.processPrompt(rawPrompt);

    // Strip each attached file
    const files: AttachedFile[] = attachedFilePaths.map(({ filePath, fullOverride }) =>
      this.processAttachedFile(filePath, fullOverride)
    );

    // Assemble structured prompt
    const assembled = assemblePrompt(
      promptResult.minified,
      files,
      {
        promptOriginalTokens: promptResult.originalTokens,
        promptMinifiedTokens: promptResult.minifiedTokens,
      }
    );

    // Update status bar and telemetry
    this.updateStatusBar(assembled.totalOriginalTokens, assembled.totalMinifiedTokens);
    this.logTelemetry({
      timestamp: new Date().toISOString(),
      originalTokens: assembled.totalOriginalTokens,
      minifiedTokens: assembled.totalMinifiedTokens,
      savedTokens: assembled.totalOriginalTokens - assembled.totalMinifiedTokens,
      savedPercent: assembled.totalSavedPercent,
      filesProcessed: files.filter(f => !f.skipped).length,
    });

    this.log(
      `Token Reducer: ${assembled.totalOriginalTokens} → ${assembled.totalMinifiedTokens} ` +
      `tokens total (-${assembled.totalSavedPercent}%)`
    );

    return assembled.structured;
  }

  // ─── Status Bar ─────────────────────────────────────────────────────────────

  private updateStatusBar(original: number, minified: number): void {
    if (original === 0) {
      this.statusBarItem.text = '$(zap) Token Reducer';
      return;
    }
    const saved = original - minified;
    const pct = Math.round((saved / original) * 100);
    this.statusBarItem.text = `$(zap) -${pct}% tokens (${saved.toLocaleString()} saved)`;
  }

  // ─── Session Summary ────────────────────────────────────────────────────────

  private showSessionSummary(): void {
    if (this.telemetryLog.length === 0) {
      vscode.window.showInformationMessage('Token Reducer: No prompts processed yet this session.');
      return;
    }

    const totalOriginal = this.telemetryLog.reduce((s, e) => s + e.originalTokens, 0);
    const totalMinified = this.telemetryLog.reduce((s, e) => s + e.minifiedTokens, 0);
    const totalSaved = totalOriginal - totalMinified;
    const avgPct = Math.round((totalSaved / totalOriginal) * 100);
    const prompts = this.telemetryLog.length;

    vscode.window.showInformationMessage(
      `Token Reducer — Session Summary\n` +
      `Prompts: ${prompts} | Original: ${totalOriginal.toLocaleString()} tokens | ` +
      `Sent: ${totalMinified.toLocaleString()} tokens | ` +
      `Saved: ${totalSaved.toLocaleString()} (${avgPct}%)`
    );
  }

  // ─── Telemetry ──────────────────────────────────────────────────────────────

  private logTelemetry(entry: TokenReducerLogEntry): void {
    this.telemetryLog.push(entry);
    // Expose for EOD reconciliation via the base extension's telemetry
    this.context.globalState.update(
      'tokenReducer.sessionLog',
      this.telemetryLog
    );
  }

  public getSessionLog(): TokenReducerLogEntry[] {
    return [...this.telemetryLog];
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}

// ─── Helper: parse !full override from a file reference string ───────────────

/**
 * Parses a Copilot file reference string like "src/auth/login.ts!full"
 * Returns the clean path and whether the override flag was present.
 */
export function parseFileReference(ref: string): { filePath: string; fullOverride: boolean } {
  if (ref.endsWith('!full')) {
    return { filePath: ref.slice(0, -5).trim(), fullOverride: true };
  }
  return { filePath: ref.trim(), fullOverride: false };
}
