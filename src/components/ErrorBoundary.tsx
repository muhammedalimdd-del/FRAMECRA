import React from 'react';
import { FIREBASE_CONFIG_META, type FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
  isDailyReadQuota: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isQuotaError: false,
      isDailyReadQuota: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as FirestoreErrorInfo;
      if (parsed && typeof parsed.error === 'string') {
        readable = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ''}`;
      }
    } catch {
      // Plain error message
    }

    const isDailyReadQuota = readable.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    );
    const isQuotaError = isDailyReadQuota || readable.toLowerCase().includes('quota exceeded');

    return {
      hasError: true,
      message: readable,
      isQuotaError,
      isDailyReadQuota,
    };
  }

  override render() {
    if (this.state.hasError) {
      const upgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_CONFIG_META.projectId}/firestore/databases/${FIREBASE_CONFIG_META.firestoreDatabaseId}/data?openUpgradeDialog=true`;

      return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <h1 className="text-xl font-semibold text-slate-900">
              {this.state.isQuotaError ? 'Firestore Usage Limit Reached' : 'Workspace Connection Issue'}
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {this.state.isQuotaError
                ? 'This database has reached its free-tier daily quota. Quotas reset the next day, or you can review the Spark plan limits under Firestore Enterprise edition.'
                : 'We encountered an error syncing with the studio database. Reload the workspace or sign back in to continue.'}
            </p>
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 break-words">
              {this.state.message}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Reload Workspace
              </button>
              {this.state.isDailyReadQuota && (
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Open Database Console
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
