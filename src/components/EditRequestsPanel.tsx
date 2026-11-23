import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { Check, Mail, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  createEditRequest,
  deleteEditRequest,
  updateEditRequestByAuthor,
  updateEditRequestByCreator,
} from '../services/firestoreService';
import {
  buildEditRequestEmailDraft,
  type GmailEmailDraft,
} from '../services/gmailService';
import {
  BLUEPRINT_LIMITS,
  EDIT_CATEGORY_LABELS,
  EDIT_STATUS_META,
  STUDIO_ADMIN_EMAIL,
  type EditCategory,
  type EditPriority,
  type EditRequest,
  type EditRequestInput,
  type EditStatus,
  type VideoProject,
} from '../types';

interface EditRequestsPanelProps {
  project: VideoProject;
  edits: EditRequest[];
  loading: boolean;
  user: User;
  isAdmin: boolean;
  showCreateForm: boolean;
  onToggleCreateForm: (open: boolean) => void;
  onRequestEmailSend: (draft: GmailEmailDraft) => void;
}

const CATEGORIES: EditCategory[] = ['visual', 'pacing', 'color', 'audio', 'text', 'other'];

const EMPTY_FORM: EditRequestInput = {
  timecode: '',
  category: 'visual',
  priority: 'standard',
  instructions: '',
};

function formatShortDate(ts: EditRequest['createdAt']): string {
  const d = ts?.toDate?.();
  if (!d) return 'Just now';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function EditRequestsPanel({
  project,
  edits,
  loading,
  user,
  isAdmin,
  showCreateForm,
  onToggleCreateForm,
  onRequestEmailSend,
}: EditRequestsPanelProps) {
  const [form, setForm] = useState<EditRequestInput>(EMPTY_FORM);
  const [sendEmailCopy, setSendEmailCopy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditRequestInput>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [creatorStatus, setCreatorStatus] = useState<EditStatus>('in_progress');
  const [resolutionNote, setResolutionNote] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const canFileNewEdit = isAdmin || project.status !== 'completed';

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (form.instructions.trim().length < BLUEPRINT_LIMITS.instructionsMin) {
      setFormError(
        `Please describe the edit in at least ${BLUEPRINT_LIMITS.instructionsMin} characters.`
      );
      return;
    }

    const submittedForm = { ...form };
    setSubmitting(true);
    try {
      await createEditRequest(project, user, submittedForm, project.status === 'in_review');
      setForm(EMPTY_FORM);
      onToggleCreateForm(false);
      if (sendEmailCopy) {
        onRequestEmailSend(
          buildEditRequestEmailDraft(
            project,
            user.displayName || user.email?.split('@')[0] || 'Client',
            user.email || 'Client account',
            submittedForm
          )
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit edit request.');
    } finally {
      setSubmitting(false);
    }
  }

  function startClientEdit(item: EditRequest) {
    setEditingId(item.id);
    setEditDraft({
      timecode: item.timecode,
      category: item.category,
      priority: item.priority,
      instructions: item.instructions,
    });
  }

  async function saveClientEdit(editId: string) {
    setSavingId(editId);
    try {
      await updateEditRequestByAuthor(project.id, editId, editDraft);
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  function startCreatorReview(item: EditRequest) {
    setResolvingId(item.id);
    setCreatorStatus(item.status === 'open' ? 'resolved' : item.status);
    setResolutionNote(item.resolutionNote);
  }

  async function saveCreatorReview(editId: string) {
    setSavingId(editId);
    try {
      await updateEditRequestByCreator(project.id, editId, {
        status: creatorStatus,
        resolutionNote,
      });
      setResolvingId(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(editId: string) {
    setSavingId(editId);
    try {
      await deleteEditRequest(project.id, editId);
      setConfirmDeleteId(null);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Timecoded Edit Requests
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {project.status === 'completed' && !isAdmin
              ? 'This project is marked completed and revision logging is closed.'
              : 'Specify timestamps and exact visual, pacing, or audio adjustments for this cut.'}
          </p>
        </div>

        {canFileNewEdit && !showCreateForm && (
          <button
            type="button"
            onClick={() => onToggleCreateForm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Request Edit</span>
          </button>
        )}
      </div>

      {/* Inline Create Edit Request Form */}
      {showCreateForm && canFileNewEdit && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-5 bg-[#F8F9FA] border border-slate-200 rounded-xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">New Edit Request</span>
            <button
              type="button"
              onClick={() => onToggleCreateForm(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close edit request form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-tc" className="block text-xs font-medium text-slate-700 mb-1">
                Timecode <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="edit-tc"
                type="text"
                maxLength={BLUEPRINT_LIMITS.timecodeMax}
                value={form.timecode}
                onChange={(e) => setForm({ ...form, timecode: e.target.value })}
                placeholder="00:14 or 00:08-00:12"
                className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="edit-cat" className="block text-xs font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                id="edit-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as EditCategory })}
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {EDIT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-prio" className="block text-xs font-medium text-slate-700 mb-1">
                Priority
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-lg">
                {(['standard', 'high'] as EditPriority[]).map((prio) => (
                  <button
                    key={prio}
                    type="button"
                    onClick={() => setForm({ ...form, priority: prio })}
                    className={`py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                      form.priority === prio
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {prio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="edit-inst" className="text-xs font-medium text-slate-700">
                Edit Instructions
              </label>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {form.instructions.length}/{BLUEPRINT_LIMITS.instructionsMax}
              </span>
            </div>
            <textarea
              id="edit-inst"
              required
              rows={3}
              maxLength={BLUEPRINT_LIMITS.instructionsMax}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Describe clearly what should change at this moment (e.g., soften the twilight highlights, hold the product shot 1.5s longer, replace background music cue)..."
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 resize-y"
            />
          </div>

          {project.status === 'in_review' && project.clientId === user.uid && (
            <p className="text-xs text-slate-500">
              Submitting this edit will automatically mark the project as Changes Requested so the
              creator knows a new revision is needed.
            </p>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendEmailCopy}
              onChange={(e) => setSendEmailCopy(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>
              Prompt to email this edit request to{' '}
              <span className="font-mono text-slate-800">{STUDIO_ADMIN_EMAIL}</span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onToggleCreateForm(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Edit Request'}
            </button>
          </div>
        </form>
      )}

      {/* List of Edit Requests */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : edits.length === 0 ? (
        <div className="py-10 px-6 text-center border border-dashed border-slate-300 rounded-xl bg-[#F8F9FA]">
          <p className="text-sm font-medium text-slate-800">No edit requests logged yet</p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Whenever you want a visual, color, pacing, or audio change on this AI video, log it
            here with an optional timecode so nothing gets missed.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {edits.map((item) => {
            const statusMeta = EDIT_STATUS_META[item.status];
            const isEditing = editingId === item.id;
            const isResolving = resolvingId === item.id;
            const canAuthorModify = item.authorId === user.uid && item.status === 'open';

            return (
              <div key={item.id} className="p-4 sm:p-5">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        maxLength={BLUEPRINT_LIMITS.timecodeMax}
                        value={editDraft.timecode}
                        onChange={(e) => setEditDraft({ ...editDraft, timecode: e.target.value })}
                        placeholder="00:14"
                        className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
                      />
                      <select
                        value={editDraft.category}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, category: e.target.value as EditCategory })
                        }
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {EDIT_CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editDraft.priority}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, priority: e.target.value as EditPriority })
                        }
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="standard">Standard Priority</option>
                        <option value="high">High Priority</option>
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={BLUEPRINT_LIMITS.instructionsMax}
                      value={editDraft.instructions}
                      onChange={(e) => setEditDraft({ ...editDraft, instructions: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingId === item.id}
                        onClick={() => void saveClientEdit(item.id)}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                      >
                        {savingId === item.id ? 'Saving...' : 'Save Edit'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        {item.timecode && (
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            @ {item.timecode}
                          </span>
                        )}
                        <span className="text-slate-600">
                          {EDIT_CATEGORY_LABELS[item.category]}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span
                          className={
                            item.priority === 'high'
                              ? 'text-red-600 font-medium'
                              : 'text-slate-500'
                          }
                        >
                          {item.priority === 'high' ? 'High priority' : 'Standard'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className={`font-medium ${statusMeta.colorClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono tabular-nums">{formatShortDate(item.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestEmailSend(
                              buildEditRequestEmailDraft(
                                project,
                                item.authorName,
                                user.email || 'Client account',
                                {
                                  timecode: item.timecode,
                                  category: item.category,
                                  priority: item.priority,
                                  instructions: item.instructions,
                                }
                              )
                            )
                          }
                          title={`Email edit request to ${STUDIO_ADMIN_EMAIL}`}
                          aria-label="Email edit request to studio Gmail"
                          className="p-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        {canAuthorModify && (
                          <button
                            type="button"
                            onClick={() => startClientEdit(item)}
                            className="p-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                            aria-label="Edit request details"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(canAuthorModify || isAdmin) && (
                          confirmDeleteId === item.id ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <button
                                type="button"
                                onClick={() => void handleDelete(item.id)}
                                className="text-red-600 font-medium hover:underline cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              aria-label="Delete edit request"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <p className="mt-2.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {item.instructions}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      Requested by {item.authorName}
                    </p>

                    {item.resolutionNote && !isResolving && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">Creator note: </span>
                        {item.resolutionNote}
                      </div>
                    )}

                    {/* Creator Resolution Controls */}
                    {isAdmin && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {isResolving ? (
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={creatorStatus}
                                onChange={(e) => setCreatorStatus(e.target.value as EditStatus)}
                                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                              </select>
                              <input
                                type="text"
                                maxLength={BLUEPRINT_LIMITS.resolutionNoteMax}
                                value={resolutionNote}
                                onChange={(e) => setResolutionNote(e.target.value)}
                                placeholder="Add creator resolution note (e.g., Updated in Cut v2)..."
                                className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-slate-300 rounded-md text-slate-900"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setResolvingId(null)}
                                className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingId === item.id}
                                onClick={() => void saveCreatorReview(item.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{savingId === item.id ? 'Updating...' : 'Update Status'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startCreatorReview(item)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                          >
                            Update status / add resolution note
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
