import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for managing microphone recording with periodic audio chunking.
 *
 * Returns audio blobs at regular intervals for transcription.
 */
export function useAudioRecorder(intervalSec = 30) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);
  const intervalRef = useRef(null);
  const onChunkCallbackRef = useRef(null);

  /**
   * Start volume analysis
   */
  const startAnalysis = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      setVolume(average); // 0 to 255
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();
  };

  /**
   * Stop analysis
   */
  const stopAnalysis = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    analyserRef.current = null;
    audioContextRef.current = null;
    setVolume(0);
  };

  /**
   * Collect accumulated audio chunks into a single blob and clear the buffer.
   */
  const flushAudio = useCallback(() => {
    if (audioChunksRef.current.length === 0) return null;
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    return blob.size > 500 ? blob : null; // Ignore tiny blobs (silence)
  }, []);

  /**
   * Cycle the recorder: stop → flush → restart → callback with blob.
   */
  const cycleRecorder = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;

    // Stop to finalize current data
    mr.stop();

    // Small delay to let ondataavailable fire
    await new Promise(r => setTimeout(r, 100));

    const blob = flushAudio();

    // Restart recording
    try {
      mr.start(1000);
    } catch {
      // MediaRecorder might be in an invalid state
    }

    if (blob && onChunkCallbackRef.current) {
      onChunkCallbackRef.current(blob);
    }
  }, [flushAudio]);

  /**
   * Start recording from the microphone.
   * @param {Function} onChunk - Called with an audio Blob every `intervalSec` seconds.
   */
  const startRecording = useCallback(async (onChunk) => {
    setError(null);
    onChunkCallbackRef.current = onChunk;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Start volume analysis
      startAnalysis(stream);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Recording error occurred');
      };

      mr.start(1000); // Collect data every 1 second
      setIsRecording(true);

      // Set up periodic flushing
      intervalRef.current = setInterval(() => {
        cycleRecorder();
      }, intervalSec * 1000);

    } catch (e) {
      const msg = e.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow mic access and try again.'
        : `Failed to start recording: ${e.message}`;
      setError(msg);
      throw new Error(msg);
    }
  }, [intervalSec, cycleRecorder]);

  /**
   * Stop recording and return any remaining audio.
   * @returns {Blob|null} Final audio chunk, if any.
   */
  const stopRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      mr.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    stopAnalysis();
    setIsRecording(false);
    const finalBlob = flushAudio();
    return finalBlob;
  }, [flushAudio]);

  /**
   * Manually flush current audio (for the Refresh button).
   * Cycles the recorder and returns the blob.
   */
  const manualFlush = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return null;

    // Reset the interval timer so we get a full window after manual flush
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        cycleRecorder();
      }, (onChunkCallbackRef.current ? 30 : 30) * 1000);
    }

    mr.stop();
    await new Promise(r => setTimeout(r, 100));
    const blob = flushAudio();

    try {
      mr.start(1000);
    } catch {
      // Ignore
    }

    return blob;
  }, [flushAudio, cycleRecorder]);

  return {
    isRecording,
    volume,
    error,
    startRecording,
    stopRecording,
    manualFlush,
  };
}
