import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Film,
  Mail,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  deleteProject,
  subscribeEditRequests,
  updateProjectByCreator,
  updateProjectStatusByClient,
} from '../services/firestoreService';
import {
  buildNewProjectEmailDraft,
  type GmailEmailDraft,
} from '../services/gmailService';
import {
  ASPECT_RATIO_LABELS,
  BLUEPRINT_LIMITS,
  PROJECT_STATUS_META,
  VIDEO_TYPE_LABELS,
  type EditRequest,
  type ProjectStatus,
  type VideoProject,
} from '../types';
import { EditRequestsPanel } from './EditRequestsPanel';
import { ProjectChat } from './ProjectChat';

interface ProjectDetailProps {
  project: VideoProject;
  user: User;
  isAdmin: boolean;
  onBack: () => void;
  onEditBrief: () => void;
  onRequestEmailSend: (draft: GmailEmailDraft) => void;
  onRuntimeError: (error: Error) => void;
}

const PIPELINE_STEPS: { key: ProjectStatus; label: string }[] = [
  { key: 'submitted', label: '01. Submitted' },
  { key: 'in_production', label: '02. In Production' },
  { key: 'in_review', label: '03. Ready for Review' },
  { key: 'completed', label: '04. Completed' },
];

function getStepIndex(status: ProjectStatus): number {
  switch (status) {
    case 'submitted':
      return 0;
    case 'in_production':
    case 'changes_requested':
      return 1;
    case 'in_review':
      return 2;
    case 'completed':
      return 3;
  }
}

function getEmbedInfo(url: string): { type: 'video' | 'iframe' | 'link'; src: string } {
  const trimmed = url.trim();
  if (!trimmed) return { type: 'link', src: '' };

  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
    return { type: 'video', src: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v');
      if (id) return { type: 'iframe', src: `https://www.youtube.com/embed/${id}` };
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      if (id) return { type: 'iframe', src: `https://www.youtube.com/embed/${id}` };
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` };
      }
    }
  } catch {
    // Non-URL fallback
  }

  return { type: 'link', src: trimmed };
}

function formatDate(ts: VideoProject['createdAt']): string {
  const d = ts?.toDate?.();
  if (!d) return 'Just now';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectDetail({
  project,
  user,
  isAdmin,
  onBack,
  onEditBrief,
  onRequestEmailSend,
  onRuntimeError,
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'brief' | 'edits' | 'chat'>('brief');
  const [edits, setEdits] = useState<EditRequest[]>([]);
  const [editsLoading, setEditsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  // Creator studio controls state
  const [showCreatorControls, setShowCreatorControls] = useState(false);
  const [creatorStatus, setCreatorStatus] = useState<ProjectStatus>(project.status);
  const [creatorPreviewUrl, setCreatorPreviewUrl] = useState(project.previewUrl);
  const [creatorPreviewNote, setCreatorPreviewNote] = useState(project.previewNote);
  const [creatorVersion, setCreatorVersion] = useState<number>(project.version);
  const [savingCreator, setSavingCreator] = useState(false);
  const [creatorSavedNotice, setCreatorSavedNotice] = useState(false);

  // Client action states
  const [approving, setApproving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setCreatorStatus(project.status);
    setCreatorPreviewUrl(project.previewUrl);
    setCreatorPreviewNote(project.previewNote);
    setCreatorVersion(project.version);
  }, [project.id, project.status, project.previewUrl, project.previewNote, project.version]);

  useEffect(() => {
    setEditsLoading(true);
    const unsub = subscribeEditRequests(
      project.id,
      user,
      isAdmin,
      (rows) => {
        setEdits(rows);
        setEditsLoading(false);
      },
      (err) => {
        setEditsLoading(false);
        onRuntimeError(err);
      }
    );
    return () => unsub();
  }, [project.id, user, isAdmin, onRuntimeError]);

  const statusMeta = PROJECT_STATUS_META[project.status];
  const stepIdx = getStepIndex(project.status);
  const openEditCount = edits.filter((e) => e.status !== 'resolved').length;
  const embedInfo = getEmbedInfo(project.previewUrl);

  async function handleCreatorUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSavingCreator(true);
    setCreatorSavedNotice(false);
    try {
      await updateProjectByCreator(project.id, {
        status: creatorStatus,
        previewUrl: creatorPreviewUrl,
        previewNote: creatorPreviewNote,
        version: creatorVersion,
      });
      setCreatorSavedNotice(true);
      setTimeout(() => setCreatorSavedNotice(false), 3000);
    } catch (err) {
      onRuntimeError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSavingCreator(false);
    }
  }

  async function handleApproveCut() {
    setApproving(true);
    try {
      await updateProjectStatusByClient(project.id, 'completed');
    } catch (err) {
      onRuntimeError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setApproving(false);
    }
  }

  async function handleDeleteProject() {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onBack();
    } catch (err) {
      setDeleting(false);
      onRuntimeError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  function handleQuickRequestEdit() {
    setActiveTab('edits');
    setShowEditForm(true);
  }

  return (
    <div className="space-y-6">
      {/* Top Action & Title Row */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </button>

          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 break-words">
            {project.title}
          </h1>

          {/* Clean unboxed metadata line */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
            <span className={`font-semibold ${statusMeta.colorClass}`}>{statusMeta.label}</span>
            <span aria-hidden="true">·</span>
            <span>{VIDEO_TYPE_LABELS[project.videoType]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.aspectRatio}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{project.duration}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {project.version > 0 ? `Cut v${project.version}` : 'No cut yet'}
            </span>
            {isAdmin && (
              <>
                <span aria-hidden="true">·</span>
                <span>Client: {project.clientName}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Client actions */}
          {project.clientId === user.uid && project.status === 'submitted' && (
            <>
              <button
                type="button"
                onClick={onEditBrief}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Brief</span>
              </button>

              {confirmDelete ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <span className="text-red-700 font-medium">Delete request?</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDeleteProject()}
                    className="text-red-700 font-semibold underline cursor-pointer"
                  >
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-600 bg-white border border-slate-300 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Withdraw</span>
                </button>
              )}
            </>
          )}

          {project.clientId === user.uid && project.status === 'in_review' && (
            <>
              <button
                type="button"
                onClick={handleQuickRequestEdit}
                className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Request Edits
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={() => void handleApproveCut()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{approving ? 'Approving...' : 'Approve Final Cut'}</span>
              </button>
            </>
          )}

          {project.status !== 'completed' && project.status !== 'in_review' && (
            <button
              type="button"
              onClick={handleQuickRequestEdit}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Request Edit
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onRequestEmailSend(
                buildNewProjectEmailDraft(
                  project.clientName,
                  user.email || 'Client account',
                  {
                    title: project.title,
                    videoType: project.videoType,
                    aspectRatio: project.aspectRatio,
                    duration: project.duration,
                    visualStyle: project.visualStyle,
                    brief: project.brief,
                    referenceUrl: project.referenceUrl,
                    targetDate: project.targetDate,
                  }
                )
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email to Studio</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreatorControls((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showCreatorControls ? 'Hide Studio Controls' : 'Publish Cut / Status'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Studio Creator Controls Drawer (Admin Only) */}
      {isAdmin && showCreatorControls && (
        <form
          onSubmit={handleCreatorUpdate}
          className="p-5 bg-white border border-slate-200 rounded-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Creator Production Controls
              </h2>
              <p className="text-xs text-slate-500">
                Update the workflow stage and publish a video preview link for {project.clientName}.
              </p>
            </div>
            {creatorSavedNotice && (
              <span className="text-xs font-medium text-emerald-600">
                Saved and synced to client
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="creator-status" className="block text-xs font-medium text-slate-700 mb-1">
                Production Status
              </label>
              <select
                id="creator-status"
                value={creatorStatus}
                onChange={(e) => setCreatorStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="submitted">Submitted</option>
                <option value="in_production">In Production</option>
                <option value="in_review">Ready for Review</option>
                <option value="changes_requested">Changes Requested</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label htmlFor="creator-version" className="block text-xs font-medium text-slate-700 mb-1">
                Cut Version
              </label>
              <input
                id="creator-version"
                type="number"
                min={BLUEPRINT_LIMITS.versionMin}
                max={BLUEPRINT_LIMITS.versionMax}
                value={creatorVersion}
                onChange={(e) => setCreatorVersion(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="creator-url" className="block text-xs font-medium text-slate-700 mb-1">
                Preview / Delivery Video URL
              </label>
              <input
                id="creator-url"
                type="url"
                maxLength={BLUEPRINT_LIMITS.previewUrlMax}
                value={creatorPreviewUrl}
                onChange={(e) => setCreatorPreviewUrl(e.target.value)}
                placeholder="https://... (.mp4, YouTube, Vimeo, Drive)"
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="creator-note" className="block text-xs font-medium text-slate-700 mb-1">
              Delivery / Revision Notes
            </label>
            <input
              id="creator-note"
              type="text"
              maxLength={BLUEPRINT_LIMITS.previewNoteMax}
              value={creatorPreviewNote}
              onChange={(e) => setCreatorPreviewNote(e.target.value)}
              placeholder="e.g., Cut v1 ready — generated opening aerial and matched dusk color grade."
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreatorControls(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={savingCreator}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              {savingCreator ? 'Publishing...' : 'Save Studio Update'}
            </button>
          </div>
        </form>
      )}

      {/* Main Split-Pane Workspace: Left (Brief, Preview, Edit Requests) + Right (Live Project Chat) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-6">
          {/* Production Pipeline Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {PIPELINE_STEPS.map((step, idx) => {
                const isDone = idx < stepIdx || project.status === 'completed';
                const isCurrent = idx === stepIdx && project.status !== 'completed';
                return (
                  <div key={step.key} className="space-y-2">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        isDone
                          ? 'bg-emerald-600'
                          : isCurrent
                            ? project.status === 'changes_requested'
                              ? 'bg-red-500'
                              : 'bg-slate-900'
                            : 'bg-slate-200'
                      }`}
                    />
                    <p
                      className={`text-xs font-medium ${
                        isDone || isCurrent ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">{statusMeta.description}</p>
          </div>

          {/* Video Cut Preview Frame */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-900">
                {project.previewUrl
                  ? `Latest Cut Preview · v${Math.max(1, project.version)}`
                  : 'Delivery Preview'}
              </span>
              {project.previewUrl && (
                <a
                  href={project.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
                >
                  <span>Open in new tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {project.previewUrl ? (
              <div>
                {embedInfo.type === 'video' ? (
                  <div className="bg-slate-950 aspect-video">
                    <video
                      src={embedInfo.src}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : embedInfo.type === 'iframe' ? (
                  <div className="bg-slate-950 aspect-video">
                    <iframe
                      src={embedInfo.src}
                      title={`${project.title} preview`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-950 px-6 py-12 text-center text-white">
                    <Film className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-medium">
                      Cut v{Math.max(1, project.version)} published by Studio Creator
                    </p>
                    <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto break-all font-mono">
                      {project.previewUrl}
                    </p>
                    <a
                      href={project.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <span>Watch Cut Preview</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {project.previewNote && (
                  <div className="px-5 py-3.5 bg-[#F8F9FA] border-t border-slate-200 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Creator cut note: </span>
                    {project.previewNote}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-950 px-6 py-14 text-center">
                <Film className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-200">
                  Awaiting First AI Video Cut
                </p>
                <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Target format:{' '}
                  <span className="font-mono text-slate-300">
                    {project.aspectRatio} · {project.duration}
                  </span>
                  . Once the creator publishes Cut v1, your playable review preview will appear
                  right here.
                </p>
              </div>
            )}
          </div>

          {/* Segmented Tabs for Brief, Edit Requests, and Mobile Chat */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('brief')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'brief'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Brief &amp; Specs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edits')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'edits'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Edit Requests{' '}
                  <span className="font-mono tabular-nums text-slate-400 ml-1">
                    {edits.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`xl:hidden px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Project Chat
                </button>
              </div>

              {openEditCount > 0 && activeTab !== 'edits' && (
                <span className="text-xs font-mono text-amber-600 tabular-nums shrink-0">
                  {openEditCount} open {openEditCount === 1 ? 'edit' : 'edits'}
                </span>
              )}
            </div>

            <div className="p-5">
              {activeTab === 'brief' && (
                <div className="space-y-6">
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-100 text-xs">
                    <div>
                      <dt className="text-slate-400">Video Format</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {VIDEO_TYPE_LABELS[project.videoType]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Aspect Ratio</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900">
                        {ASPECT_RATIO_LABELS[project.aspectRatio]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Runtime</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900">
                        {project.duration}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Target Delivery</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900">
                        {project.targetDate || 'Flexible'}
                      </dd>
                    </div>
                  </dl>

                  {project.visualStyle && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                        Visual Style &amp; Lighting Direction
                      </h3>
                      <p className="text-sm text-slate-800 leading-relaxed">{project.visualStyle}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                      Creative Brief &amp; Scene Breakdown
                    </h3>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {project.brief}
                    </p>
                  </div>

                  {project.referenceUrl && (
                    <div className="pt-4 border-t border-slate-100">
                      <h3 className="text-xs font-semibold text-slate-500 mb-1.5">
                        Reference Link
                      </h3>
                      <a
                        href={project.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all"
                      >
                        <span>{project.referenceUrl}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>Submitted by {project.clientName}</span>
                    <span className="font-mono tabular-nums">
                      Created {formatDate(project.createdAt)}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'edits' && (
                <EditRequestsPanel
                  project={project}
                  edits={edits}
                  loading={editsLoading}
                  user={user}
                  isAdmin={isAdmin}
                  showCreateForm={showEditForm}
                  onToggleCreateForm={setShowEditForm}
                  onRequestEmailSend={onRequestEmailSend}
                />
              )}

              {activeTab === 'chat' && (
                <div className="xl:hidden h-[520px]">
                  <ProjectChat
                    project={project}
                    user={user}
                    isAdmin={isAdmin}
                    onRequestEmailSend={onRequestEmailSend}
                    onRuntimeError={onRuntimeError}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dedicated Live Project Chat Column on Desktop */}
        <div className="hidden xl:block xl:col-span-5 xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)]">
          <ProjectChat
            project={project}
            user={user}
            isAdmin={isAdmin}
            onRequestEmailSend={onRequestEmailSend}
            onRuntimeError={onRuntimeError}
          />
        </div>
      </div>
    </div>
  );
}
