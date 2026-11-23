import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';
import { BLUEPRINT_LIMITS, type VoiceNotePayload } from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';

interface VoiceRecorderBarProps {
  disabled?: boolean;
  onSendVoice: (payload: VoiceNotePayload) => Promise<void>;
  onRecordingStateChange?: (active: boolean) => void;
}

function formatTimer(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

function selectSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not encode voice recording.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export function VoiceRecorderBar({
  disabled = false,
  onSendVoice,
  onRecordingStateChange,
}: VoiceRecorderBarProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{
    dataUrl: string;
    durationSec: number;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef<boolean>(false);

  function cleanupStream() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  useEffect(() => {
    onRecordingStateChange?.(status !== 'idle');
  }, [status, onRecordingStateChange]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cleanupStream();
    };
  }, []);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mimeType = selectSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 16000,
        ...(mimeType ? { mimeType } : {}),
      };

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const elapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        const rawMime = recorder.mimeType || mimeType || 'audio/webm';
        const finalMime = rawMime.startsWith('audio/') ? rawMime : 'audio/webm';
        cleanupStream();

        if (cancelledRef.current) {
          setStatus('idle');
          setElapsedSec(0);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: finalMime });
        if (blob.size < 64) {
          setError('Recording was too short. Please try again.');
          setStatus('idle');
          setElapsedSec(0);
          return;
        }

        try {
          const dataUrl = await blobToDataUrl(blob);
          if (dataUrl.length > BLUEPRINT_LIMITS.audioDataMax) {
            setError('Voice note exceeded the 60-second size limit. Please record a shorter clip.');
            setStatus('idle');
            setElapsedSec(0);
            return;
          }
          setRecordedAudio({
            dataUrl,
            durationSec: Math.min(BLUEPRINT_LIMITS.audioDurationMax, elapsed),
          });
          setStatus('preview');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to prepare voice note.');
          setStatus('idle');
          setElapsedSec(0);
        }
      };

      startTimeRef.current = Date.now();
      setElapsedSec(0);
      setStatus('recording');
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSec(secs);
        if (secs >= BLUEPRINT_LIMITS.audioDurationMax && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 250);
    } catch (err) {
      cleanupStream();
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setError('Microphone permission was denied. Please allow microphone access to send voice notes.');
      } else {
        setError('Unable to access your microphone. Please check your device settings.');
      }
      setStatus('idle');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelRecording() {
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupStream();
      setStatus('idle');
      setElapsedSec(0);
    }
    setRecordedAudio(null);
    setCaption('');
    setError(null);
  }

  async function handleSend() {
    if (!recordedAudio || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendVoice({
        audioData: recordedAudio.dataUrl,
        audioDuration: recordedAudio.durationSec,
        caption: caption.trim(),
      });
      setRecordedAudio(null);
      setCaption('');
      setElapsedSec(0);
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send voice message.');
    } finally {
      setSending(false);
    }
  }

  if (status === 'idle') {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void startRecording()}
          title="Record a voice message (up to 60 seconds)"
          aria-label="Record voice message"
          className="h-10 px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 disabled:opacity-40 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
        >
          <Mic className="w-4 h-4 text-slate-700" />
          <span>Voice</span>
        </button>
        {error && (
          <p role="alert" className="text-xs text-red-600 max-w-xs">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (status === 'recording') {
    return (
      <div className="w-full p-3 bg-white border border-red-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          <Mic className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold text-red-700">Recording voice note</span>
          <span className="font-mono text-slate-600 tabular-nums">
            {formatTimer(elapsedSec)} / {formatTimer(BLUEPRINT_LIMITS.audioDurationMax)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelRecording}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-3.5 bg-white border border-slate-200 rounded-lg space-y-3">
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      {recordedAudio && (
        <VoiceMessagePlayer
          src={recordedAudio.dataUrl}
          durationSec={recordedAudio.durationSec}
          variant="light"
        />
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          type="text"
          maxLength={250}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Add an optional note with your voice message..."
          aria-label="Optional voice message note"
          className="flex-1 px-3 py-1.5 text-xs text-slate-900 bg-[#F8F9FA] border border-slate-200 rounded-md focus:outline-none focus:border-slate-900"
        />

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={sending}
            onClick={cancelRecording}
            aria-label="Discard voice recording"
            className="p-2 text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Sending...' : 'Send Voice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
