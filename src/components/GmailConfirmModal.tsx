import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Mail, Send, X } from 'lucide-react';
import {
  authorizeGmailAccess,
  clearGmailAccessToken,
  getGmailAccessToken,
} from '../firebase';
import { sendEmailViaGmail, type GmailEmailDraft } from '../services/gmailService';

interface GmailConfirmModalProps {
  draft: GmailEmailDraft | null;
  onClose: () => void;
  onSent?: () => void;
}

function buildGmailComposeUrl(draft: GmailEmailDraft): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: draft.to,
    su: draft.subject,
    body: draft.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function GmailConfirmModal({ draft, onClose, onSent }: GmailConfirmModalProps) {
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getGmailAccessToken()));
  const [authorizing, setAuthorizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (draft) {
      setHasToken(Boolean(getGmailAccessToken()));
      setSent(false);
      setError(null);
      setSending(false);
      setAuthorizing(false);
    }
  }, [draft]);

  if (!draft) return null;

  const gmailComposeUrl = buildGmailComposeUrl(draft);

  async function handleAuthorizeGmail() {
    setAuthorizing(true);
    setError(null);
    try {
      await authorizeGmailAccess();
      setHasToken(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect Gmail.';
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
        setError(
          'Direct Gmail API sending requires Gmail permission. You can also click "Open in Gmail" below to send immediately.'
        );
      }
    } finally {
      setAuthorizing(false);
    }
  }

  async function handleConfirmSend() {
    if (!draft) return;
    setError(null);
    let token = getGmailAccessToken();

    if (!token) {
      setAuthorizing(true);
      try {
        token = await authorizeGmailAccess();
        setHasToken(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gmail authorization is required to send.';
        if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
          setError(
            'Could not authorize direct Gmail API sending for this account. Your update is already saved inside the studio—you can also click "Open in Gmail" below to email a copy.'
          );
        }
        setAuthorizing(false);
        return;
      }
      setAuthorizing(false);
    }

    setSending(true);
    try {
      await sendEmailViaGmail(token, draft);
      setSent(true);
      onSent?.();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        clearGmailAccessToken();
        setHasToken(false);
        setError(
          'Your Gmail session expired or lacks send permission. Reconnect with Google or use "Open in Gmail" below.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send email via Gmail.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-confirm-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Mail className="w-4 h-4 text-slate-700 shrink-0" />
            <div className="min-w-0">
              <h2
                id="gmail-confirm-title"
                className="font-display text-base font-semibold text-slate-900 truncate"
              >
                {sent ? 'Email Sent to Studio Gmail' : `${draft.contextLabel} Sent`}
              </h2>
              <p className="text-xs text-slate-500">
                {sent
                  ? `Delivered to ${draft.to} from your connected Gmail account.`
                  : `Delivered privately to ${draft.to} in Framecraft Studio. Optionally email a copy too.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close email confirmation"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {sent ? (
            <div className="py-4 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Your {draft.contextLabel.toLowerCase()} was emailed to {draft.to}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  A copy is also saved in your Gmail Sent folder and synced live inside the portal.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Your {draft.contextLabel.toLowerCase()} is saved and visible only to you and{' '}
                  <strong className="font-mono font-medium">{draft.to}</strong>.
                </span>
              </div>

              {error && (
                <div
                  role="alert"
                  className="px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg"
                >
                  {error}
                </div>
              )}

              <div className="bg-[#F8F9FA] border border-slate-200 rounded-lg divide-y divide-slate-200 text-xs">
                <div className="px-4 py-2.5 flex items-baseline gap-3">
                  <span className="text-slate-400 w-16 shrink-0">To</span>
                  <span className="font-mono text-slate-900 break-all">{draft.to}</span>
                </div>
                <div className="px-4 py-2.5 flex items-baseline gap-3">
                  <span className="text-slate-400 w-16 shrink-0">Subject</span>
                  <span className="font-medium text-slate-900 break-words">{draft.subject}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-slate-400 mb-1.5">Message Preview</p>
                  <pre className="font-sans text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed max-h-56 overflow-y-auto">
                    {draft.body}
                  </pre>
                </div>
              </div>

              {!hasToken && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">
                    Use <strong>Open in Gmail</strong> with any Google account, or connect Gmail to
                    send directly from here.
                  </p>
                  <button
                    type="button"
                    disabled={authorizing}
                    onClick={() => void handleAuthorizeGmail()}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <GoogleIcon />
                    <span>{authorizing ? 'Connecting...' : 'Connect Gmail'}</span>
                  </button>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Gmail</span>
                </a>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={sending || authorizing}
                    onClick={() => void handleConfirmSend()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {sending
                        ? 'Sending...'
                        : authorizing
                          ? 'Authorizing...'
                          : 'Send via Gmail API'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
