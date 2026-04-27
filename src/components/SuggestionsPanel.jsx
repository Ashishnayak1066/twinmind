import styles from './SuggestionsPanel.module.css';

const TYPE_CONFIG = {
  question:      { bg: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', label: 'Question to Ask' },
  talking_point: { bg: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', label: 'Talking Point' },
  answer:        { bg: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', label: 'Answer' },
  fact_check:    { bg: 'rgba(236, 72, 153, 0.15)', color: '#f9a8d4', label: 'Fact Check' },
  clarification: { bg: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', label: 'Clarification' },
  action_item:   { bg: 'rgba(20, 184, 166, 0.15)', color: '#5eead4', label: 'Action Item' },
};

function SuggestionCard({ suggestion, onClick, isNew }) {
  const typeStyle = TYPE_CONFIG[suggestion.type] || TYPE_CONFIG.talking_point;

  return (
    <button
      className={`${styles.card} ${isNew ? styles.cardNew : ''}`}
      onClick={() => onClick(suggestion)}
    >
      <span
        className={styles.badge}
        style={{ background: typeStyle.bg, color: typeStyle.color }}
      >
        {typeStyle.label}
      </span>
      <div className={styles.cardTitle}>{suggestion.title}</div>
      <div className={styles.cardPreview}>{suggestion.preview}</div>
    </button>
  );
}

export default function SuggestionsPanel({
  batches,
  isLoading,
  onRefresh,
  onSuggestionClick,
}) {
  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Live Suggestions</span>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={styles.refreshBtn}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isLoading ? styles.spinning : ''}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {isLoading && batches.length === 0 && (
          <div className={styles.loading}>
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} style={{ animationDelay: '0.15s' }} />
            <div className={styles.loadingDot} style={{ animationDelay: '0.3s' }} />
            <span>Analyzing conversation...</span>
          </div>
        )}

        {batches.length === 0 && !isLoading && (
          <div className={styles.empty}>
            Suggestions will appear here as you speak. Each refresh generates 3 contextual suggestions.
          </div>
        )}

        {batches.map((batch, bi) => (
          <div key={bi} className={styles.batch}>
            <span className={styles.batchTime}>{formatTime(batch.timestamp)}</span>
            <div className={styles.batchCards}>
              {batch.suggestions.map((s, si) => (
                <SuggestionCard
                  key={si}
                  suggestion={s}
                  onClick={onSuggestionClick}
                  isNew={bi === 0}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
