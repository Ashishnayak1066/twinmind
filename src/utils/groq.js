const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Send a chat completion request to Groq.
 * If onStream callback is provided, streams the response token by token.
 * Returns the full response text.
 */
export async function groqChat(apiKey, model, systemPrompt, userMessage, onStream = null) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: !!onStream,
  };

  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  // Non-streaming
  if (!onStream) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Streaming
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onStream(fullText);
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  return fullText;
}

/**
 * Send a chat completion with full message history for multi-turn chat.
 */
export async function groqChatWithHistory(apiKey, model, systemPrompt, messages, onStream = null) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 2048,
    stream: !!onStream,
  };

  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  if (!onStream) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onStream(fullText);
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  return fullText;
}

/**
 * Transcribe an audio blob using Groq Whisper.
 */
export async function groqTranscribe(apiKey, audioBlob, model) {
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', model);
  form.append('response_format', 'text');
  form.append('language', 'en');

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq transcription error (${res.status}): ${errText}`);
  }

  const text = await res.text();
  return text.trim();
}
