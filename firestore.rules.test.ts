/**
 * Payload-First Security TDD specification for Framecraft Studio Firestore Rules.
 * Covers all 12 adversarial "Dirty Dozen" payloads from security_spec.md.
 *
 * Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actor: {
    uid: string;
    email: string;
    email_verified: boolean;
  };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Project Create',
    operation: 'create',
    path: '/projects/proj_spoof_1',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    payload: {
      clientId: 'victim_uid',
      clientName: 'Victim',
      clientPhotoURL: '',
      title: 'Spoofed Project',
      videoType: 'commercial',
      aspectRatio: '16:9',
      duration: '30s',
      visualStyle: 'Clean studio',
      brief: 'Attempting to create a project under another client UID.',
      referenceUrl: '',
      targetDate: '',
      status: 'submitted',
      previewUrl: '',
      previewNote: '',
      version: 0,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Project Create',
    operation: 'create',
    path: '/projects/proj_ghost_2',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      clientId: 'client_a',
      clientName: 'Client A',
      clientPhotoURL: '',
      title: 'Legit Title',
      videoType: 'product',
      aspectRatio: '16:9',
      duration: '15s',
      visualStyle: '',
      brief: 'Valid brief length with an extra shadow field attached.',
      referenceUrl: '',
      targetDate: '',
      status: 'submitted',
      previewUrl: '',
      previewNote: '',
      version: 0,
      isVerified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoofing',
    operation: 'get',
    path: '/projects/proj_client_b',
    actor: { uid: 'spoof_admin', email: 'muhammedalimdd@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Blanket Read on Another User Profile',
    operation: 'get',
    path: '/users/victim_uid',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unfiltered List Query Scraping All Projects',
    operation: 'list',
    path: '/projects',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'State Shortcutting on Project Create',
    operation: 'create',
    path: '/projects/proj_shortcut_6',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      clientId: 'client_a',
      clientName: 'Client A',
      clientPhotoURL: '',
      title: 'Shortcut Status',
      videoType: 'social',
      aspectRatio: '9:16',
      duration: '30s',
      visualStyle: '',
      brief: 'Attempting to jump straight to completed status on create.',
      referenceUrl: '',
      targetDate: '',
      status: 'completed',
      previewUrl: 'https://evil.example/video.mp4',
      previewNote: 'Injected',
      version: 3,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Tampering After Project Completed',
    operation: 'update',
    path: '/projects/proj_completed_7',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      status: 'submitted',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client Mutating Creator-Only Delivery Fields',
    operation: 'update',
    path: '/projects/proj_in_review_8',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      previewUrl: 'https://attacker.example/fake.mp4',
      version: 9,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Subcollection Edit Request',
    operation: 'create',
    path: '/projects/nonexistent_parent_9/editRequests/edit_9',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      projectId: 'nonexistent_parent_9',
      clientId: 'client_a',
      authorId: 'client_a',
      authorName: 'Client A',
      timecode: '00:12',
      category: 'color',
      priority: 'high',
      instructions: 'Orphaned edit request without a real parent project.',
      status: 'open',
      resolutionNote: '',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Creator Role Impersonation in Project Chat',
    operation: 'create',
    path: '/projects/proj_client_a/messages/msg_10',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      projectId: 'proj_client_a',
      clientId: 'client_a',
      senderId: 'client_a',
      senderName: 'Client A',
      senderPhotoURL: '',
      senderRole: 'creator',
      text: 'Pretending to be the studio creator.',
      timecodeRef: '',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning and Oversized Value Poisoning',
    operation: 'create',
    path: '/projects/invalid$id!!',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      clientId: 'client_a',
      clientName: 'Client A',
      clientPhotoURL: '',
      title: 'A'.repeat(250),
      videoType: 'commercial',
      aspectRatio: '16:9',
      duration: '30s',
      visualStyle: '',
      brief: 'Oversized title and poisoned path ID.',
      referenceUrl: '',
      targetDate: '',
      status: 'submitted',
      previewUrl: '',
      previewNote: '',
      version: 0,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Temporal Forgery and Immutable Field Mutation',
    operation: 'update',
    path: '/projects/proj_submitted_12',
    actor: { uid: 'client_a', email: 'clienta@example.com', email_verified: true },
    payload: {
      clientId: 'other_uid',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
