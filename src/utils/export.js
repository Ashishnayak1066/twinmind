/**
 * Export the full session data as a JSON file download.
 */
export function exportSession({ transcriptChunks, suggestionBatches, chatMessages }) {
  const data = {
    exportedAt: new Date().toISOString(),
    sessionDuration: transcriptChunks.length > 0
      ? `${transcriptChunks[0].timestamp} → ${transcriptChunks[transcriptChunks.length - 1].timestamp}`
      : 'No transcript',
    transcript: transcriptChunks.map(c => ({
      timestamp: c.timestamp,
      text: c.text,
    })),
    fullTranscriptText: transcriptChunks.map(c => c.text).join(' '),
    suggestionBatches: suggestionBatches.map(batch => ({
      timestamp: batch.timestamp,
      suggestions: batch.suggestions.map(s => ({
        type: s.type,
        title: s.title,
        preview: s.preview,
      })),
    })),
    chatHistory: chatMessages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `twinmind-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
