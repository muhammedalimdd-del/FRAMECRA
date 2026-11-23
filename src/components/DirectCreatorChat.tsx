import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Mail, MessageSquare, Mic, Search, Send } from 'lucide-react';
import {
  sendDirectMessage,
  subscribeDirectMessages,
} from '../services/firestoreService';
import {
  buildDirectMessageEmailDraft,
  type GmailEmailDraft,
} from '../services/gmailService';
import {
  BLUEPRINT_LIMITS,
  STUDIO_ADMIN_EMAIL,
  type DirectMessage,
  type DirectThread,
  type VoiceNotePayload,
} from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { VoiceRecorderBar } from './VoiceRecorderBar';

interface DirectCreatorChatProps {
  user: User;
  isAdmin: boolean;
  threads: DirectThread[];
  threadsLoading: boolean;
  onRequestEmailSend: (draft: GmailEmailDraft) => void;
  onRuntimeError: (error: Error) => void;
}

function formatMessageTime(ts: DirectMessage['createdAt']): string {
  const d = ts?.toDate?.();
  if (!d) return 'Just now';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(ts: DirectMessage['createdAt']): string {
  const d = ts?.toDate?.();
  if (!d) return 'Today';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function AvatarCircle({
  name,
  photoUrl,
  isCreator,
  size = 'sm',
}: {
  name: string;
  photoUrl: string;
  isCreator?: boolean;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const dim = size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[11px]';

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dim} rounded-full object-cover border border-slate-200 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-semibold shrink-0 ${
        isCreator ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
      }`}
    >
      {initials || 'U'}
    </div>
  );
}

export function DirectCreatorChat({
  user,
  isAdmin,
  threads,
  threadsLoading,
  onRequestEmailSend,
  onRuntimeError,
}: DirectCreatorChatProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [draft, setDraft] = useState('');
  const [alsoEmailStudio, setAlsoEmailStudio] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selfTestMode, setSelfTestMode] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-select first thread for creator, or own UID for client
  useEffect(() => {
    if (!isAdmin) {
      setSelectedClientId(user.uid);
      return;
    }
    if (selfTestMode) {
      setSelectedClientId(user.uid);
      return;
    }
    if (threads.length > 0 && (!selectedClientId || !threads.some((t) => t.clientId === selectedClientId))) {
      setSelectedClientId(threads[0].clientId);
    }
  }, [isAdmin, user.uid, threads, selectedClientId, selfTestMode]);

  const activeClientId = isAdmin ? selectedClientId : user.uid;

  const activeThread = useMemo(
    () => threads.find((t) => t.clientId === activeClientId) ?? null,
    [threads, activeClientId]
  );

  const filteredThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.clientName.toLowerCase().includes(q) ||
        t.lastMessagePreview.toLowerCase().includes(q)
    );
  }, [threads, threadSearch]);

  useEffect(() => {
    if (!activeClientId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    const unsub = subscribeDirectMessages(
      activeClientId,
      user,
      isAdmin,
      (rows) => {
        setMessages(rows);
        setMessagesLoading(false);
      },
      (err) => {
        setMessagesLoading(false);
        onRuntimeError(err);
      }
    );
    return () => unsub();
  }, [activeClientId, user, isAdmin, onRuntimeError]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeClientId]);

  const targetClientMeta = useMemo(() => {
    if (!activeClientId) return null;
    if (!isAdmin) {
      return {
        clientId: user.uid,
        clientName: user.displayName?.trim() || user.email?.split('@')[0] || 'Client',
        clientPhotoURL: user.photoURL || '',
      };
    }
    if (activeThread) {
      return {
        clientId: activeThread.clientId,
        clientName: activeThread.clientName,
        clientPhotoURL: activeThread.clientPhotoURL,
      };
    }
    if (selfTestMode && activeClientId === user.uid) {
      return {
        clientId: user.uid,
        clientName: `${user.displayName?.trim() || 'Creator'} (Self Test)`,
        clientPhotoURL: user.photoURL || '',
      };
    }
    return null;
  }, [activeClientId, isAdmin, user, activeThread, selfTestMode]);

  async function handleSendText(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending || !targetClientMeta) return;

    setSending(true);
    setSendError(null);
    try {
      await sendDirectMessage(targetClientMeta, user, isAdmin, trimmed);
      setDraft('');
      if (alsoEmailStudio) {
        onRequestEmailSend(
          buildDirectMessageEmailDraft(
            user.displayName || user.email?.split('@')[0] || 'Client',
            user.email || 'Client account',
            'text',
            trimmed
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
    if (!targetClientMeta) return;
    setSendError(null);
    await sendDirectMessage(targetClientMeta, user, isAdmin, '', voice);
    if (alsoEmailStudio) {
      onRequestEmailSend(
        buildDirectMessageEmailDraft(
          user.displayName || user.email?.split('@')[0] || 'Client',
          user.email || 'Client account',
          'voice',
          voice.caption || '',
          voice.audioDuration
        )
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendText();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {isAdmin ? 'Direct Messages Inbox' : `Chat with ${STUDIO_ADMIN_EMAIL}`}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isAdmin
            ? `Private 1-on-1 text and voice conversations sent by signed-in clients to ${STUDIO_ADMIN_EMAIL}.`
            : `Private 1-on-1 text and voice chat directly with ${STUDIO_ADMIN_EMAIL}. Only you and the studio creator can see this conversation.`}
        </p>
      </div>

      <div
        className={`bg-white border border-slate-200 rounded-xl overflow-hidden grid ${
          isAdmin ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        } min-h-[580px] h-[calc(100vh-14rem)]`}
      >
        {/* Creator Client Inbox List */}
        {isAdmin && (
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col min-h-0 max-h-64 lg:max-h-none">
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search client conversations..."
                  aria-label="Search client conversations"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9FA] border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {threadsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-700">No client chats yet</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    When clients sign in with Google, they land straight in their private chat with{' '}
                    <span className="font-mono text-slate-700">{STUDIO_ADMIN_EMAIL}</span> and can
                    send you text or voice messages here.
                  </p>
                  {!selfTestMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelfTestMode(true);
                        setSelectedClientId(user.uid);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-[#F8F9FA] border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Test Chat &amp; Voice Now</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = thread.clientId === activeClientId;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => {
                        setSelfTestMode(false);
                        setSelectedClientId(thread.clientId);
                      }}
                      className={`w-full px-4 py-3.5 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-slate-900 text-white' : 'hover:bg-[#F8F9FA] text-slate-900'
                      }`}
                    >
                      <AvatarCircle
                        name={thread.clientName}
                        photoUrl={thread.clientPhotoURL}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold truncate">{thread.clientName}</span>
                          <span
                            className={`text-[11px] font-mono tabular-nums shrink-0 ${
                              isSelected ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {formatShortDate(thread.updatedAt)}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 text-xs truncate flex items-center gap-1 ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {thread.lastMessageType === 'voice' && (
                            <Mic className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate">{thread.lastMessagePreview}</span>
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Active 1-on-1 Chat Area */}
        <div
          className={`${
            isAdmin ? 'lg:col-span-8' : 'col-span-1'
          } flex flex-col min-h-0 h-full`}
        >
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {isAdmin ? (
                activeThread ? (
                  <>
                    <AvatarCircle
                      name={activeThread.clientName}
                      photoUrl={activeThread.clientPhotoURL}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
                        {activeThread.clientName}
                      </h2>
                      <p className="text-xs text-slate-500 truncate">
                        Private client conversation · Text &amp; Voice enabled
                      </p>
                    </div>
                  </>
                ) : selfTestMode && targetClientMeta ? (
                  <>
                    <AvatarCircle
                      name={targetClientMeta.clientName}
                      photoUrl={targetClientMeta.clientPhotoURL}
                      isCreator
                      size="md"
                    />
                    <div className="min-w-0">
                      <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
                        {targetClientMeta.clientName}
                      </h2>
                      <p className="text-xs text-slate-500 truncate">
                        Test your text &amp; voice messaging flow directly
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-semibold text-slate-900">
                      Select a client conversation
                    </h2>
                    <p className="text-xs text-slate-500">
                      Incoming messages and voice notes appear in the inbox on the left.
                    </p>
                  </div>
                )
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    MA
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
                      Studio Creator · <span className="font-mono text-xs text-blue-600">{STUDIO_ADMIN_EMAIL}</span>
                    </h2>
                    <p className="text-xs text-slate-500 truncate">
                      Private 1-on-1 text &amp; voice chat · Only you and {STUDIO_ADMIN_EMAIL} can see these messages
                    </p>
                  </div>
                </>
              )}
            </div>

            {activeClientId && (
              <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {!activeClientId ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                <MessageSquare className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-700">No conversation selected</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  Once clients sign in with Google and message or send voice notes to{' '}
                  <span className="font-mono text-slate-700">{STUDIO_ADMIN_EMAIL}</span>, select a
                  thread from the left panel to listen and reply.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelfTestMode(true);
                    setSelectedClientId(user.uid);
                  }}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Open Self-Test Chat &amp; Voice</span>
                </button>
              </div>
            ) : messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-2 max-w-md">
                      <div className="h-3 w-32 bg-slate-200 rounded" />
                      <div className="h-12 bg-slate-100 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-11 h-11 rounded-full bg-[#F8F9FA] border border-slate-200 flex items-center justify-center mb-4">
                  <Mic className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {isAdmin
                    ? 'Test sending a message or voice note'
                    : `Start chatting with ${STUDIO_ADMIN_EMAIL}`}
                </p>
                <p className="mt-1.5 text-xs text-slate-500 max-w-md leading-relaxed">
                  Type a message below or tap <strong className="text-slate-700">Voice</strong> to
                  record and send a voice message directly to{' '}
                  <span className="font-mono text-slate-700">{STUDIO_ADMIN_EMAIL}</span>. This
                  conversation is completely private.
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
                    <div className="flex-1 min-w-0 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold text-slate-900">
                          {isMine ? 'You' : msg.senderName}
                        </span>
                        <span
                          className={
                            isCreatorMsg ? 'text-blue-600 font-medium' : 'text-slate-500'
                          }
                        >
                          {isCreatorMsg ? 'Studio Creator' : 'Client'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {formatShortDate(msg.createdAt)} {formatMessageTime(msg.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestEmailSend(
                              buildDirectMessageEmailDraft(
                                msg.senderName,
                                user.email || 'Portal user',
                                isVoice ? 'voice' : 'text',
                                msg.text,
                                msg.audioDuration
                              )
                            )
                          }
                          title={`Email notification to ${STUDIO_ADMIN_EMAIL}`}
                          aria-label="Email message to studio Gmail"
                          className="ml-auto p-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div
                        className={`mt-1.5 inline-block max-w-full rounded-xl px-4 py-3 text-sm leading-relaxed ${
                          isMine
                            ? 'bg-slate-900 text-white'
                            : 'bg-[#F8F9FA] text-slate-800 border border-slate-200'
                        }`}
                      >
                        {isVoice ? (
                          <div className="space-y-2">
                            <VoiceMessagePlayer
                              src={msg.audioData}
                              durationSec={msg.audioDuration}
                              variant={isMine ? 'dark' : 'light'}
                            />
                            {msg.text && (
                              <p className="text-xs whitespace-pre-wrap break-words opacity-90 pt-1">
                                {msg.text}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Text + Voice Composer */}
          {targetClientMeta && (
            <div className="p-4 border-t border-slate-200 bg-[#F8F9FA] space-y-2.5 shrink-0">
              {sendError && (
                <p role="alert" className="text-xs text-red-600">
                  {sendError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  Private to you and <strong className="font-mono font-medium text-slate-700">{STUDIO_ADMIN_EMAIL}</strong> · Up to 60s per voice note
                </span>
                <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alsoEmailStudio}
                    onChange={(e) => setAlsoEmailStudio(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Email copy to {STUDIO_ADMIN_EMAIL}</span>
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
                  <form onSubmit={handleSendText} className="flex-1 flex items-end gap-2 min-w-0">
                    <textarea
                      rows={2}
                      maxLength={BLUEPRINT_LIMITS.messageMax}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        isAdmin
                          ? `Reply to ${targetClientMeta.clientName}...`
                          : `Message ${STUDIO_ADMIN_EMAIL} or tap Voice...`
                      }
                      aria-label="Direct message"
                      className="flex-1 min-w-0 px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="h-10 px-4 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
