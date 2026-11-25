import { useCallback, useEffect, useRef, useState } from 'react';

export function useMeetingRecorder(meetingCode: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [recorderError, setRecorderError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setRecorderError(null);
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setRecorderError('Browser meeting recording is not supported in this browser.');
      return false;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';

      const recorder = mimeType
        ? new MediaRecorder(displayStream, { mimeType })
        : new MediaRecorder(displayStream);

      chunksRef.current = [];
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
        }
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      displayStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          stopRecording();
        };
      });

      streamRef.current = displayStream;
      recorderRef.current = recorder;
      setRecordingSeconds(0);
      recorder.start(1000);
      setIsRecording(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start recording.';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('permission')) {
        setRecorderError(msg);
      }
      return false;
    }
  }, [downloadUrl, stopRecording]);

  const downloadRecording = useCallback(() => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `meet-${meetingCode}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
    a.click();
  }, [downloadUrl, meetingCode]);

  return {
    isRecording,
    recordingSeconds,
    downloadUrl,
    recorderError,
    startRecording,
    stopRecording,
    downloadRecording,
  };
}
