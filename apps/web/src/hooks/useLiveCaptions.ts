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

export function useLiveCaptions(onCaptionText: (text: string) => void) {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onCaptionRef = useRef(onCaptionText);
  onCaptionRef.current = onCaptionText;

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

  const toggleCaptions = useCallback(() => {
    if (activeRef.current) {
      stopCaptions();
      return;
    }

    setCaptionError(null);
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!Ctor) {
      setCaptionError('Live captions require Chrome or Edge (Web Speech API).');
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onresult = (event) => {
        let latest = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          latest += event.results[i][0].transcript;
        }
        const trimmed = latest.trim();
        if (trimmed) {
          onCaptionRef.current(trimmed);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setCaptionError('Microphone permission is needed for live captions.');
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
      setCaptionError('Could not start live captions.');
      stopCaptions();
    }
  }, [stopCaptions]);

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
    toggleCaptions,
    stopCaptions,
  };
}
