import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Clock, Mail, Send } from 'lucide-react';
import { sendMessage, subscribeMessages } from '../services/firestoreService';
import {
  buildChatReplyEmailDraft,
  type GmailEmailDraft,
} from '../services/gmailService';
import {
  BLUEPRINT_LIMITS,
  STUDIO_ADMIN_EMAIL,
  type ChatMessage,
  type VideoProject,
  type VoiceNotePayload,
} from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { VoiceRecorderBar } from './VoiceRecorderBar';

interface ProjectChatProps {
  project: VideoProject;
  user: User;
  isAdmin: boolean;
  onRequestEmailSend: (draft: GmailEmailDraft) => void;
  onRuntimeError: (error: Error) => void;
}

function formatMessageTime(ts: ChatMessage['createdAt']): string {
  const date = ts?.toDate?.();
  if (!date) return 'Just now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDate(ts: ChatMessage['createdAt']): string {
  const date = ts?.toDate?.();
  if (!date) return 'Today';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function AvatarCircle({
  name,
  photoUrl,
  isCreator,
}: {
  name: string;
  photoUrl: string;
  isCreator: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
      />
    );
  }

  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
        isCreator ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
      }`}
    >
      {initials || 'U'}
    </div>
  );
}

export function ProjectChat({
  project,
  user,
  isAdmin,
  onRequestEmailSend,
  onRuntimeError,
}: ProjectChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [timecodeRef, setTimecodeRef] = useState('');
  const [alsoEmailStudio, setAlsoEmailStudio] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeMessages(
      project.id,
      user,
      isAdmin,
      (rows) => {
        setMessages(rows);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        onRuntimeError(err);
      }
    );
    return () => unsub();
  }, [project.id, user, isAdmin, onRuntimeError]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    const currentTimecode = timecodeRef.trim();
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(project, user, isAdmin, trimmed, currentTimecode);
      setDraft('');
      setTimecodeRef('');
      if (alsoEmailStudio) {
        onRequestEmailSend(
          buildChatReplyEmailDraft(
            project,
            user.displayName || user.email?.split('@')[0] || 'Client',
            user.email || 'Client account',
            trimmed,
            currentTimecode
          )
        );
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleSendVoice(voice: VoiceNotePayload) {
    const currentTimecode = timecodeRef.trim();
    setSendError(null);
    await sendMessage(project, user, isAdmin, '', currentTimecode, voice);
    setTimecodeRef('');
    if (alsoEmailStudio) {
      onRequestEmailSend(
        buildChatReplyEmailDraft(
          project,
          user.displayName || user.email?.split('@')[0] || 'Client',
          user.email || 'Client account',
          voice.caption
            ? `[Voice note (${voice.audioDuration}s)] ${voice.caption}`
            : `[Voice note (${voice.audioDuration}s) — listen inside Framecraft Studio]`,
          currentTimecode
        )
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <section
      aria-label="Project chat"
      className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-900">Project Chat</h2>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {isAdmin
              ? `Direct text & voice with ${project.clientName}`
              : 'Direct text & voice with Studio Creator'}
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
          {messages.length} {messages.length === 1 ? 'msg' : 'msgs'}
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-[320px] max-h-[600px] lg:max-h-none">
        {loading ? (
          <div className="space-y-4 py-2">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="animate-pulse flex gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="h-12 w-full bg-slate-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
            <p className="text-sm font-medium text-slate-800">Start the conversation</p>
            <p className="mt-1.5 text-xs text-slate-500 max-w-[260px] leading-relaxed">
              Send text messages or record voice notes about scenes, pacing, and timestamps
              directly with {isAdmin ? project.clientName : 'your studio creator'}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user.uid;
            const isCreatorMsg = msg.senderRole === 'creator';
            const isVoice = msg.messageType === 'voice' && Boolean(msg.audioData);

            return (
              <div key={msg.id} className="flex items-start gap-3">
                <AvatarCircle
                  name={msg.senderName}
                  photoUrl={msg.senderPhotoURL}
                  isCreator={isCreatorMsg}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-semibold text-slate-900">
                      {isMine ? 'You' : msg.senderName}
                    </span>
                    <span className={isCreatorMsg ? 'text-blue-600 font-medium' : 'text-slate-500'}>
                      {isCreatorMsg ? 'Studio Creator' : 'Client'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {formatMessageDate(msg.createdAt)} {formatMessageTime(msg.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onRequestEmailSend(
                          buildChatReplyEmailDraft(
                            project,
                            msg.senderName,
                            user.email || 'Portal user',
                            isVoice
                              ? msg.text
                                ? `[Voice note (${msg.audioDuration ?? 0}s)] ${msg.text}`
                                : `[Voice note (${msg.audioDuration ?? 0}s) — listen in Framecraft Studio]`
                              : msg.text,
                            msg.timecodeRef
                          )
                        )
                      }
                      title={`Email reply to ${STUDIO_ADMIN_EMAIL}`}
                      aria-label="Email reply to studio Gmail"
                      className="ml-auto p-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <Mail className="w-3 h-3" />
                    </button>
                  </div>

                  <div
                    className={`mt-1.5 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMine
                        ? 'bg-slate-900 text-white'
                        : 'bg-[#F8F9FA] text-slate-800 border border-slate-200'
                    }`}
                  >
                    {msg.timecodeRef && (
                      <div
                        className={`mb-1.5 text-[11px] font-mono tabular-nums ${
                          isMine ? 'text-slate-300' : 'text-blue-600'
                        }`}
                      >
                        Ref @ {msg.timecodeRef}
                      </div>
                    )}
                    {isVoice && msg.audioData ? (
                      <div className="space-y-2">
                        <VoiceMessagePlayer
                          src={msg.audioData}
                          durationSec={msg.audioDuration ?? 1}
                          variant={isMine ? 'dark' : 'light'}
                        />
                        {msg.text && <p className="text-xs opacity-90 pt-1">{msg.text}</p>}
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-slate-200 bg-[#F8F9FA] space-y-2.5">
        {sendError && (
          <p role="alert" className="text-xs text-red-600">
            {sendError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex items-center w-36 shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              maxLength={BLUEPRINT_LIMITS.timecodeMax}
              value={timecodeRef}
              onChange={(e) => setTimecodeRef(e.target.value)}
              placeholder="00:14 (opt)"
              aria-label="Optional timecode reference"
              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-slate-900"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoEmailStudio}
              onChange={(e) => setAlsoEmailStudio(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>Email reply to {STUDIO_ADMIN_EMAIL}</span>
          </label>
        </div>

        <div className="flex items-end gap-2">
          <div className={isVoiceActive ? 'w-full' : 'shrink-0'}>
            <VoiceRecorderBar
              disabled={sending}
              onSendVoice={handleSendVoice}
              onRecordingStateChange={setIsVoiceActive}
            />
          </div>
          {!isVoiceActive && (
            <form onSubmit={handleSend} className="flex-1 flex items-end gap-2 min-w-0">
              <textarea
                rows={2}
                maxLength={BLUEPRINT_LIMITS.messageMax}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message or tap Voice..."
                aria-label="Project chat message"
                className="flex-1 min-w-0 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 resize-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="h-10 px-4 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
