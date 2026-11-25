import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function useLiveCaptions(
  onCaptionText: (text: string) => void,
  onFinalTranscript?: (text: string) => void,
) {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onCaptionRef = useRef(onCaptionText);
  const onFinalRef = useRef(onFinalTranscript);
  onCaptionRef.current = onCaptionText;
  onFinalRef.current = onFinalTranscript;

  const stopCaptions = useCallback(() => {
    activeRef.current = false;
    setCaptionsEnabled(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore already stopped
    }
    recognitionRef.current = null;
  }, []);

  const startCaptions = useCallback(() => {
    if (activeRef.current) return;

    setCaptionError(null);
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!Ctor) {
      setCaptionError('Voice transcription & live captions require Chrome or Edge.');
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onresult = (event) => {
        let latest = '';
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i][0].transcript;
          latest += piece;
          if (event.results[i].isFinal) {
            finalChunk += `${piece} `;
          }
        }
        const trimmed = latest.trim();
        if (trimmed) {
          onCaptionRef.current(trimmed);
        }
        const trimmedFinal = finalChunk.trim();
        if (trimmedFinal && onFinalRef.current) {
          onFinalRef.current(trimmedFinal);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setCaptionError('Microphone permission is needed for live captions & AI voice notes.');
          stopCaptions();
        }
      };

      recognition.onend = () => {
        if (activeRef.current) {
          try {
            recognition.start();
          } catch {
            // Ignore restart race
          }
        }
      };

      recognitionRef.current = recognition;
      activeRef.current = true;
      setCaptionsEnabled(true);
      recognition.start();
    } catch {
      setCaptionError('Could not start voice transcription.');
      stopCaptions();
    }
  }, [stopCaptions]);

  const toggleCaptions = useCallback(() => {
    if (activeRef.current) {
      stopCaptions();
    } else {
      startCaptions();
    }
  }, [startCaptions, stopCaptions]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  return {
    captionsEnabled,
    captionError,
    startCaptions,
    toggleCaptions,
    stopCaptions,
  };
}
