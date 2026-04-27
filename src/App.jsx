import { useState, useCallback, useRef, useEffect } from 'react';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import SuggestionsPanel from './components/SuggestionsPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { useAudioRecorder } from './hooks/useAudioRecorder.js';
import { groqChat, groqTranscribe } from './utils/groq.js';
import { loadConfig, saveConfig as persistConfig } from './utils/config.js';
import { exportSession } from './utils/export.js';
import styles from './App.module.css';

export default function App() {
  // ── State ────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState([]);   // { text, timestamp }
  const [suggestionBatches, setSuggestionBatches] = useState([]);  // { timestamp, suggestions[] }
  const [chatMessages, setChatMessages] = useState([]);            // { role, content, timestamp }
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    return saved;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  // Refs for latest values inside callbacks
  const configRef = useRef(config);
  const transcriptRef = useRef(transcriptChunks);
  const isGeneratingSuggestionsRef = useRef(false);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { transcriptRef.current = transcriptChunks; }, [transcriptChunks]);

  const { isRecording, volume, error: recorderError, startRecording, stopRecording, manualFlush } = useAudioRecorder(config.refreshIntervalSec);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getTranscriptText = useCallback((chunks, maxChars = Infinity) => {
    const full = chunks.map(c => c.text).join(' ');
    return full.length > maxChars ? full.slice(-maxChars) : full;
  }, []);

  // ── Generate Suggestions ────────────────────────────────────────────────
  const generateSuggestions = useCallback(async (chunks) => {
    const cfg = configRef.current;
    if (!cfg.groqApiKey || isGeneratingSuggestionsRef.current) return;

    const transcript = getTranscriptText(chunks, cfg.suggestionsContextWindow);
    if (!transcript || transcript.length < 15) return;

    isGeneratingSuggestionsRef.current = true;
    setIsLoadingSuggestions(true);
    setStatusMsg('Generating suggestions...');

    // Get titles of last 2 batches to avoid repetition
    const previousTitles = suggestionBatches
      .slice(0, 2)
      .flatMap(batch => batch.suggestions.map(s => s.title))
      .join(', ');

    try {
      const userMsg = `Here is the recent transcript of the ongoing conversation:\n\n"${transcript}"\n\n` +
        (previousTitles ? `To ensure variety, do NOT repeat concepts from these recent suggestions: [${previousTitles}].\n\n` : '') +
        `Generate 3 contextually relevant suggestions. Respond ONLY with the JSON array.`;

      const raw = await groqChat(
        cfg.groqApiKey,
        cfg.llmModel,
        cfg.suggestionsPrompt,
        userMsg
      );

      // Extract JSON array from response
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch && jsonMatch[0]) {
        try {
          const suggestions = JSON.parse(jsonMatch[0]);
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            setSuggestionBatches(prev => [
              { timestamp: new Date().toISOString(), suggestions: suggestions.slice(0, 3) },
              ...prev,
            ]);
          }
        } catch (parseErr) {
          console.error('JSON Parse error:', parseErr, raw);
          setStatusMsg('Error parsing suggestions format.');
        }
      } else {
        console.warn('No JSON array found in response:', raw);
        setStatusMsg('Suggestions returned in wrong format.');
      }
      setStatusMsg('');
    } catch (e) {
      console.error('Suggestion generation error:', e);
      setStatusMsg(`Suggestion error: ${e.message.slice(0, 80)}`);
    } finally {
      setIsLoadingSuggestions(false);
      isGeneratingSuggestionsRef.current = false;
    }
  }, [getTranscriptText, suggestionBatches]);

  // ── Process Audio Chunk ─────────────────────────────────────────────────
  const processAudioChunk = useCallback(async (audioBlob) => {
    const cfg = configRef.current;
    if (!cfg.groqApiKey || !audioBlob) return;

    setIsTranscribing(true);
    setStatusMsg('Transcribing...');

    try {
      const text = await groqTranscribe(cfg.groqApiKey, audioBlob, cfg.transcriptionModel);
      if (text && text.length > 1) {
        const newChunk = { text, timestamp: new Date().toISOString() };
        setTranscriptChunks(prev => {
          const updated = [...prev, newChunk];
          // Only auto-trigger suggestions if the new text is substantial (> 60 chars)
          // This prevents noise/repetition for tiny snippets like "Yeah" or "Um"
          if (text.length > 60) {
            generateSuggestions(updated);
          } else {
            setStatusMsg('Waiting for more context...');
            setTimeout(() => setStatusMsg(''), 3000);
          }
          return updated;
        });
      } else {
        setStatusMsg('');
      }
    } catch (e) {
      console.error('Transcription error:', e);
      setStatusMsg(`Transcription error: ${e.message.slice(0, 80)}`);
    } finally {
      setIsTranscribing(false);
    }
  }, [generateSuggestions]);

  // ── Recording Controls ──────────────────────────────────────────────────
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      const finalBlob = stopRecording();
      if (finalBlob) {
        await processAudioChunk(finalBlob);
      }
      setStatusMsg('Recording stopped.');
    } else {
      if (!config.groqApiKey) {
        setShowSettings(true);
        return;
      }
      try {
        await startRecording(processAudioChunk);
        setStatusMsg('Recording...');
      } catch (e) {
        setStatusMsg(e.message);
      }
    }
  }, [isRecording, config.groqApiKey, startRecording, stopRecording, processAudioChunk]);

  // ── Manual Refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (isRecording) {
      const blob = await manualFlush();
      if (blob) {
        await processAudioChunk(blob);
      }
    } else if (transcriptRef.current.length > 0) {
      // Not recording but have transcript — just regenerate suggestions
      await generateSuggestions(transcriptRef.current);
    }
  }, [isRecording, manualFlush, processAudioChunk, generateSuggestions]);

  // ── Suggestion Click → Chat ─────────────────────────────────────────────
  const handleSuggestionClick = useCallback(async (suggestion) => {
    const cfg = configRef.current;
    if (!cfg.groqApiKey || isLoadingChat) return;

    const userMsg = {
      role: 'user',
      content: `📌 **${suggestion.title}**\n${suggestion.preview}`,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoadingChat(true);
    setStreamingContent('');

    const transcript = getTranscriptText(transcriptRef.current, cfg.chatContextWindow);

    try {
      const response = await groqChat(
        cfg.groqApiKey,
        cfg.llmModel,
        cfg.detailedAnswerPrompt,
        `FULL TRANSCRIPT CONTEXT:\n"${transcript}"\n\nThe user clicked on this suggestion:\nType: ${suggestion.type}\nTitle: ${suggestion.title}\nPreview: ${suggestion.preview}\n\nProvide a detailed, helpful response.`,
        (partial) => setStreamingContent(partial)
      );

      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ]);
      setStreamingContent('');
    } catch (e) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [isLoadingChat, getTranscriptText]);

  // ── Direct Chat Message ─────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (text) => {
    const cfg = configRef.current;
    if (!cfg.groqApiKey || isLoadingChat) return;

    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoadingChat(true);
    setStreamingContent('');

    const transcript = getTranscriptText(transcriptRef.current, cfg.chatContextWindow);

    try {
      const response = await groqChat(
        cfg.groqApiKey,
        cfg.llmModel,
        cfg.chatPrompt,
        `MEETING TRANSCRIPT:\n"${transcript}"\n\nUser question: ${text}`,
        (partial) => setStreamingContent(partial)
      );

      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: response, timestamp: new Date().toISOString() },
      ]);
      setStreamingContent('');
    } catch (e) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [isLoadingChat, getTranscriptText]);

  // ── Config ──────────────────────────────────────────────────────────────
  const handleSaveConfig = useCallback((newConfig) => {
    setConfig(newConfig);
    persistConfig(newConfig);
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    exportSession({
      transcriptChunks: transcriptRef.current,
      suggestionBatches,
      chatMessages,
    });
  }, [suggestionBatches, chatMessages]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (isRecording) stopRecording();
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>T</div>
          <span className={styles.logoText}>TwinMind</span>
          <span className={styles.liveBadge}>Live</span>
        </div>

        <div className={styles.headerRight}>
          {statusMsg && (
            <span className={`${styles.status} ${(isTranscribing || isLoadingSuggestions) ? styles.statusPulsing : ''}`}>
              {statusMsg}
            </span>
          )}
          {recorderError && (
            <span className={styles.errorStatus}>{recorderError}</span>
          )}
          <button className={styles.headerBtn} onClick={handleExport} title="Export session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <button className={styles.headerBtn} onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <button className={styles.headerBtn} onClick={() => setShowSettings(true)} title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Three Column Layout ─────────────────────────────────────────── */}
      <div className={styles.columns}>
        <div className={styles.colLeft}>
          <TranscriptPanel
            chunks={transcriptChunks}
            isRecording={isRecording}
            volume={volume}
            isTranscribing={isTranscribing}
            hasApiKey={!!config.groqApiKey}
            onToggleRecording={handleToggleRecording}
          />
        </div>

        <div className={styles.colMiddle}>
          <SuggestionsPanel
            batches={suggestionBatches}
            isLoading={isLoadingSuggestions}
            onRefresh={handleRefresh}
            onSuggestionClick={handleSuggestionClick}
          />
        </div>

        <div className={styles.colRight}>
          <ChatPanel
            messages={chatMessages}
            streamingContent={streamingContent}
            isLoading={isLoadingChat}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      {/* ── Settings Modal ──────────────────────────────────────────────── */}
      {showSettings && (
        <SettingsModal
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
