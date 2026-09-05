# AI Manager

> **The all-in-one platform for AI Token Optimization, Real-Time Context Minification, Cost Intelligence, and LLM Telemetry.**

AI Manager brings deep visibility, real-time optimization, and cost governance to your AI-assisted engineering workflows across **VS Code, Cursor, Windsurf, JetBrains, Visual Studio, and command-line AI tools**.

---

## ⚡ Key Highlights

* **Token Reducer & Prompt Optimizer:** Strips redundant whitespace, newlines, and conversational filler in RAM before prompts reach the LLM, reducing token consumption by up to **30%–60%** without sacrificing code generation accuracy.
* **Cache-First Structured Prompts:** Automatically reorders contexts into `[FILES]`, `[OBJECTIVE]`, `[CONSTRAINTS]`, and `[HANDOFF]` blocks to trigger **Prompt Caching** (saving 50%–90% on input costs).
* **Live File Attachment Interception:** Intercepts files added via `#file:` or `/` pickers in real-time and minifies them on-the-fly with `!full` override support.
* **Token & Credit Telemetry:** Tracks daily burnt tokens and maps them to enterprise vendor credits (e.g. GitHub Copilot, Anthropic, OpenAI) for End-of-Day (EOD) budget reconciliation.
* **Workflow Intelligence:** Analyzes context engineering, agentic workflows, model switching, and tool usage patterns across your projects.
* **100% Local & Private:** All telemetry and RAM-based minification stays on your machine. Nothing is transmitted to third parties without your explicit opt-in.

---

## 🛠️ Supported Tools & Platforms

<p align="left">
  <img src="assets/tool-logos/vscode.svg" alt="VS Code" title="VS Code" height="30" />&nbsp;
  <img src="assets/tool-logos/vscodium.svg" alt="VSCodium" title="VSCodium" height="30" />&nbsp;
  <img src="assets/tool-logos/cursor.svg" alt="Cursor" title="Cursor" height="28" />&nbsp;
  <img src="assets/tool-logos/github-copilot.svg" alt="GitHub Copilot" title="GitHub Copilot" height="30" />&nbsp;
  <img src="assets/tool-logos/jetbrains.png" alt="JetBrains" title="JetBrains" height="30" />&nbsp;
  <img src="assets/tool-logos/continue.png" alt="Continue" title="Continue" height="30" />&nbsp;
  <img src="assets/tool-logos/claude.png" alt="Claude" title="Claude" height="30" />&nbsp;
  <img src="assets/tool-logos/gemini.svg" alt="Gemini" title="Gemini" height="30" />&nbsp;
  <img src="assets/tool-logos/visual-studio.svg" alt="Visual Studio" title="Visual Studio" height="30" />
</p>

* **IDEs:** VS Code, VSCodium, Cursor, Windsurf, Trae, Kiro, Visual Studio 2022+, JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.).
* **CLI Agents:** GitHub Copilot CLI, Claude Code, Gemini CLI, Mistral Vibe, Pi CLI, OpenCode, Crush.

---

## 🚀 Architecture: Real-Time Token Optimizer

The built-in Token Reducer acts as a high-speed pre-LLM middleware running directly inside the IDE:

```
User Input / Context (#file:, /, prompt)
                     │
                     ▼
┌──────────────────────────────────────────────┐
│  1. In-RAM Text & Code Stripping Engine      │
│     • Strips filler ("please", "thank you")  │
│     • Normalizes CRLF & collapses newlines   │
│     • Language-aware code unformatting       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  2. Structured Prompt Schema Generator       │
│     • [FILES] static context placed FIRST    │
│     • [OBJECTIVE] query placed LAST          │
│     • Unlocks 50%–90% LLM Prompt Cache hits  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  3. Model Execution & Delta Telemetry        │
│     • Lean prompt dispatched to Copilot/LLM  │
│     • Status bar displays saved token %      │
│     • Logs recorded for EOD reconciliation   │
└──────────────────────────────────────────────┘
```

### Language-Aware Stripping Strategies

| Language / Format | Strategy | Behavior |
| :--- | :--- | :--- |
| **JS, TS, Go, Java, Rust, C#, C++** | **Full Strip** | Strips leading indentation and redundant lines. Multi-line unformatted code is delivered with zero syntactic loss. |
| **Python, YAML** | **Relative Preservation** | Preserves semantic indent hierarchies while compressing excess padding and whitespace. |
| **JSON / JSONC** | **Strict Minify** | Compresses structured JSON to dense single-line strings. |
| **User Queries** | **Filler Stripping** | Removes conversational fluff without affecting technical keywords or instructions. |

---

## 💰 End-of-Day (EOD) Credit Reconciliation

To translate vendor subscription credits (e.g. 3,000 monthly Copilot credits) into burnt tokens:

1. **Daily Token Burn (Local Telemetry):**
   $$\text{Total Tokens}_{\text{day}} = \text{Input Tokens} + \text{Output Tokens}$$
2. **Daily Credits Consumed:**
   $$\text{Credits Consumed}_{\text{day}} = \text{Start Credits} - \text{End Credits}$$
3. **Effective Exchange Rate:**
   $$\text{Tokens Per Credit} = \frac{\text{Total Burnt Tokens}}{\text{Credits Consumed}}$$

The extension automatically logs session token deltas to local storage, allowing you to track multi-model routing efficiencies under dynamic Auto Mode.

---

## ⚙️ Configuration & Usage

### Extension Settings

Open your VS Code `settings.json` or Extension Settings UI:

```json
{
  // Enable or disable real-time prompt & file minification
  "aiEngineeringFluency.tokenReducer.enabled": true,

  // Strip comments (//, /* */, #) from attached code files (default: false)
  "aiEngineeringFluency.tokenReducer.stripComments": false,

  // Status bar display mode for token counts
  "aiEngineeringFluency.display.statusBar.showTokens": "both"
}
```

### Inline Overrides

* **Bypass Stripping for Specific Files:** When attaching a file that must remain untouched, append `!full` to the path:
  ```
  #file:src/auth/tokenService.ts!full
  ```
* **View Session Savings:** Run the command palette command `AI Manager: Token Reducer: Show Session Summary` or click the `$(zap)` status bar icon.

---

## 📂 Repository Structure

```
.
├── vscode-extension/          # VS Code extension source
│   ├── src/
│   │   ├── token-reducer/     # Real-time token optimizer & rules engine
│   │   │   ├── stripEngine.ts          # Language-aware stripper & filler removal
│   │   │   ├── promptAssembler.ts      # Structured prompt builder (cache-first)
│   │   │   ├── tokenReducerManager.ts  # Live intercept & status bar telemetry
│   │   │   └── tests/                  # Test suites
│   │   ├── hookManager.ts              # Copilot hook definitions
│   │   ├── insightsEngine.ts           # Usage & pattern intelligence
│   │   └── extension.ts                # Main extension activation entry point
├── cli/                       # Cross-platform CLI binary & stats generator
├── jetbrains-plugin/          # JetBrains IDE integration
├── visualstudio-extension/    # Visual Studio 2022+ extension
└── desktop/                   # Desktop dashboard app
```

---

## 🧪 Development & Building

### Prerequisites
* Node.js $\ge 18.x$
* npm or pnpm

### Build the VS Code Extension
```bash
# Navigate to extension directory
cd vscode-extension

# Install dependencies
npm install

# Type-check TypeScript
npm run compile # or npx tsc --noEmit

# Run unit tests
npm test
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
