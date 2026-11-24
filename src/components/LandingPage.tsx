import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowDown, ArrowRight, Film, MessageSquare, SlidersHorizontal } from 'lucide-react';
import type { AuthErrorInfo } from '../firebase';
import { AuthErrorAlert } from './AuthErrorAlert';

interface LandingPageProps {
  user: User | null;
  isAdmin: boolean;
  onSignIn: () => Promise<void>;
  onEnterStudio: () => void;
  onSignOut: () => Promise<void>;
  signingIn: boolean;
  authError: AuthErrorInfo | null;
}

const COVER_BACKDROP = '/src/assets/images/studio_cover_backdrop_1795100960354.jpg';
const HERO_STUDIO_IMAGE = '/src/assets/images/studio_hero_showcase_1795089657207.jpg';
const COMMERCIAL_STILL = '/src/assets/images/sample_commercial_reel_1795089656338.jpg';
const PRODUCT_STILL = '/src/assets/images/sample_product_film_1795089656381.jpg';

function GoogleMark() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function StudioImage({
  src,
  alt,
  fallbackTitle,
  className = '',
}: {
  src: string;
  alt: string;
  fallbackTitle: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-300 p-8 ${className}`}
      >
        <Film className="w-8 h-8 text-slate-400 mb-3" />
        <span className="text-sm font-medium">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingPage({
  user,
  isAdmin,
  onSignIn,
  onEnterStudio,
  onSignOut,
  signingIn,
  authError,
}: LandingPageProps) {
  const [coverImgFailed, setCoverImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0F172A] flex flex-col">
      {/* Full-Viewport Editorial Studio Cover Page */}
      <section
        id="top"
        className="relative min-h-screen flex flex-col justify-between bg-[#0B0D12] text-white overflow-hidden"
      >
        {/* Full-bleed screening room photography + measured contrast scrim */}
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {!coverImgFailed ? (
            <img
              src={COVER_BACKDROP}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setCoverImgFailed(true)}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#121620] to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#090B10]/92 via-[#090B10]/74 to-[#090B10]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090B10]/90 via-transparent to-[#090B10]/55" />
        </div>

        {/* Strict 3-Zone Top Bar Contract */}
        <header className="relative z-20 border-b border-white/10">
          <div className="max-w-[1320px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
            <a
              href="#top"
              className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              Framecraft Studio
            </a>

            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
              <a
                href="#workflow"
                className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Workflow
              </a>
              <a
                href="#cuts"
                className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Recent Cuts
              </a>
              <a
                href="#revisions"
                className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Edit Revisions
              </a>
              <a
                href="#chat"
                className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                Direct Chat
              </a>
            </nav>

            <div className="shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={onEnterStudio}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-950 bg-white rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <span>Enter Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={signingIn}
                  className="inline-flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <GoogleMark />
                  <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Cover Content & Google Sign-In Entry Gate */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="max-w-[1320px] w-full mx-auto px-6 lg:px-10 py-14 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-amber-300/90 tracking-wide mb-5">
                Custom AI Video Production · Client Portal &amp; Direct Chat
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-white leading-[1.08] text-balance">
                Commission custom AI videos and direct every edit in one private studio.
              </h1>

              <p className="mt-6 text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl tracking-[0.01em]">
                Submit your video brief, review studio cuts as they are published, pin timecoded
                edit requests down to the second, and message the creator directly inside your
                project thread.
              </p>

              {/* Entry Gate Block */}
              <div className="mt-9 p-6 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 max-w-lg">
                {user ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
                      <span className="truncate">
                        Signed in as <strong className="text-white font-medium">{user.displayName || user.email}</strong>
                      </span>
                      <span className="font-mono text-amber-300 shrink-0">
                        {isAdmin ? 'Studio Creator' : 'Client'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={onEnterStudio}
                        className="inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-semibold text-slate-950 bg-white rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                      >
                        <span>Enter Studio Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={onSignIn}
                        disabled={signingIn}
                        className="px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Switch Account
                      </button>

                      <button
                        type="button"
                        onClick={() => void onSignOut()}
                        className="px-2 py-2 text-xs text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Sign in to enter Framecraft Studio
                      </p>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                        Sign in with Google to chat privately via text and voice with{' '}
                        <span className="font-mono text-white">muhammedalimdd@gmail.com</span>,
                        request AI videos, and submit timecoded edits.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={onSignIn}
                        disabled={signingIn}
                        className="inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-semibold text-slate-900 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                      >
                        <GoogleMark />
                        <span>{signingIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      </button>
                      <p className="text-[11px] text-slate-400">
                        Open to any Google account · Your requests and chats stay completely private
                      </p>
                    </div>
                  </div>
                )}

                {authError && (
                  <AuthErrorAlert
                    error={authError}
                    theme="dark"
                    onRetry={() => void onSignIn()}
                    retrying={signingIn}
                    className="mt-4"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cover Bottom Index & Scroll Cue */}
        <div className="relative z-10 border-t border-white/10 bg-black/35 backdrop-blur-xs">
          <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
              <span>
                <span className="font-mono text-slate-400 mr-1.5">01.</span>
                Structured AI Video Briefs
              </span>
              <span aria-hidden="true" className="text-white/25 hidden sm:inline">
                ·
              </span>
              <span>
                <span className="font-mono text-slate-400 mr-1.5">02.</span>
                Timecoded Edit Requests
              </span>
              <span aria-hidden="true" className="text-white/25 hidden sm:inline">
                ·
              </span>
              <span>
                <span className="font-mono text-slate-400 mr-1.5">03.</span>
                Real-Time Chat &amp; Gmail Updates
              </span>
            </div>

            <a
              href="#workflow"
              className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Explore studio overview</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* Studio Overview & 4-Step Production Workflow */}
        <section id="workflow" className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-slate-500 mb-3">Inside the Workspace</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
                Every brief, cut version, edit note, and message in one timeline.
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                Built for clear collaboration between clients and the studio creator—without losing
                prompts, reference links, or timestamp feedback across scattered threads.
              </p>
              <div className="mt-7">
                <button
                  type="button"
                  onClick={user ? onEnterStudio : onSignIn}
                  disabled={signingIn}
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{user ? 'Open Your Workspace' : 'Sign in with Google to Start'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-80 lg:h-full min-h-[320px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                <StudioImage
                  src={HERO_STUDIO_IMAGE}
                  alt="Boutique AI video editing and color grading workstation"
                  fallbackTitle="Framecraft Color & Finishing Suite"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5">
                  <p className="text-xs font-mono text-slate-200 tabular-nums">
                    Suite 01 · Generative Production &amp; Color Finishing
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 pt-10 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <p className="font-mono text-xs text-slate-500 tabular-nums">01.</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Submit Video Brief</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Choose your video type, aspect ratio, runtime, visual mood, and scene notes in a
                structured form.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-slate-500 tabular-nums">02.</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Track Production Cuts</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Follow live status updates from Submitted to In Production, Ready for Review, and
                Final Approval.
              </p>
            </div>
            <div id="revisions">
              <p className="font-mono text-xs text-slate-500 tabular-nums">03.</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Log Timecoded Edits</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Pin exact timestamps like <span className="font-mono text-slate-800">00:14</span>{' '}
                with category, priority, and clear change notes.
              </p>
            </div>
            <div id="chat">
              <p className="font-mono text-xs text-slate-500 tabular-nums">04.</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Direct Project Chat</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Discuss pacing, prompts, audio cues, and references directly inside each project in
                real time, with optional Gmail delivery.
              </p>
            </div>
          </div>
        </section>

        {/* Recent Studio Formats Showcase */}
        <section id="cuts" className="border-t border-slate-200 bg-white">
          <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Recent Studio Formats
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-xl">
                  From launch commercials to macro product films, every commission includes revision
                  tracking and a private chat room.
                </p>
              </div>
              <button
                type="button"
                onClick={user ? onEnterStudio : onSignIn}
                disabled={signingIn}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{user ? 'Go to your projects' : 'Start a new request'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <article className="group">
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                  <StudioImage
                    src={COMMERCIAL_STILL}
                    alt="AI commercial film still of silver concept coupe on coastal road"
                    fallbackTitle="Coastal Launch Commercial"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200 tabular-nums">
                      <span>Commercial Spot</span>
                      <span aria-hidden="true">·</span>
                      <span>16:9</span>
                      <span aria-hidden="true">·</span>
                      <span>30s</span>
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-white">
                      Nordic Twilight Concept Film
                    </h3>
                  </div>
                </div>
              </article>

              <article className="group">
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                  <StudioImage
                    src={PRODUCT_STILL}
                    alt="AI product launch film still of brushed steel watch on travertine stone"
                    fallbackTitle="Architectural Product Reveal"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200 tabular-nums">
                      <span>Product Reveal</span>
                      <span aria-hidden="true">·</span>
                      <span>16:9</span>
                      <span aria-hidden="true">·</span>
                      <span>15s</span>
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-white">
                      Chronograph Macro Launch Cut
                    </h3>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-14 pt-10 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg border border-slate-200 bg-[#F8F9FA] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Structured Edit Requests, Zero Lost Notes
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    Attach every visual, color, pacing, or audio change directly to the project cut
                    with a timecode and track it from Open to Resolved.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg border border-slate-200 bg-[#F8F9FA] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Private Project Chat Beside Every Cut
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    Every video request opens a live real-time conversation thread scoped strictly
                    to your project, with optional Gmail delivery to keep everyone in sync.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#F8F9FA]">
        <div className="max-w-[1320px] mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>Framecraft Studio · Custom AI Video Production Portal</span>
          <button
            type="button"
            onClick={user ? onEnterStudio : onSignIn}
            disabled={signingIn}
            className="text-slate-700 hover:text-slate-900 font-medium transition-colors cursor-pointer"
          >
            {user ? 'Enter Studio Workspace' : 'Sign in with Google'}
          </button>
        </div>
      </footer>
    </div>
  );
}
