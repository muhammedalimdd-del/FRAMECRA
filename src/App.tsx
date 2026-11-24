import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ChevronRight,
  Film,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { DirectCreatorChat } from './components/DirectCreatorChat';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GmailConfirmModal } from './components/GmailConfirmModal';
import { LandingPage } from './components/LandingPage';
import { ProjectDetail } from './components/ProjectDetail';
import { ProjectFormModal } from './components/ProjectFormModal';
import {
  auth,
  completeGoogleRedirectSignIn,
  parseFirebaseAuthError,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signOutUser,
  type AuthErrorInfo,
} from './firebase';
import {
  createProject,
  isStudioOwnerUser,
  subscribeDirectThreads,
  subscribeProjects,
  syncUserProfile,
  updateProjectBrief,
} from './services/firestoreService';
import {
  buildNewProjectEmailDraft,
  type GmailEmailDraft,
} from './services/gmailService';
import {
  PROJECT_STATUS_META,
  STUDIO_ADMIN_EMAIL,
  VIDEO_TYPE_LABELS,
  type DirectThread,
  type ProjectBriefInput,
  type ProjectStatus,
  type VideoProject,
} from './types';

type SidebarBucket = 'all' | 'active' | 'review' | 'completed';
type WorkspaceView = 'projects' | 'direct_chat';

function formatRelativeDate(ts: VideoProject['updatedAt']): string {
  const date = ts?.toDate?.();
  if (!date) return 'Just now';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function UserAvatar({ user }: { user: User }) {
  const [failed, setFailed] = useState(false);
  const name = user.displayName || user.email || 'User';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (user.photoURL && !failed) {
    return (
      <img
        src={user.photoURL}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function StudioWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [viewingCover, setViewingCover] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const isAdmin = useMemo(() => isStudioOwnerUser(user), [user]);

  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [directThreads, setDirectThreads] = useState<DirectThread[]>([]);
  const [directThreadsLoading, setDirectThreadsLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);

  const [activeView, setActiveView] = useState<WorkspaceView>('direct_chat');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sidebarBucket, setSidebarBucket] = useState<SidebarBucket>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingEmailDraft, setPendingEmailDraft] = useState<GmailEmailDraft | null>(null);

  if (runtimeError) {
    throw runtimeError;
  }

  const handleRuntimeError = useCallback((error: Error) => {
    setRuntimeError(error);
  }, []);

  useEffect(() => {
    void completeGoogleRedirectSignIn()
      .then((redirectUser) => {
        if (redirectUser) {
          setActiveView('direct_chat');
          setSelectedProjectId(null);
          setViewingCover(false);
        }
      })
      .catch((err) => {
        const parsed = parseFirebaseAuthError(err, 'Unable to complete Google Sign-In.');
        if (parsed.kind !== 'cancelled') {
          setAuthError(parsed);
        }
      });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      // Clear any previous account's data immediately to prevent cross-account flash
      setProjects([]);
      setDirectThreads([]);
      setSelectedProjectId(null);
      setPendingEmailDraft(null);
      setUser(nextUser);

      if (nextUser) {
        setAuthError(null);
        setAuthReady(true);
        try {
          await syncUserProfile(nextUser);
        } catch (err) {
          console.error('User profile sync skipped:', err);
        }
      } else {
        setViewingCover(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setProjects([]);
      setDirectThreads([]);
      setProjectsLoading(false);
      setDirectThreadsLoading(false);
      return;
    }
    setProjects([]);
    setDirectThreads([]);
    setProjectsLoading(true);
    setDirectThreadsLoading(true);
    const unsubProjects = subscribeProjects(
      user,
      isAdmin,
      (rows) => {
        setProjects(rows);
        setProjectsLoading(false);
      },
      (err) => {
        setProjectsLoading(false);
        handleRuntimeError(err);
      }
    );
    const unsubDirect = subscribeDirectThreads(
      user,
      isAdmin,
      (rows) => {
        setDirectThreads(rows);
        setDirectThreadsLoading(false);
      },
      (err) => {
        setDirectThreadsLoading(false);
        handleRuntimeError(err);
      }
    );
    return () => {
      unsubProjects();
      unsubDirect();
    };
  }, [authReady, user, isAdmin, handleRuntimeError]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const counts = useMemo(() => {
    const active = projects.filter(
      (p) =>
        p.status === 'submitted' ||
        p.status === 'in_production' ||
        p.status === 'changes_requested'
    ).length;
    const review = projects.filter((p) => p.status === 'in_review').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    return { total: projects.length, active, review, completed };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (sidebarBucket === 'active') {
        if (
          p.status !== 'submitted' &&
          p.status !== 'in_production' &&
          p.status !== 'changes_requested'
        ) {
          return false;
        }
      } else if (sidebarBucket === 'review' && p.status !== 'in_review') {
        return false;
      } else if (sidebarBucket === 'completed' && p.status !== 'completed') {
        return false;
      }

      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }

      if (q) {
        const haystack = `${p.title} ${p.clientName} ${p.visualStyle} ${p.brief} ${VIDEO_TYPE_LABELS[p.videoType]}`.toLowerCase();
        return haystack.includes(q);
      }

      return true;
    });
  }, [projects, sidebarBucket, statusFilter, searchQuery]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setAuthError(null);
    try {
      const signedInUser = await signInWithGoogle();
      setUser(signedInUser);
      setActiveView('direct_chat');
      setSelectedProjectId(null);
      setViewingCover(false);
    } catch (err) {
      const parsed = parseFirebaseAuthError(err, 'Unable to sign in with Google.');
      if (parsed.kind !== 'cancelled') {
        setAuthError(parsed);
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleGoogleRedirectSignIn() {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      const parsed = parseFirebaseAuthError(err, 'Unable to start Google Sign-In redirect.');
      if (parsed.kind !== 'cancelled') {
        setAuthError(parsed);
      }
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    setViewingCover(false);
    await signOutUser();
  }

  function openNewRequestModal() {
    setModalMode('create');
    setModalOpen(true);
    setMobileMenuOpen(false);
  }

  function openEditBriefModal() {
    setModalMode('edit');
    setModalOpen(true);
  }

  async function handleFormSubmit(values: ProjectBriefInput) {
    if (!user) return;
    if (modalMode === 'create') {
      const newId = await createProject(user, values);
      setActiveView('projects');
      setSelectedProjectId(newId);
      setPendingEmailDraft(
        buildNewProjectEmailDraft(
          user.displayName || user.email?.split('@')[0] || 'Client',
          user.email || 'Unknown email',
          values
        )
      );
    } else if (selectedProject) {
      await updateProjectBrief(selectedProject.id, values);
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="font-display text-lg font-bold text-slate-900">Framecraft Studio</p>
          <p className="text-xs text-slate-500">Connecting your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user || viewingCover) {
    return (
      <LandingPage
        user={user}
        isAdmin={isAdmin}
        onSignIn={handleGoogleSignIn}
        onRedirectSignIn={handleGoogleRedirectSignIn}
        onEnterStudio={() => setViewingCover(false)}
        onSignOut={handleSignOut}
        signingIn={signingIn}
        authError={authError}
      />
    );
  }

  const navItems: { key: SidebarBucket; label: string; count: number }[] = [
    { key: 'all', label: isAdmin ? 'All Studio Requests' : 'All Projects', count: counts.total },
    { key: 'active', label: 'Active Production', count: counts.active },
    { key: 'review', label: 'Ready for Review', count: counts.review },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveView('projects');
            setSelectedProjectId(null);
            setSidebarBucket('all');
            setMobileMenuOpen(false);
          }}
          className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap cursor-pointer"
        >
          Framecraft Studio
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        <button
          type="button"
          onClick={openNewRequestModal}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Video Request</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('direct_chat');
            setSelectedProjectId(null);
            setMobileMenuOpen(false);
          }}
          className={`w-full inline-flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
            activeView === 'direct_chat'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="truncate">{isAdmin ? 'Direct Messages' : 'Chat & Voice'}</span>
          </span>
          {isAdmin && (
            <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
              {directThreads.length}
            </span>
          )}
        </button>
        {!isAdmin && (
          <p className="px-1 text-[11px] font-mono text-slate-500 truncate">
            Direct to {STUDIO_ADMIN_EMAIL}
          </p>
        )}
      </div>

      <nav aria-label="Project buckets" className="px-3 space-y-0.5">
        {navItems.map((item) => {
          const active = activeView === 'projects' && !selectedProjectId && sidebarBucket === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveView('projects');
                setSelectedProjectId(null);
                setSidebarBucket(item.key);
                setStatusFilter('all');
                setMobileMenuOpen(false);
              }}
              className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="truncate">{item.label}</span>
              <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Quick Switcher for Recent Projects */}
      <div className="mt-6 pt-5 px-3 border-t border-slate-100 flex-1 overflow-y-auto">
        <p className="px-3 text-xs font-medium text-slate-400 mb-2">Recent Projects</p>
        {projects.length === 0 ? (
          <p className="px-3 text-xs text-slate-400">No projects yet</p>
        ) : (
          <div className="space-y-0.5">
            {projects.slice(0, 8).map((p) => {
              const isSelected = activeView === 'projects' && selectedProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActiveView('projects');
                    setSelectedProjectId(p.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-medium truncate">{p.title}</p>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      isSelected ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {PROJECT_STATUS_META[p.status].label} · {p.aspectRatio}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            setViewingCover(true);
            setMobileMenuOpen(false);
          }}
          className="w-full text-left px-2 py-1 text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          View Cover Page
        </button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.displayName || user.email}
              </p>
              <p className={`text-[11px] truncate ${isAdmin ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
                {isAdmin ? 'Studio Creator' : 'Client Account'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Breadcrumb Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              {activeView === 'direct_chat' ? (
                <span className="font-semibold text-slate-900 truncate">
                  {isAdmin ? 'Direct Messages Inbox' : `Chat with ${STUDIO_ADMIN_EMAIL}`}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(null)}
                    className={`whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedProject
                        ? 'text-slate-500 hover:text-slate-900'
                        : 'font-semibold text-slate-900'
                    }`}
                  >
                    {isAdmin ? 'Studio Queue' : 'My Video Projects'}
                  </button>
                  {selectedProject && (
                    <>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-900 truncate">
                        {selectedProject.title}
                      </span>
                    </>
                  )}
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeView === 'direct_chat' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveView('projects');
                  setSelectedProjectId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                <span>{isAdmin ? 'Video Queue' : 'My Projects'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveView('direct_chat');
                  setSelectedProjectId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isAdmin ? 'Direct Inbox' : 'Chat & Voice'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={openNewRequestModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-[1380px] w-full mx-auto">
          {activeView === 'direct_chat' ? (
            <DirectCreatorChat
              user={user}
              isAdmin={isAdmin}
              threads={directThreads}
              threadsLoading={directThreadsLoading}
              onRequestEmailSend={setPendingEmailDraft}
              onRuntimeError={handleRuntimeError}
            />
          ) : selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              user={user}
              isAdmin={isAdmin}
              onBack={() => setSelectedProjectId(null)}
              onEditBrief={openEditBriefModal}
              onRequestEmailSend={setPendingEmailDraft}
              onRuntimeError={handleRuntimeError}
            />
          ) : (
            <div className="space-y-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    {isAdmin ? 'Incoming AI Video Requests' : 'Your Private AI Video Requests'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {isAdmin
                      ? `Private studio queue — only ${STUDIO_ADMIN_EMAIL} can view all client video requests, edit notes, and chats.`
                      : `Other clients cannot see your requests. Only you and ${STUDIO_ADMIN_EMAIL} can view your video briefs, edits, and messages.`}
                  </p>
                </div>
              </div>

              {/* Clean 4-Metric Hairline Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
                <div className="p-5">
                  <p className="text-xs text-slate-500">Total Requests</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {counts.total}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Active Production</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-blue-600 tabular-nums">
                    {counts.active}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Ready for Review</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-amber-600 tabular-nums">
                    {counts.review}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Completed Cuts</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-emerald-600 tabular-nums">
                    {counts.completed}
                  </p>
                </div>
              </div>

              {/* Search & Segmented Status Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects by title, style, or brief..."
                    aria-label="Search projects"
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {(
                    [
                      { key: 'all', label: 'All' },
                      { key: 'submitted', label: 'Submitted' },
                      { key: 'in_production', label: 'Production' },
                      { key: 'in_review', label: 'Review' },
                      { key: 'changes_requested', label: 'Edits' },
                      { key: 'completed', label: 'Completed' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === tab.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Projects Data Table / List */}
              {projectsLoading ? (
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="px-6 py-4 flex items-center justify-between gap-4 animate-pulse">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-56 bg-slate-200 rounded" />
                        <div className="h-3 w-40 bg-slate-100 rounded" />
                      </div>
                      <div className="h-4 w-24 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 text-center">
                  <div className="w-11 h-11 rounded-lg bg-[#F8F9FA] border border-slate-200 flex items-center justify-center mx-auto mb-4">
                    <Film className="w-5 h-5 text-slate-500" />
                  </div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {projects.length === 0
                      ? 'No AI video requests yet'
                      : 'No matching projects found'}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
                    {projects.length === 0
                      ? 'Create your first AI video request to share your creative brief, track production cuts, log timecoded edits, and chat with the studio creator.'
                      : 'Try clearing your search filter or switching to a different status tab.'}
                  </p>
                  {projects.length === 0 && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={openNewRequestModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Submit First Video Request</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('direct_chat');
                          setSelectedProjectId(null);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Chat &amp; Voice with {STUDIO_ADMIN_EMAIL}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-[#F8F9FA] text-xs font-medium text-slate-500">
                          <th className="py-3 pl-6 pr-4">Project</th>
                          {isAdmin && <th className="py-3 px-4 whitespace-nowrap">Client</th>}
                          <th className="py-3 px-4 whitespace-nowrap">Format</th>
                          <th className="py-3 px-4 whitespace-nowrap">Status</th>
                          <th className="py-3 px-4 text-right whitespace-nowrap">Cut</th>
                          <th className="py-3 pl-4 pr-6 text-right whitespace-nowrap">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredProjects.map((project) => {
                          const meta = PROJECT_STATUS_META[project.status];
                          return (
                            <tr
                              key={project.id}
                              onClick={() => setSelectedProjectId(project.id)}
                              className="hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
                            >
                              <td className="py-4 pl-6 pr-4 max-w-md">
                                <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                  {project.title}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {project.visualStyle || project.brief}
                                </p>
                              </td>
                              {isAdmin && (
                                <td className="py-4 px-4 text-xs text-slate-700 whitespace-nowrap">
                                  {project.clientName}
                                </td>
                              )}
                              <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                                <span>{VIDEO_TYPE_LABELS[project.videoType]}</span>
                                <span aria-hidden="true" className="mx-1.5 text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  {project.aspectRatio} / {project.duration}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs whitespace-nowrap">
                                <span className={`font-medium ${meta.colorClass}`}>
                                  {meta.label}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs font-mono text-slate-600 text-right tabular-nums whitespace-nowrap">
                                {project.version > 0 ? `v${project.version}` : '—'}
                              </td>
                              <td className="py-4 pl-4 pr-6 text-xs font-mono text-slate-500 text-right tabular-nums whitespace-nowrap">
                                {formatRelativeDate(project.updatedAt ?? project.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create / Edit Video Request Modal */}
      <ProjectFormModal
        open={modalOpen}
        mode={modalMode}
        userEmail={user.email}
        initialValues={
          modalMode === 'edit' && selectedProject
            ? {
                title: selectedProject.title,
                videoType: selectedProject.videoType,
                aspectRatio: selectedProject.aspectRatio,
                duration: selectedProject.duration,
                visualStyle: selectedProject.visualStyle,
                brief: selectedProject.brief,
                referenceUrl: selectedProject.referenceUrl,
                targetDate: selectedProject.targetDate,
              }
            : undefined
        }
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Explicit Confirmation Modal Before Sending Any Gmail Notification */}
      <GmailConfirmModal
        draft={pendingEmailDraft}
        userEmail={user.email}
        onClose={() => setPendingEmailDraft(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioWorkspace />
    </ErrorBoundary>
  );
}
