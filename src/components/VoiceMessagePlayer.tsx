import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface VoiceMessagePlayerProps {
  src: string;
  durationSec: number;
  variant?: 'dark' | 'light';
}

function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export function VoiceMessagePlayer({
  src,
  durationSec,
  variant = 'light',
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(Math.max(1, durationSec));

  useEffect(() => {
    setTotalDuration(Math.max(1, durationSec));
    setPlaying(false);
    setCurrentTime(0);
  }, [src, durationSec]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play().catch(() => setPlaying(false));
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * totalDuration;
    setCurrentTime(audio.currentTime);
  }

  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;
  const isDark = variant === 'dark';

  return (
    <div className="flex items-center gap-3 min-w-[200px] sm:min-w-[240px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setTotalDuration(d);
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          isDark
            ? 'bg-white text-slate-900 hover:bg-slate-200'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalDuration)}
          aria-valuenow={Math.round(currentTime)}
          onClick={handleSeek}
          className={`h-1.5 w-full rounded-full overflow-hidden cursor-pointer ${
            isDark ? 'bg-white/25' : 'bg-slate-200'
          }`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${
              isDark ? 'bg-white' : 'bg-slate-900'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          className={`flex items-center justify-between text-[11px] font-mono tabular-nums ${
            isDark ? 'text-slate-300' : 'text-slate-500'
          }`}
        >
          <span>Voice note</span>
          <span>
            {playing || currentTime > 0
              ? `${formatSeconds(currentTime)} / ${formatSeconds(totalDuration)}`
              : formatSeconds(totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
