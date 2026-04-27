import { useState } from 'react';
import styles from './SettingsModal.module.css';

export default function SettingsModal({ config, onSave, onClose }) {
  const [local, setLocal] = useState({ ...config });

  const update = (key, value) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* API Key */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>API Configuration</h3>
            <label className={styles.label}>Groq API Key</label>
            <input
              type="password"
              value={local.groqApiKey}
              onChange={e => update('groqApiKey', e.target.value)}
              className={styles.input}
              placeholder="gsk_..."
            />

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>LLM Model</label>
                <input
                  value={local.llmModel}
                  onChange={e => update('llmModel', e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Transcription Model</label>
                <input
                  value={local.transcriptionModel}
                  onChange={e => update('transcriptionModel', e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          </section>

          {/* Context & Timing */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Context & Timing</h3>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Suggestions Context (chars)</label>
                <input
                  type="number"
                  value={local.suggestionsContextWindow}
                  onChange={e => update('suggestionsContextWindow', +e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Chat Context (chars)</label>
                <input
                  type="number"
                  value={local.chatContextWindow}
                  onChange={e => update('chatContextWindow', +e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Refresh Interval (sec)</label>
                <input
                  type="number"
                  value={local.refreshIntervalSec}
                  onChange={e => update('refreshIntervalSec', +e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          </section>

          {/* Prompts */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Prompts</h3>

            <label className={styles.label}>Live Suggestions Prompt</label>
            <textarea
              value={local.suggestionsPrompt}
              onChange={e => update('suggestionsPrompt', e.target.value)}
              className={styles.textarea}
              rows={8}
            />

            <label className={styles.label}>Detailed Answer Prompt (on click)</label>
            <textarea
              value={local.detailedAnswerPrompt}
              onChange={e => update('detailedAnswerPrompt', e.target.value)}
              className={styles.textarea}
              rows={6}
            />

            <label className={styles.label}>Chat Prompt (direct questions)</label>
            <textarea
              value={local.chatPrompt}
              onChange={e => update('chatPrompt', e.target.value)}
              className={styles.textarea}
              rows={6}
            />
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
