import type { Timestamp } from 'firebase/firestore';

export const STUDIO_ADMIN_EMAIL = 'muhammedalimdd@gmail.com';

// Verbatim validation constraints synced with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  idPattern: /^[a-zA-Z0-9_\-]+$/,
  idMaxLength: 128,
  displayNameMax: 100,
  emailMax: 254,
  photoUrlMax: 500,
  titleMin: 3,
  titleMax: 120,
  visualStyleMax: 300,
  briefMin: 10,
  briefMax: 3000,
  referenceUrlMax: 500,
  targetDateMax: 32,
  previewUrlMax: 500,
  previewNoteMax: 500,
  versionMin: 0,
  versionMax: 99,
  timecodeMax: 32,
  instructionsMin: 5,
  instructionsMax: 2000,
  resolutionNoteMax: 1000,
  messageMin: 1,
  messageMax: 2000,
  audioDataMax: 350000,
  audioDurationMax: 60,
  lastMessagePreviewMax: 200,
} as const;

export type VideoType =
  | 'commercial'
  | 'product'
  | 'social'
  | 'explainer'
  | 'music'
  | 'cinematic';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '21:9';

export type VideoDuration = '15s' | '30s' | '60s' | '90s+';

export type ProjectStatus =
  | 'submitted'
  | 'in_production'
  | 'in_review'
  | 'changes_requested'
  | 'completed';

export type EditCategory =
  | 'visual'
  | 'pacing'
  | 'color'
  | 'audio'
  | 'text'
  | 'other';

export type EditPriority = 'standard' | 'high';

export type EditStatus = 'open' | 'in_progress' | 'resolved';

export type SenderRole = 'client' | 'creator';

export type MessageType = 'text' | 'voice';

export interface VideoProject {
  id: string;
  clientId: string;
  clientName: string;
  clientPhotoURL: string;
  title: string;
  videoType: VideoType;
  aspectRatio: AspectRatio;
  duration: VideoDuration;
  visualStyle: string;
  brief: string;
  referenceUrl: string;
  targetDate: string;
  status: ProjectStatus;
  previewUrl: string;
  previewNote: string;
  version: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface EditRequest {
  id: string;
  projectId: string;
  clientId: string;
  authorId: string;
  authorName: string;
  timecode: string;
  category: EditCategory;
  priority: EditPriority;
  instructions: string;
  status: EditStatus;
  resolutionNote: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  clientId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  senderRole: SenderRole;
  messageType?: MessageType;
  text: string;
  audioData?: string;
  audioDuration?: number;
  timecodeRef: string;
  createdAt: Timestamp | null;
}

export interface DirectThread {
  id: string;
  clientId: string;
  clientName: string;
  clientPhotoURL: string;
  lastMessagePreview: string;
  lastMessageType: MessageType;
  lastSenderRole: SenderRole;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DirectMessage {
  id: string;
  clientId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  senderRole: SenderRole;
  messageType: MessageType;
  text: string;
  audioData: string;
  audioDuration: number;
  createdAt: Timestamp | null;
}

export interface VoiceNotePayload {
  audioData: string;
  audioDuration: number;
  caption?: string;
}

export interface ProjectBriefInput {
  title: string;
  videoType: VideoType;
  aspectRatio: AspectRatio;
  duration: VideoDuration;
  visualStyle: string;
  brief: string;
  referenceUrl: string;
  targetDate: string;
}

export interface EditRequestInput {
  timecode: string;
  category: EditCategory;
  priority: EditPriority;
  instructions: string;
}

export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  commercial: 'Commercial Spot',
  product: 'Product Reveal',
  social: 'Social Reel',
  explainer: 'Explainer Film',
  music: 'Music Visual',
  cinematic: 'Cinematic Short',
};

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  '16:9': '16:9 Widescreen',
  '9:16': '9:16 Vertical',
  '1:1': '1:1 Square',
  '21:9': '21:9 Anamorphic',
};

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; colorClass: string; description: string }
> = {
  submitted: {
    label: 'Submitted',
    colorClass: 'text-slate-600',
    description: 'Brief received and queued for studio review.',
  },
  in_production: {
    label: 'In Production',
    colorClass: 'text-blue-600',
    description: 'Scenes are being generated, edited, and graded.',
  },
  in_review: {
    label: 'Ready for Review',
    colorClass: 'text-amber-600',
    description: 'Latest cut is ready for your feedback or approval.',
  },
  changes_requested: {
    label: 'Changes Requested',
    colorClass: 'text-red-600',
    description: 'Studio is addressing your submitted edit requests.',
  },
  completed: {
    label: 'Completed',
    colorClass: 'text-emerald-600',
    description: 'Final cut approved and delivered.',
  },
};

export const EDIT_CATEGORY_LABELS: Record<EditCategory, string> = {
  visual: 'Visual / AI Scene',
  pacing: 'Pacing & Cuts',
  color: 'Color & Lighting',
  audio: 'Audio & Voiceover',
  text: 'Titles & Captions',
  other: 'General Note',
};

export const EDIT_STATUS_META: Record<EditStatus, { label: string; colorClass: string }> = {
  open: { label: 'Open', colorClass: 'text-amber-600' },
  in_progress: { label: 'In Progress', colorClass: 'text-blue-600' },
  resolved: { label: 'Resolved', colorClass: 'text-emerald-600' },
};
