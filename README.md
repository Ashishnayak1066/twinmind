# TwinMind Live Suggestions

A real-time AI meeting copilot that listens to live audio, transcribes it, and continuously surfaces contextual suggestions — questions to ask, talking points, fact-checks, action items, and more.

## Live Demo

**Deployed URL:** https://ashishnayak1066.github.io/twinmind/

## Quick Start

```bash
git clone https://github.com/Ashishnayak1066/twinmind
cd twinmind
npm install
npm run dev
```

Open `http://localhost:3000`, click ⚙️, paste your [Groq API key](https://console.groq.com/keys), and click **Start**.

---

## Stack Choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | **Vite + React 18** | Sub-second HMR, zero-config production builds. No framework overhead. |
| Transcription | **Groq Whisper Large V3** | Required by spec. Groq's hardware-accelerated inference returns transcriptions in ~1-2s for 25s chunks. |
| LLM | **Groq `openai/gpt-oss-120b`** | Required by spec. 120B MoE model with strong instruction-following and nuanced conversation analysis. |
| Styling | **CSS Modules** | Scoped by default, no runtime cost. Enhanced with **Glassmorphism** for a premium aesthetic. |
| Markdown | **react-markdown + remark-gfm** | Chat responses use markdown formatting (headers, lists, code, tables). |
| Audio | **MediaRecorder + Web Audio API** | Browser-native audio capture with a real-time frequency analyser for visual feedback. |

**No backend.** All API calls go directly from the browser to Groq's endpoints. The API key stays in `localStorage`.

---

## Architecture

```
src/
├── App.jsx                    # Orchestrator: state management, API call coordination
├── App.module.css             # Glassmorphism layout + header
├── components/
│   ├── TranscriptPanel.jsx    # Left: mic toggle, volume visualizer, auto-scrolling
│   ├── SuggestionsPanel.jsx   # Middle: deduplicated suggestion batches
│   ├── ChatPanel.jsx          # Right: streaming chat with context indicator
│   └── SettingsModal.jsx      # Full config: API key, models, prompts, windows
├── hooks/
│   └── useAudioRecorder.js    # MediaRecorder lifecycle + volume analysis
├── utils/
│   ├── config.js              # Default prompts & settings, 25s refresh cycle
│   ├── groq.js                # Groq API client: chat (streaming + non), transcription
│   └── export.js              # Full session export to timestamped JSON
└── index.css                  # Global variables, glassmorphism resets, animations
```

### Data Flow

```
Mic audio stream
    │
    ▼
MediaRecorder + AnalyserNode (Live Volume Dot)
    │
    ▼
Audio buffer (accumulated Blob chunks)
    │
    ├── Every 25s (auto) ──── or ──── Manual "Refresh" click
    │
    ▼
Signal Check (>60 chars) → Flush buffer
    │
    ▼
Groq Whisper transcription (non-streaming, ~1-2s)
    │
    ▼
Transcript chunk appended to state
    │
    ▼
Groq GPT-OSS-120B suggestion generation (avoiding recent titles)
    │
    ▼
3 "Glanceable" suggestion cards rendered (1-sentence previews)
    │
    └── On card click or typed question:
            │
            ▼
        Groq GPT-OSS-120B detailed answer (streaming, ~0.5s TTFT)
            │
            ▼
        Chat message rendered token-by-token
```

---

## Prompt Engineering Strategy

### 1. Live Suggestions Prompt (`suggestionsPrompt`)

**Goal:** Generate 3 punchy, "glanceable" suggestions every 25 seconds.

**Design principles:**
- **Brevity is King.** Titles are 3-5 words; previews are exactly 1 punchy sentence. This minimizes cognitive load during live meetings.
- **Continuity awareness.** The app tracks recent suggestion titles and passes them to the model as "negative context" to prevent repetition.
- **High Signal.** Explicitly avoids generic AI filler. If the conversation is technical, the suggestions are technical.
- **Signal Thresholding.** The orchestrator only triggers an auto-refresh if the new text is >60 characters, ensuring the AI has enough "meat" to provide value.

### 2. Detailed Answer Prompt (`detailedAnswerPrompt`)

**Goal:** Provide thorough, actionable expansions on clicked suggestions.
- Uses a larger context window (8,000 chars).
- Formats output with headers and bullet points for quick scanning.

---

## Tradeoffs & Decisions

| Decision | What it costs | Why I chose it anyway |
|----------|---------------|----------------------|
| **25s audio chunks** | ~25s latency for auto-updates | **Sweet spot.** Balances Whisper accuracy with user responsiveness. |
| **Suggestion deduplication** | Slightly longer prompts | **Crucial.** Prevents the AI from circling the same points in a static conversation. |
| **Glassmorphism UI** | More complex CSS | **Brand alignment.** Matches TwinMind's premium, "ambient" product identity. |
| **Volume Visualizer** | Minor CPU overhead | **Latency perception.** Provides immediate feedback while waiting for transcription. |

---

## Key Features

- **25s Auto-refresh:** Optimized transcription + suggestion cycle.
- **Voice Activity Visualizer:** Reactive volume dot confirms the app is listening.
- **Signal Thresholding:** Intelligent filtering of "Um/Yeah" noise to preserve signal quality.
- **Suggestion Continuity:** Explicitly avoids repeating concepts from recent batches.
- **Glanceable Insights:** One-sentence previews designed for 2-second scanning.
- **Premium Design:** Sophisticated dark theme with glassmorphism and blurs.
- **Streaming Chat:** Instant token delivery for detailed answers with context indicators.
- **Full Utility:** Export session to JSON and one-click copy chat messages to clipboard.

---

## Configuration Reference

| Setting | Default | Description |
|---------|---------|-------------|
| Groq API Key | _(empty)_ | From [console.groq.com/keys](https://console.groq.com/keys) |
| Refresh Interval | 25 seconds | Optimized for responsiveness |
| Suggestions Context | 4000 chars | Focused on the immediate moment |
| Chat Context | 8000 chars | Provides "Long-term Memory" for the chat |

---

## License

MIT
