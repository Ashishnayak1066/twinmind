import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ChatPanel.module.css';

export default function ChatPanel({
  messages,
  streamingContent,
  isLoading,
  onSendMessage,
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Chat</span>
        <div className={styles.contextIndicator}>
          <div className={styles.pulseDot} />
          <span>Using live context</span>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.body}>
        {messages.length === 0 && !streamingContent && (
          <div className={styles.empty}>
            Click a suggestion or type a question to get detailed answers with full transcript context.
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
          >
            <div className={styles.messageHeader}>
              <div
                className={styles.avatar}
                style={{
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                  color: msg.role === 'user' ? '#a5b4fc' : '#6ee7b7',
                }}
              >
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <span className={styles.messageTime}>{formatTime(msg.timestamp)}</span>
              <button 
                className={styles.copyBtn} 
                onClick={() => navigator.clipboard.writeText(msg.content)}
                title="Copy to clipboard"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
            <div className={styles.messageContent}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streamingContent && (
          <div className={`${styles.message} ${styles.messageAssistant}`}>
            <div className={styles.messageHeader}>
              <div
                className={styles.avatar}
                style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}
              >
                AI
              </div>
            </div>
            <div className={styles.messageContent}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
              <span className={styles.cursor} />
            </div>
          </div>
        )}

        {/* Loading dots */}
        {isLoading && !streamingContent && (
          <div className={styles.loading}>
            <div className={styles.dot} />
            <div className={styles.dot} style={{ animationDelay: '0.15s' }} />
            <div className={styles.dot} style={{ animationDelay: '0.3s' }} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the meeting..."
          className={styles.input}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className={styles.sendBtn}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
