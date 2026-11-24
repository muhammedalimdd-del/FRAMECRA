import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { AuthErrorInfo } from '../firebase';

interface AuthErrorAlertProps {
  error: AuthErrorInfo;
  theme: 'dark' | 'light';
  onRetry?: () => void;
  onRedirectSignIn?: () => void;
  retrying?: boolean;
  className?: string;
}

export function AuthErrorAlert({
  error,
  theme,
  onRetry,
  onRedirectSignIn,
  retrying = false,
  className = '',
}: AuthErrorAlertProps) {
  const [copied, setCopied] = useState(false);
  const [showOwnerSetup, setShowOwnerSetup] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (error.kind === 'cancelled' || !error.message) {
    return null;
  }

  const isDark = theme === 'dark';

  async function handleCopyHostname() {
    if (!error.hostname) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(error.hostname);
      } else {
        const input = document.createElement('textarea');
        input.value = error.hostname;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  if (error.kind === 'unauthorized-domain') {
    return (
      <div
        role="alert"
        className={`rounded-lg border p-4 text-xs space-y-3 ${
          isDark
            ? 'bg-red-950/60 border-red-400/35 text-red-100'
            : 'bg-red-50 border-red-200 text-red-900'
        } ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle
            className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-red-300' : 'text-red-600'}`}
          />
          <div className="min-w-0 space-y-1">
            <p className={`font-semibold ${isDark ? 'text-white' : 'text-red-950'}`}>
              Google Sign-In is temporarily unavailable on this domain
            </p>
            <p className={`leading-relaxed ${isDark ? 'text-red-100/90' : 'text-red-800'}`}>
              The studio owner needs to authorize this website domain in Firebase Authentication
              before Google Sign-In can open here.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                isDark
                  ? 'bg-white text-slate-950 hover:bg-slate-100'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Retrying...' : 'Retry Sign-In'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowOwnerSetup((prev) => !prev)}
            aria-expanded={showOwnerSetup}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isDark
                ? 'border-white/20 text-slate-100 hover:bg-white/10'
                : 'border-red-300 text-red-900 bg-white hover:bg-red-50'
            }`}
          >
            <span>Site owner? View domain setup</span>
            {showOwnerSetup ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {showOwnerSetup && (
          <div
            className={`pt-3 border-t space-y-3 ${
              isDark ? 'border-white/15' : 'border-red-200'
            }`}
          >
            <ol
              className={`space-y-1.5 list-decimal list-inside leading-relaxed ${
                isDark ? 'text-slate-200' : 'text-red-900'
              }`}
            >
              <li>Copy the active website hostname below.</li>
              <li>
                Open Firebase Console →{' '}
                <span className="font-medium">
                  Authentication → Settings → Authorized domains
                </span>{' '}
                and add it (or connect your own Firebase project via Netlify{' '}
                <span className="font-mono">VITE_FIREBASE_*</span> environment variables).
              </li>
              <li>Return here and click Retry Sign-In.</li>
            </ol>

            {error.hostname && (
              <div
                className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                  isDark
                    ? 'bg-black/45 border-white/15 text-white'
                    : 'bg-white border-red-200 text-slate-900'
                }`}
              >
                <span className="font-mono tabular-nums text-[11px] truncate select-all">
                  {error.hostname}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyHostname()}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isDark
                      ? 'border-white/20 text-slate-100 hover:bg-white/10'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Domain</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {error.firebaseSettingsUrl && (
              <div>
                <a
                  href={error.firebaseSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                    isDark
                      ? 'border-white/25 text-white hover:bg-white/10'
                      : 'border-slate-300 text-slate-900 bg-white hover:bg-slate-50'
                  }`}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Firebase Auth Settings</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`rounded-lg border px-3.5 py-3 text-xs space-y-2.5 ${
        isDark
          ? 'bg-red-950/65 border-red-400/35 text-red-100'
          : 'bg-red-50 border-red-200 text-red-800'
      } ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle
          className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-red-300' : 'text-red-600'}`}
        />
        <p className="leading-relaxed">{error.message}</p>
      </div>

      {error.kind === 'popup-blocked' && onRedirectSignIn && (
        <div className="pl-6">
          <button
            type="button"
            onClick={onRedirectSignIn}
            disabled={retrying}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
              isDark
                ? 'bg-white text-slate-950 hover:bg-slate-100'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <span>Continue with Redirect Sign-In</span>
          </button>
        </div>
      )}
    </div>
  );
}
