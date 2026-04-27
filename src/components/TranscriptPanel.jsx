import { useEffect, useRef } from 'react';
import styles from './TranscriptPanel.module.css';

export default function TranscriptPanel({
  chunks,
  isRecording,
  volume = 0,
  isTranscribing,
  hasApiKey,
  onToggleRecording,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Volume scale for visualizer (0.5 to 2.5 range)
  const volumeScale = 1 + (volume / 255) * 1.5;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.headerTitle}>Transcript</span>
          {isRecording && (
            <div className={styles.visualizer}>
              <div 
                className={styles.volDot} 
                style={{ transform: `scale(${volumeScale})` }} 
              />
            </div>
          )}
        </div>
        <button
          onClick={onToggleRecording}
          className={`${styles.micBtn} ${isRecording ? styles.micBtnActive : ''}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isRecording ? '#ef4444' : 'none'} stroke={isRecording ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {isRecording ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {chunks.length === 0 && (
          <div className={styles.empty}>
            {hasApiKey
              ? 'Click Start to begin recording your conversation.'
              : 'Open Settings and add your Groq API key to get started.'}
          </div>
        )}

        {chunks.map((chunk, i) => (
          <div key={i} className={styles.chunk}>
            <span className={styles.timestamp}>{formatTime(chunk.timestamp)}</span>
            <p className={styles.text}>{chunk.text}</p>
          </div>
        ))}

        {isTranscribing && (
          <div className={styles.transcribing}>
            <div className={styles.dot} />
            <div className={styles.dot} style={{ animationDelay: '0.15s' }} />
            <div className={styles.dot} style={{ animationDelay: '0.3s' }} />
            <span>Transcribing...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
