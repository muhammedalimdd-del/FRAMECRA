import React, { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import {
  ASPECT_RATIO_LABELS,
  BLUEPRINT_LIMITS,
  STUDIO_ADMIN_EMAIL,
  VIDEO_TYPE_LABELS,
  type AspectRatio,
  type ProjectBriefInput,
  type VideoDuration,
  type VideoType,
} from '../types';

interface ProjectFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  userEmail?: string | null;
  initialValues?: ProjectBriefInput;
  onClose: () => void;
  onSubmit: (values: ProjectBriefInput) => Promise<void>;
}

const DEFAULT_VALUES: ProjectBriefInput = {
  title: '',
  videoType: 'commercial',
  aspectRatio: '16:9',
  duration: '30s',
  visualStyle: '',
  brief: '',
  referenceUrl: '',
  targetDate: '',
};

const VIDEO_TYPES: VideoType[] = [
  'commercial',
  'product',
  'social',
  'explainer',
  'music',
  'cinematic',
];

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '21:9'];
const DURATIONS: VideoDuration[] = ['15s', '30s', '60s', '90s+'];

export function ProjectFormModal({
  open,
  mode,
  userEmail,
  initialValues,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectBriefInput>(initialValues ?? DEFAULT_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialValues ?? DEFAULT_VALUES);
      setError(null);
    }
  }, [open, initialValues]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.title.trim().length < BLUEPRINT_LIMITS.titleMin) {
      setError(`Please enter a project title (at least ${BLUEPRINT_LIMITS.titleMin} characters).`);
      return;
    }
    if (form.brief.trim().length < BLUEPRINT_LIMITS.briefMin) {
      setError(`Please provide a creative brief (at least ${BLUEPRINT_LIMITS.briefMin} characters).`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save video request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-form-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="project-form-title" className="font-display text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'New AI Video Request' : 'Edit Project Brief'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'create'
                ? `Private submission: other users cannot see your request — only you and ${STUDIO_ADMIN_EMAIL} can view it.`
                : 'Update your creative brief while the request is still in Submitted status.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
            >
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="req-title" className="text-sm font-medium text-slate-800">
                Project Title
              </label>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {form.title.length}/{BLUEPRINT_LIMITS.titleMax}
              </span>
            </div>
            <input
              id="req-title"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.titleMax}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Autumn Product Launch Teaser"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="req-type" className="block text-sm font-medium text-slate-800 mb-1.5">
                Video Type
              </label>
              <select
                id="req-type"
                value={form.videoType}
                onChange={(e) => setForm({ ...form, videoType: e.target.value as VideoType })}
                className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              >
                {VIDEO_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {VIDEO_TYPE_LABELS[vt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="req-ratio" className="block text-sm font-medium text-slate-800 mb-1.5">
                Aspect Ratio
              </label>
              <select
                id="req-ratio"
                value={form.aspectRatio}
                onChange={(e) => setForm({ ...form, aspectRatio: e.target.value as AspectRatio })}
                className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              >
                {ASPECT_RATIOS.map((ar) => (
                  <option key={ar} value={ar}>
                    {ASPECT_RATIO_LABELS[ar]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="req-duration" className="block text-sm font-medium text-slate-800 mb-1.5">
                Target Runtime
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                {DURATIONS.map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setForm({ ...form, duration: dur })}
                    className={`py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                      form.duration === dur
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="req-style" className="text-sm font-medium text-slate-800">
                Visual Style &amp; Lighting Mood <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {form.visualStyle.length}/{BLUEPRINT_LIMITS.visualStyleMax}
              </span>
            </div>
            <input
              id="req-style"
              type="text"
              maxLength={BLUEPRINT_LIMITS.visualStyleMax}
              value={form.visualStyle}
              onChange={(e) => setForm({ ...form, visualStyle: e.target.value })}
              placeholder="e.g., 35mm documentary look, soft morning window light, slow dolly movement"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="req-brief" className="text-sm font-medium text-slate-800">
                Creative Brief &amp; Scene Breakdown
              </label>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {form.brief.length}/{BLUEPRINT_LIMITS.briefMax}
              </span>
            </div>
            <textarea
              id="req-brief"
              required
              rows={5}
              maxLength={BLUEPRINT_LIMITS.briefMax}
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              placeholder="Describe the storyline, key scenes, subject details, camera pacing, voiceover or music mood, and any must-have callouts..."
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="req-ref" className="block text-sm font-medium text-slate-800 mb-1.5">
                Reference Link <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="req-ref"
                type="url"
                maxLength={BLUEPRINT_LIMITS.referenceUrlMax}
                value={form.referenceUrl}
                onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="req-date" className="block text-sm font-medium text-slate-800 mb-1.5">
                Target Delivery Date <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="req-date"
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {mode === 'create' ? (
              <p className="text-[11px] text-slate-500">
                {userEmail ? (
                  <>
                    Signed in as <span className="font-mono text-slate-700">{userEmail}</span> ·
                    Next: confirm with Google Sign-In to send email copy.
                  </>
                ) : (
                  'Next step: confirm with Google Sign-In to email your request.'
                )}
              </p>
            ) : (
              <span />
            )}

            <div className="flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submitting
                    ? mode === 'create'
                      ? 'Sending Request...'
                      : 'Saving...'
                    : mode === 'create'
                      ? 'Send Request'
                      : 'Save Changes'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
