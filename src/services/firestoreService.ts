import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BLUEPRINT_LIMITS,
  STUDIO_ADMIN_EMAIL,
  type ChatMessage,
  type DirectMessage,
  type DirectThread,
  type EditRequest,
  type EditRequestInput,
  type EditStatus,
  type MessageType,
  type ProjectBriefInput,
  type ProjectStatus,
  type SenderRole,
  type VideoProject,
  type VoiceNotePayload,
} from '../types';

function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function safeDisplayName(user: User): string {
  const raw = user.displayName?.trim() || user.email?.split('@')[0] || 'Client';
  return raw.slice(0, BLUEPRINT_LIMITS.displayNameMax);
}

function safePhotoUrl(user: User): string {
  return (user.photoURL || '').slice(0, BLUEPRINT_LIMITS.photoUrlMax);
}

function formatDurationLabel(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function sortByTimestampDesc<
  T extends {
    updatedAt?: { toMillis: () => number } | null;
    createdAt?: { toMillis: () => number } | null;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? Date.now();
    const bTime = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? Date.now();
    return bTime - aTime;
  });
}

function sortByCreatedAsc<T extends { createdAt?: { toMillis: () => number } | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? Date.now();
    const bTime = b.createdAt?.toMillis?.() ?? Date.now();
    return aTime - bTime;
  });
}

export function isStudioOwnerUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified && user.email?.toLowerCase() === STUDIO_ADMIN_EMAIL);
}

export async function checkIsAdminUser(user: User): Promise<boolean> {
  return isStudioOwnerUser(user);
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const existingSnap = await getDoc(ref);
    const displayName = safeDisplayName(user);
    const email = clampString(user.email, BLUEPRINT_LIMITS.emailMax);
    const photoURL = safePhotoUrl(user);

    if (existingSnap.exists()) {
      await updateDoc(ref, {
        displayName,
        email,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeProjects(
  user: User,
  _isAdmin: boolean,
  onData: (projects: VideoProject[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'projects';
  const isOwner = isStudioOwnerUser(user);
  const projectsRef = collection(db, path);
  const q = isOwner ? query(projectsRef) : query(projectsRef, where('clientId', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: VideoProject[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<VideoProject, 'id'>),
        }))
        .filter((row) => isOwner || row.clientId === user.uid);
      onData(sortByTimestampDesc(rows));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createProject(user: User, input: ProjectBriefInput): Promise<string> {
  const path = 'projects';
  const title = clampString(input.title, BLUEPRINT_LIMITS.titleMax);
  const brief = clampString(input.brief, BLUEPRINT_LIMITS.briefMax);

  if (title.length < BLUEPRINT_LIMITS.titleMin) {
    throw new Error(`Project title must be at least ${BLUEPRINT_LIMITS.titleMin} characters.`);
  }
  if (brief.length < BLUEPRINT_LIMITS.briefMin) {
    throw new Error(`Creative brief must be at least ${BLUEPRINT_LIMITS.briefMin} characters.`);
  }

  try {
    const docRef = await addDoc(collection(db, path), {
      clientId: user.uid,
      clientName: safeDisplayName(user),
      clientPhotoURL: safePhotoUrl(user),
      title,
      videoType: input.videoType,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      visualStyle: clampString(input.visualStyle, BLUEPRINT_LIMITS.visualStyleMax),
      brief,
      referenceUrl: clampString(input.referenceUrl, BLUEPRINT_LIMITS.referenceUrlMax),
      targetDate: clampString(input.targetDate, BLUEPRINT_LIMITS.targetDateMax),
      status: 'submitted' as ProjectStatus,
      previewUrl: '',
      previewNote: '',
      version: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProjectBrief(
  projectId: string,
  input: ProjectBriefInput
): Promise<void> {
  const path = `projects/${projectId}`;
  const title = clampString(input.title, BLUEPRINT_LIMITS.titleMax);
  const brief = clampString(input.brief, BLUEPRINT_LIMITS.briefMax);

  if (title.length < BLUEPRINT_LIMITS.titleMin) {
    throw new Error(`Project title must be at least ${BLUEPRINT_LIMITS.titleMin} characters.`);
  }
  if (brief.length < BLUEPRINT_LIMITS.briefMin) {
    throw new Error(`Creative brief must be at least ${BLUEPRINT_LIMITS.briefMin} characters.`);
  }

  try {
    await updateDoc(doc(db, 'projects', projectId), {
      title,
      videoType: input.videoType,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      visualStyle: clampString(input.visualStyle, BLUEPRINT_LIMITS.visualStyleMax),
      brief,
      referenceUrl: clampString(input.referenceUrl, BLUEPRINT_LIMITS.referenceUrlMax),
      targetDate: clampString(input.targetDate, BLUEPRINT_LIMITS.targetDateMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateProjectStatusByClient(
  projectId: string,
  nextStatus: 'changes_requested' | 'completed'
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateProjectByCreator(
  projectId: string,
  payload: {
    status: ProjectStatus;
    previewUrl: string;
    previewNote: string;
    version: number;
  }
): Promise<void> {
  const path = `projects/${projectId}`;
  const clampedVersion = Math.max(
    BLUEPRINT_LIMITS.versionMin,
    Math.min(BLUEPRINT_LIMITS.versionMax, Math.round(payload.version))
  );
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      status: payload.status,
      previewUrl: clampString(payload.previewUrl, BLUEPRINT_LIMITS.previewUrlMax),
      previewNote: clampString(payload.previewNote, BLUEPRINT_LIMITS.previewNoteMax),
      version: clampedVersion,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeEditRequests(
  projectId: string,
  user: User,
  _isAdmin: boolean,
  onData: (edits: EditRequest[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `projects/${projectId}/editRequests`;
  const isOwner = isStudioOwnerUser(user);
  const editsRef = collection(db, 'projects', projectId, 'editRequests');
  const q = isOwner ? query(editsRef) : query(editsRef, where('clientId', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: EditRequest[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<EditRequest, 'id'>),
        }))
        .filter((row) => isOwner || row.clientId === user.uid);
      onData(sortByTimestampDesc(rows));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createEditRequest(
  project: VideoProject,
  user: User,
  input: EditRequestInput,
  transitionReviewToChanges: boolean
): Promise<void> {
  const path = `projects/${project.id}/editRequests`;
  const instructions = clampString(input.instructions, BLUEPRINT_LIMITS.instructionsMax);
  if (instructions.length < BLUEPRINT_LIMITS.instructionsMin) {
    throw new Error(
      `Edit instructions must be at least ${BLUEPRINT_LIMITS.instructionsMin} characters.`
    );
  }

  try {
    const newEditRef = doc(collection(db, 'projects', project.id, 'editRequests'));
    const editPayload = {
      projectId: project.id,
      clientId: project.clientId,
      authorId: user.uid,
      authorName: safeDisplayName(user),
      timecode: clampString(input.timecode, BLUEPRINT_LIMITS.timecodeMax),
      category: input.category,
      priority: input.priority,
      instructions,
      status: 'open' as EditStatus,
      resolutionNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (
      transitionReviewToChanges &&
      project.status === 'in_review' &&
      project.clientId === user.uid
    ) {
      const batch = writeBatch(db);
      batch.set(newEditRef, editPayload);
      batch.update(doc(db, 'projects', project.id), {
        status: 'changes_requested',
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      await setDoc(newEditRef, editPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateEditRequestByAuthor(
  projectId: string,
  editId: string,
  input: EditRequestInput
): Promise<void> {
  const path = `projects/${projectId}/editRequests/${editId}`;
  const instructions = clampString(input.instructions, BLUEPRINT_LIMITS.instructionsMax);
  if (instructions.length < BLUEPRINT_LIMITS.instructionsMin) {
    throw new Error(
      `Edit instructions must be at least ${BLUEPRINT_LIMITS.instructionsMin} characters.`
    );
  }
  try {
    await updateDoc(doc(db, 'projects', projectId, 'editRequests', editId), {
      timecode: clampString(input.timecode, BLUEPRINT_LIMITS.timecodeMax),
      category: input.category,
      priority: input.priority,
      instructions,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateEditRequestByCreator(
  projectId: string,
  editId: string,
  payload: { status: EditStatus; resolutionNote: string }
): Promise<void> {
  const path = `projects/${projectId}/editRequests/${editId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'editRequests', editId), {
      status: payload.status,
      resolutionNote: clampString(payload.resolutionNote, BLUEPRINT_LIMITS.resolutionNoteMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEditRequest(projectId: string, editId: string): Promise<void> {
  const path = `projects/${projectId}/editRequests/${editId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'editRequests', editId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeMessages(
  projectId: string,
  user: User,
  _isAdmin: boolean,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `projects/${projectId}/messages`;
  const isOwner = isStudioOwnerUser(user);
  const messagesRef = collection(db, 'projects', projectId, 'messages');
  const q = isOwner ? query(messagesRef) : query(messagesRef, where('clientId', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: ChatMessage[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ChatMessage, 'id'>),
        }))
        .filter((row) => isOwner || row.clientId === user.uid);
      onData(sortByCreatedAsc(rows));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function sendMessage(
  project: VideoProject,
  user: User,
  isAdmin: boolean,
  text: string,
  timecodeRef: string,
  voice?: VoiceNotePayload
): Promise<void> {
  const path = `projects/${project.id}/messages`;
  const senderRole: SenderRole = isAdmin ? 'creator' : 'client';
  const messageType: MessageType = voice ? 'voice' : 'text';
  const cleanText = clampString(voice ? voice.caption || '' : text, BLUEPRINT_LIMITS.messageMax);

  if (messageType === 'text' && cleanText.length < BLUEPRINT_LIMITS.messageMin) {
    return;
  }

  let audioData = '';
  let audioDuration = 0;

  if (voice) {
    if (!voice.audioData.startsWith('data:audio/')) {
      throw new Error('Invalid voice recording format.');
    }
    if (voice.audioData.length > BLUEPRINT_LIMITS.audioDataMax) {
      throw new Error('Voice note is too large. Please record a shorter clip (under 60 seconds).');
    }
    audioData = voice.audioData;
    audioDuration = Math.max(1, Math.min(BLUEPRINT_LIMITS.audioDurationMax, Math.round(voice.audioDuration)));
  }

  try {
    await addDoc(collection(db, 'projects', project.id, 'messages'), {
      projectId: project.id,
      clientId: project.clientId,
      senderId: user.uid,
      senderName: safeDisplayName(user),
      senderPhotoURL: safePhotoUrl(user),
      senderRole,
      messageType,
      text: cleanText,
      audioData,
      audioDuration,
      timecodeRef: clampString(timecodeRef, BLUEPRINT_LIMITS.timecodeMax),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Direct 1-on-1 Chat with Studio Creator (Text + Voice) ---

export function subscribeDirectThreads(
  user: User,
  _isAdmin: boolean,
  onData: (threads: DirectThread[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'directThreads';
  const isOwner = isStudioOwnerUser(user);
  const ref = collection(db, path);
  const q = isOwner ? query(ref) : query(ref, where('clientId', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: DirectThread[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<DirectThread, 'id'>),
        }))
        .filter((row) => isOwner || row.clientId === user.uid);
      onData(sortByTimestampDesc(rows));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeDirectMessages(
  clientId: string,
  user: User,
  _isAdmin: boolean,
  onData: (messages: DirectMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `directThreads/${clientId}/messages`;
  const isOwner = isStudioOwnerUser(user);
  const safeClientId = isOwner ? clientId : user.uid;
  const ref = collection(db, 'directThreads', safeClientId, 'messages');
  const q = isOwner ? query(ref) : query(ref, where('clientId', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows: DirectMessage[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<DirectMessage, 'id'>),
        }))
        .filter((row) => isOwner || row.clientId === user.uid);
      onData(sortByCreatedAsc(rows));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function sendDirectMessage(
  targetClient: {
    clientId: string;
    clientName: string;
    clientPhotoURL: string;
  },
  user: User,
  isAdmin: boolean,
  text: string,
  voice?: VoiceNotePayload
): Promise<void> {
  const path = `directThreads/${targetClient.clientId}/messages`;
  const senderRole: SenderRole = isAdmin ? 'creator' : 'client';
  const messageType: MessageType = voice ? 'voice' : 'text';
  const cleanText = clampString(voice ? voice.caption || '' : text, BLUEPRINT_LIMITS.messageMax);

  if (messageType === 'text' && cleanText.length < BLUEPRINT_LIMITS.messageMin) {
    return;
  }

  let audioData = '';
  let audioDuration = 0;

  if (voice) {
    if (!voice.audioData.startsWith('data:audio/')) {
      throw new Error('Invalid voice recording format.');
    }
    if (voice.audioData.length > BLUEPRINT_LIMITS.audioDataMax) {
      throw new Error('Voice note is too large. Please keep recordings under 60 seconds.');
    }
    audioData = voice.audioData;
    audioDuration = Math.max(
      1,
      Math.min(BLUEPRINT_LIMITS.audioDurationMax, Math.round(voice.audioDuration))
    );
  }

  const previewText =
    messageType === 'voice'
      ? cleanText
        ? `Voice (${formatDurationLabel(audioDuration)}): ${cleanText}`
        : `Voice message (${formatDurationLabel(audioDuration)})`
      : cleanText;
  const lastMessagePreview = clampString(previewText, BLUEPRINT_LIMITS.lastMessagePreviewMax);

  const threadRef = doc(db, 'directThreads', targetClient.clientId);
  const newMsgRef = doc(collection(db, 'directThreads', targetClient.clientId, 'messages'));

  try {
    const existingThread = await getDoc(threadRef);
    const batch = writeBatch(db);

    if (existingThread.exists()) {
      if (isAdmin) {
        batch.update(threadRef, {
          lastMessagePreview,
          lastMessageType: messageType,
          lastSenderRole: senderRole,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(threadRef, {
          clientName: safeDisplayName(user),
          clientPhotoURL: safePhotoUrl(user),
          lastMessagePreview,
          lastMessageType: messageType,
          lastSenderRole: senderRole,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      batch.set(threadRef, {
        clientId: targetClient.clientId,
        clientName: clampString(
          isAdmin ? targetClient.clientName : safeDisplayName(user),
          BLUEPRINT_LIMITS.displayNameMax
        ),
        clientPhotoURL: clampString(
          isAdmin ? targetClient.clientPhotoURL : safePhotoUrl(user),
          BLUEPRINT_LIMITS.photoUrlMax
        ),
        lastMessagePreview,
        lastMessageType: messageType,
        lastSenderRole: senderRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(newMsgRef, {
      clientId: targetClient.clientId,
      senderId: user.uid,
      senderName: safeDisplayName(user),
      senderPhotoURL: safePhotoUrl(user),
      senderRole,
      messageType,
      text: cleanText,
      audioData,
      audioDuration,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
