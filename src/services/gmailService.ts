import {
  ASPECT_RATIO_LABELS,
  EDIT_CATEGORY_LABELS,
  STUDIO_ADMIN_EMAIL,
  VIDEO_TYPE_LABELS,
  type EditRequestInput,
  type ProjectBriefInput,
  type VideoProject,
} from '../types';

export interface GmailEmailDraft {
  to: string;
  subject: string;
  body: string;
  contextLabel: string;
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeader(value: string): string {
  const sanitized = value.replace(/[\r\n]+/g, ' ').trim();
  const bytes = new TextEncoder().encode(sanitized);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildNewProjectEmailDraft(
  clientName: string,
  clientEmail: string,
  brief: ProjectBriefInput
): GmailEmailDraft {
  const lines = [
    'New AI Video Request — Framecraft Studio',
    '------------------------------------------------------------',
    `Project Title: ${brief.title.trim()}`,
    `Client: ${clientName} (${clientEmail})`,
    `Video Format: ${VIDEO_TYPE_LABELS[brief.videoType]}`,
    `Aspect Ratio: ${ASPECT_RATIO_LABELS[brief.aspectRatio]}`,
    `Target Runtime: ${brief.duration}`,
    `Target Delivery Date: ${brief.targetDate.trim() || 'Flexible'}`,
    brief.visualStyle.trim() ? `Visual Style & Mood: ${brief.visualStyle.trim()}` : null,
    brief.referenceUrl.trim() ? `Reference Link: ${brief.referenceUrl.trim()}` : null,
    '',
    'Creative Brief & Scene Breakdown:',
    brief.brief.trim(),
    '',
    `Open Studio Portal: ${window.location.origin}`,
  ].filter((line): line is string => line !== null);

  return {
    to: STUDIO_ADMIN_EMAIL,
    subject: `[Framecraft Studio] New AI Video Request: ${brief.title.trim()}`,
    body: lines.join('\n'),
    contextLabel: 'New AI Video Request',
  };
}

export function buildEditRequestEmailDraft(
  project: VideoProject,
  authorName: string,
  authorEmail: string,
  edit: EditRequestInput
): GmailEmailDraft {
  const tc = edit.timecode.trim();
  const lines = [
    'New Timecoded Edit Request — Framecraft Studio',
    '------------------------------------------------------------',
    `Project: ${project.title}`,
    `Cut Version: ${project.version > 0 ? `v${project.version}` : 'Pre-cut'}`,
    `Requested By: ${authorName} (${authorEmail})`,
    `Timecode: ${tc || 'General / Whole Video'}`,
    `Category: ${EDIT_CATEGORY_LABELS[edit.category]}`,
    `Priority: ${edit.priority === 'high' ? 'High' : 'Standard'}`,
    '',
    'Edit Instructions:',
    edit.instructions.trim(),
    '',
    `Open Studio Portal: ${window.location.origin}`,
  ];

  return {
    to: STUDIO_ADMIN_EMAIL,
    subject: `[Framecraft Studio] Edit Request on "${project.title}"${tc ? ` @ ${tc}` : ''}`,
    body: lines.join('\n'),
    contextLabel: 'Timecoded Edit Request',
  };
}

export function buildChatReplyEmailDraft(
  project: VideoProject,
  senderName: string,
  senderEmail: string,
  messageText: string,
  timecodeRef: string
): GmailEmailDraft {
  const tc = timecodeRef.trim();
  const lines = [
    'New Project Chat Reply — Framecraft Studio',
    '------------------------------------------------------------',
    `Project: ${project.title}`,
    `From: ${senderName} (${senderEmail})`,
    tc ? `Timecode Reference: @ ${tc}` : null,
    '',
    'Message:',
    messageText.trim(),
    '',
    `Reply inside Studio Portal: ${window.location.origin}`,
  ].filter((line): line is string => line !== null);

  return {
    to: STUDIO_ADMIN_EMAIL,
    subject: `[Framecraft Studio] New Reply on "${project.title}"`,
    body: lines.join('\n'),
    contextLabel: 'Project Chat Reply',
  };
}

export function buildDirectMessageEmailDraft(
  senderName: string,
  senderEmail: string,
  messageType: 'text' | 'voice',
  messageText: string,
  audioDuration = 0
): GmailEmailDraft {
  const durMin = Math.floor(audioDuration / 60);
  const durSec = Math.max(0, audioDuration % 60);
  const durLabel = `${durMin}:${durSec.toString().padStart(2, '0')}`;

  const lines = [
    'Direct Message to Studio Creator — Framecraft Studio',
    '------------------------------------------------------------',
    `From: ${senderName} (${senderEmail})`,
    `Message Type: ${messageType === 'voice' ? `Voice Note (${durLabel})` : 'Text Message'}`,
    '',
    messageType === 'voice'
      ? messageText.trim()
        ? `Voice Note Caption:\n${messageText.trim()}\n\nListen to the full voice note inside Framecraft Studio.`
        : `A new ${durLabel} voice message was recorded for you inside Framecraft Studio.`
      : `Message:\n${messageText.trim()}`,
    '',
    `Open Direct Chat in Studio Portal: ${window.location.origin}`,
  ];

  return {
    to: STUDIO_ADMIN_EMAIL,
    subject:
      messageType === 'voice'
        ? `[Framecraft Studio] New Voice Message (${durLabel}) from ${senderName}`
        : `[Framecraft Studio] Direct Message from ${senderName}`,
    body: lines.join('\n'),
    contextLabel: messageType === 'voice' ? 'Direct Voice Message' : 'Direct Message',
  };
}

export async function sendEmailViaGmail(
  accessToken: string,
  draft: GmailEmailDraft
): Promise<{ id: string }> {
  const mimeMessage = [
    `To: ${draft.to}`,
    `Subject: ${encodeMimeHeader(draft.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    draft.body,
  ].join('\r\n');

  const raw = encodeBase64Url(mimeMessage);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errJson = (await response.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) {
        detail = errJson.error.message;
      }
    } catch {
      // Ignore parse failure
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return (await response.json()) as { id: string };
}
