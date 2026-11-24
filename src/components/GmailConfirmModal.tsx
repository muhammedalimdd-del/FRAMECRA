import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Mail, Send, X } from 'lucide-react';
import {
  clearGmailAccessToken,
  confirmWithGoogleForSubmission,
  getGmailAccessToken,
  parseFirebaseAuthError,
  type AuthErrorInfo,
} from '../firebase';
import { sendEmailViaGmail, type GmailEmailDraft } from '../services/gmailService';
import { AuthErrorAlert } from './AuthErrorAlert';

interface GmailConfirmModalProps {
  draft: GmailEmailDraft | null;
  userEmail?: string | null;
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

export function GmailConfirmModal({
  draft,
  userEmail,
  onClose,
  onSent,
}: GmailConfirmModalProps) {
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getGmailAccessToken()));
  const [authorizing, setAuthorizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [error, setError] = useState<AuthErrorInfo | null>(null);

  useEffect(() => {
    if (draft) {
      setHasToken(Boolean(getGmailAccessToken()));
      setSent(false);
      setConfirmedEmail(null);
      setError(null);
      setSending(false);
      setAuthorizing(false);
    }
  }, [draft]);

  if (!draft) return null;

  const gmailComposeUrl = buildGmailComposeUrl(draft);

  async function handleGoogleSignInAndSend() {
    if (!draft) return;
    setError(null);
    setAuthorizing(true);

    try {
      const { user, accessToken, gmailScopeGranted } = await confirmWithGoogleForSubmission();
      setConfirmedEmail(user.email || userEmail || 'your Google account');

      if (gmailScopeGranted && accessToken) {
        setHasToken(true);
        setAuthorizing(false);
        setSending(true);
        try {
          await sendEmailViaGmail(accessToken, draft);
          setSent(true);
          onSent?.();
        } catch (sendErr) {
          const status = (sendErr as { status?: number })?.status;
          if (status === 401 || status === 403) {
            clearGmailAccessToken();
            setHasToken(false);
            setError({
              kind: 'generic',
              message:
                'Your Google account is confirmed, and your request is saved. Use "Open in Gmail" below to send the email copy.',
            });
          } else {
            setError({
              kind: 'generic',
              message:
                sendErr instanceof Error ? sendErr.message : 'Unable to send email via Gmail API.',
            });
          }
        } finally {
          setSending(false);
        }
      } else {
        setHasToken(false);
        setAuthorizing(false);
      }
    } catch (err) {
      const parsed = parseFirebaseAuthError(
        err,
        'Could not complete Google Sign-In in this window. Your request is already saved—you can also click "Open in Gmail" below.'
      );
      if (parsed.kind !== 'cancelled') {
        setError(parsed);
      }
      setAuthorizing(false);
    }
  }

  async function handleSendWithExistingToken() {
    if (!draft) return;
    const token = getGmailAccessToken();
    if (!token) {
      await handleGoogleSignInAndSend();
      return;
    }

    setError(null);
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
        setError({
          kind: 'generic',
          message:
            'Your Gmail session expired. Sign in with Google below or click "Open in Gmail" to send.',
        });
      } else {
        setError({
          kind: 'generic',
          message: err instanceof Error ? err.message : 'Failed to send email via Gmail.',
        });
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
                {sent
                  ? 'Confirmed & Sent to Studio Gmail'
                  : `Final Step — Confirm ${draft.contextLabel} with Google`}
              </h2>
              <p className="text-xs text-slate-500">
                {sent
                  ? `Delivered to ${draft.to} from your Google account.`
                  : `Sign in with your Google account to confirm and send a copy directly to ${draft.to}.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close confirmation"
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
                  Saved privately in Framecraft Studio and sent from your Google account.
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
                  {confirmedEmail ? (
                    <>
                      Google account confirmed (<strong className="font-mono">{confirmedEmail}</strong>).
                      Your request is delivered privately to{' '}
                      <strong className="font-mono">{draft.to}</strong> — click{' '}
                      <strong>Open in Gmail</strong> below to also email a copy.
                    </>
                  ) : (
                    <>
                      Your {draft.contextLabel.toLowerCase()} is saved privately for{' '}
                      <strong className="font-mono font-medium">{draft.to}</strong>. Use Google
                      Sign-In below to confirm and send an email copy.
                    </>
                  )}
                </span>
              </div>

              {error && (
                <AuthErrorAlert
                  error={error}
                  theme="light"
                  onRetry={() => void handleGoogleSignInAndSend()}
                  retrying={authorizing}
                />
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
                  <pre className="font-sans text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed max-h-52 overflow-y-auto">
                    {draft.body}
                  </pre>
                </div>
              </div>

              {/* Second Google Sign-In Step at the End of Submitting */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    confirmedEmail
                      ? 'text-white bg-slate-900 hover:bg-slate-800'
                      : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Gmail</span>
                </a>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Done
                  </button>

                  {hasToken ? (
                    <button
                      type="button"
                      disabled={sending || authorizing}
                      onClick={() => void handleSendWithExistingToken()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sending ? 'Sending via Gmail...' : 'Confirm & Send Email'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={sending || authorizing}
                      onClick={() => void handleGoogleSignInAndSend()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-900 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <GoogleIcon />
                      <span>
                        {authorizing
                          ? 'Signing in with Google...'
                          : sending
                            ? 'Sending email...'
                            : confirmedEmail
                              ? 'Switch Google Account'
                              : 'Sign in with Google & Send'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
