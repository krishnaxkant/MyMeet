import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  RefreshIcon,
  SparklesIcon,
  UsersIcon,
} from '../components/Icons';
import { SessionMcqModal } from '../components/SessionMcqModal';
import { UpgradeModal } from '../components/UpgradeModal';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import {
  generateAiSummary,
  getHistoryDetail,
  getOrGenerateMeetingMcqs,
  listHistory,
  upgradeMeetingProNotes,
  type MeetingHistoryDetail,
  type MeetingHistoryItem,
  type MeetingMcqQuiz,
  type MeetingProNotes,
  type UserSubscriptionStatus,
} from '../services/api';
import {
  downloadAllVisualNotesPngs,
  downloadVisualNotesPagePng,
  renderVisualNotesPages,
} from '../utils/visualNotesRenderer';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function readLocalRegenCount(code: string): number {
  try {
    const raw = window.localStorage.getItem(`mymeet_regen_${code}`);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveLocalRegenCount(code: string, count: number): void {
  try {
    window.localStorage.setItem(`mymeet_regen_${code}`, String(count));
  } catch {
    // Ignore storage quota errors
  }
}

export function HistoryPage() {
  const { session, user, profile } = useAuth();
  const { subscription, setSubscription } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code');

  const [items, setItems] = useState<MeetingHistoryItem[]>([]);
  const [selected, setSelected] = useState<MeetingHistoryDetail | null>(null);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [upgradingPro, setUpgradingPro] = useState(false);
  const [loadingMcq, setLoadingMcq] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<MeetingMcqQuiz | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeForMcq, setUpgradeForMcq] = useState(false);
  const [localRegenCounts, setLocalRegenCounts] = useState<Record<string, number>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoProTriggeredRef = useRef<Set<string>>(new Set());

  const loadHistory = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listHistory(session.access_token);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting history.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleInspect = useCallback(
    async (code: string) => {
      if (!session?.access_token) return;
      setDetailLoading(true);
      setError(null);
      setLightboxOpen(false);
      setActivePageIdx(0);
      try {
        const detail = await getHistoryDetail(session.access_token, code);
        setSelected(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load meeting notes.');
      } finally {
        setDetailLoading(false);
      }
    },
    [session?.access_token],
  );

  // Auto-open a meeting if navigated from Home via /history?code=...
  useEffect(() => {
    if (initialCode && session?.access_token) {
      void handleInspect(initialCode);
    }
  }, [initialCode, session?.access_token, handleInspect]);

  const handleGenerateAiNotes = async () => {
    if (!session?.access_token || !selected) return;
    const hadSummary = Boolean(selected.ai_summary);
    const currentUsed = Math.max(
      selected.ai_summary?.sources_summary?.regenerate_count ?? 0,
      localRegenCounts[selected.code] ?? readLocalRegenCount(selected.code),
    );
    if (hadSummary && !subscription?.is_unlimited && currentUsed >= 2) {
      setUpgradeForMcq(false);
      setUpgradeOpen(true);
      return;
    }

    setGeneratingAi(true);
    setError(null);
    try {
      const summary = await generateAiSummary(session.access_token, selected.code);
      const nextCount = hadSummary
        ? Math.max(summary.sources_summary?.regenerate_count ?? 0, currentUsed + 1)
        : (summary.sources_summary?.regenerate_count ?? 0);
      if (hadSummary) {
        saveLocalRegenCount(selected.code, nextCount);
        setLocalRegenCounts((prev) => ({ ...prev, [selected.code]: nextCount }));
      }
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              ai_summary: {
                ...summary,
                sources_summary: {
                  ...(summary.sources_summary ?? {}),
                  regenerate_count: nextCount,
                },
              },
            }
          : prev,
      );
      setActivePageIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI visual notes.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleUpgradeToProNotes = async (overrideSub?: UserSubscriptionStatus) => {
    if (!session?.access_token || !selected) return;
    const sub = overrideSub ?? subscription;
    const canUnlockNow = Boolean(sub?.is_pro && (sub.is_unlimited || sub.credits_remaining > 0));
    if (!canUnlockNow) {
      setUpgradeForMcq(false);
      setUpgradeOpen(true);
      return;
    }

    setUpgradingPro(true);
    setError(null);
    try {
      const res = await upgradeMeetingProNotes(session.access_token, selected.code);
      setSelected((prev) => (prev ? { ...prev, pro_notes: res.pro_notes } : prev));
      setSubscription(res.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate Pro Master Notes.');
    } finally {
      setUpgradingPro(false);
    }
  };

  const handleOpenMcqTest = async (overrideSub?: UserSubscriptionStatus) => {
    if (!session?.access_token || !selected) return;
    const sub = overrideSub ?? subscription;
    if (!sub?.mcq_enabled) {
      setUpgradeForMcq(true);
      setUpgradeOpen(true);
      return;
    }

    setLoadingMcq(true);
    setError(null);
    try {
      const quiz = await getOrGenerateMeetingMcqs(session.access_token, selected.code);
      setActiveQuiz(quiz);
      setQuizOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate session MCQ test.');
    } finally {
      setLoadingMcq(false);
    }
  };

  const handleExportProPdf = (title: string, pro: MeetingProNotes) => {
    const win = window.open('', '_blank', 'width=960,height=900');
    if (!win) return;
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sectionsHtml = pro.deep_sections
      .map(
        (sec, idx) => `
        <div class="sec">
          <h3>${idx + 1}. ${esc(sec.title)} <span class="tag">${esc(sec.kind.toUpperCase())}</span></h3>
          <p>${esc(sec.explanation)}</p>
          ${sec.code_or_formula ? `<pre><code>${esc(sec.code_or_formula)}</code></pre>` : ''}
          ${sec.bullets?.length ? `<ul>${sec.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
          ${sec.worked_example ? `<div class="example"><strong>Worked Example:</strong> ${esc(sec.worked_example)}</div>` : ''}
        </div>`,
      )
      .join('');
    const tableHtml = pro.comparison_table
      ? `<div class="sec"><h3>${esc(pro.comparison_table.title || 'Comparison Matrix')}</h3>
          <table><thead><tr>${pro.comparison_table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${pro.comparison_table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '';
    const trapsHtml = pro.exam_traps.length
      ? `<div class="sec traps"><h3>⚡ Common Exam & Interview Traps</h3>${pro.exam_traps
          .map(
            (t) =>
              `<div class="trap-row"><strong>Trap:</strong> ${esc(t.trap)}<br/><strong>Fix:</strong> ${esc(t.fix)}</div>`,
          )
          .join('')}</div>`
      : '';
    const cheatHtml = pro.cheat_sheet.length
      ? `<div class="sec cheat"><h3>📌 1-Minute Rapid Revision Cheat Sheet</h3><ul>${pro.cheat_sheet
          .map((c) => `<li>${esc(c)}</li>`)
          .join('')}</ul></div>`
      : '';

    win.document.write(`<!doctype html><html><head><title>${esc(title)} — MyMeet Pro Notes</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:32px auto;padding:0 24px;color:#0f172a;line-height:1.55;}
      .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#4f46e5;color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em;}
      h1{margin:10px 0 6px;font-size:28px;} .overview{background:#f8fafc;border-left:4px solid #4f46e5;padding:12px 16px;border-radius:8px;margin:16px 0;}
      .sec{margin:20px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid;}
      .sec h3{margin:0 0 8px;font-size:17px;} .tag{font-size:10px;background:#eef2ff;color:#4338ca;padding:2px 8px;border-radius:999px;margin-left:6px;}
      pre{background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;overflow-x:auto;font-size:13px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13.5px;} th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;} th{background:#f1f5f9;}
      .example{margin-top:10px;padding:10px 12px;background:#ecfdf5;border-radius:8px;font-size:13.5px;}
      .traps{border-color:#fde68a;background:#fffbeb;} .trap-row{margin:8px 0;padding-bottom:8px;border-bottom:1px dashed #fcd34d;}
      .cheat{border-color:#c7d2fe;background:#eef2ff;} .footer{margin-top:28px;font-size:11px;color:#64748b;text-align:center;}
    </style></head><body>
      <span class="badge">MYMEET PRO · MASTER NOTES</span>
      <h1>${esc(title)}</h1>
      <div class="overview">${esc(pro.pro_overview)}</div>
      ${sectionsHtml}${tableHtml}${trapsHtml}${cheatHtml}
      <div class="footer">Generated by MYMEET PRO · ${esc(pro.environment_label)}</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`);
    win.document.close();
  };

  const hasImportantNotes = Boolean(
    selected?.ai_summary &&
      selected.ai_summary.environment_type !== 'no_important_content' &&
      ((selected.ai_summary.sources_summary?.visual_flow?.length ?? 0) > 0 ||
        (selected.ai_summary.key_points?.length ?? 0) > 0),
  );

  const renderedPages = useMemo(() => {
    if (!selected?.ai_summary || !hasImportantNotes) return [];
    try {
      return renderVisualNotesPages(selected.title, selected.ai_summary);
    } catch {
      return [];
    }
  }, [selected?.title, selected?.ai_summary, hasImportantNotes]);

  const currentPage = renderedPages[activePageIdx] ?? renderedPages[0] ?? null;

  // Keyboard Left/Right/Escape navigation inside fullscreen lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setActivePageIdx((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        setActivePageIdx((p) => Math.min(renderedPages.length - 1, p + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, renderedPages.length]);

  const handleDownloadCurrentPage = () => {
    if (!selected || !currentPage) return;
    downloadVisualNotesPagePng(selected.title, currentPage);
  };

  const handleDownloadAllPages = () => {
    if (!selected || renderedPages.length === 0) return;
    downloadAllVisualNotesPngs(selected.title, renderedPages);
  };

  const handleDownloadVisualPdf = () => {
    if (!selected || renderedPages.length === 0) return;
    const win = window.open('', '_blank', 'width=960,height=900');
    if (!win) return;
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pagesHtml = renderedPages
      .map(
        (pg) =>
          `<div class="pdf-page"><img src="${pg.dataUrl}" alt="${esc(selected.title)} Page ${pg.pageNumber}" /></div>`,
      )
      .join('');
    win.document.write(`<!doctype html><html><head><title>${esc(selected.title)} — MyMeet AI Notes</title><style>
      @page { margin: 0; }
      body { margin: 0; padding: 0; background: #000000; }
      .pdf-page { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; background: #000000; }
      .pdf-page:last-child { page-break-after: auto; }
      img { width: 100%; max-width: 100%; height: auto; display: block; }
    </style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();},250);}</script></body></html>`);
    win.document.close();
  };

  const isHost = selected?.my_role === 'host';
  const hideBasicNotes = Boolean(
    selected &&
      (selected.pro_notes || (subscription?.is_unlimited && hasImportantNotes)),
  );

  // For Unlimited Monthly/Yearly Pro subscribers, automatically build Pro Master Notes
  // so they NEVER see Basic Free Notes clutter!
  useEffect(() => {
    if (!session?.access_token || !selected || !subscription?.is_unlimited) return;
    if (!hasImportantNotes || selected.pro_notes || upgradingPro) return;
    if (autoProTriggeredRef.current.has(selected.code)) return;

    autoProTriggeredRef.current.add(selected.code);
    setUpgradingPro(true);
    setError(null);
    void upgradeMeetingProNotes(session.access_token, selected.code)
      .then((res) => {
        setSelected((prev) =>
          prev && prev.code === selected.code ? { ...prev, pro_notes: res.pro_notes } : prev,
        );
        setSubscription(res.subscription);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to build Pro Master Notes.');
      })
      .finally(() => setUpgradingPro(false));
  }, [session?.access_token, selected, subscription?.is_unlimited, hasImportantNotes, upgradingPro]);

  const effectiveRegenCount = selected
    ? Math.max(
        selected.ai_summary?.sources_summary?.regenerate_count ?? 0,
        localRegenCounts[selected.code] ?? readLocalRegenCount(selected.code),
      )
    : 0;
  const regenerateLimitReached = Boolean(
    selected?.ai_summary && !subscription?.is_unlimited && effectiveRegenCount >= 2,
  );

  return (
    <div className="settings-page">
      {!selected && !detailLoading ? (
        <>
          <div className="settings-page-head">
            <div>
              <h1 className="settings-page-title">Meeting History &amp; AI Notes</h1>
              <p className="settings-page-sub">
                Select any past session to open its full-screen visual notes, PDF export, and
                session MCQs.
              </p>
            </div>
          </div>

          <section className="card history-list-only-card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockIcon size={18} />
                <span>Your Meetings ({items.length})</span>
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void loadHistory()}
                disabled={loading}
              >
                <RefreshIcon size={14} />
                <span>{loading ? 'Loading...' : 'Refresh'}</span>
              </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {items.length === 0 ? (
              <div className="empty-state">
                {loading
                  ? 'Loading your past meetings...'
                  : 'No meeting history yet. Meetings you host or join will appear here.'}
              </div>
            ) : (
              <div className="meeting-list">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="meeting-row meeting-row-clickable"
                    onClick={() => void handleInspect(item.code)}
                  >
                    <div className="meeting-row-main">
                      <div className="meeting-row-title">
                        <span>{item.title}</span>
                        <span
                          className={`badge ${
                            item.status === 'active' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.my_role === 'host' && <span className="badge badge-neutral">Host</span>}
                      </div>
                      <div className="meeting-row-meta">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{formatDuration(item.duration_seconds)}</span>
                      </div>
                    </div>

                    <div className="meeting-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void handleInspect(item.code)}
                      >
                        <SparklesIcon size={14} />
                        <span>{item.my_role === 'host' ? 'Open Notes & Roster' : 'Visual Notes'}</span>
                      </button>
                      {item.status === 'active' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/meet/${item.code}`)}
                        >
                          Rejoin
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* Dedicated Full-Screen Notes Reader View (Zero list clutter!) */
        <div className="notes-fullscreen-shell">
          <div className="notes-reader-topbar">
            <div className="notes-reader-left">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelected(null);
                  setError(null);
                  if (initialCode) navigate('/history', { replace: true });
                }}
              >
                <ChevronLeftIcon size={15} />
                <span>Back to Meetings</span>
              </button>
              {selected && (
                <div className="notes-reader-heading">
                  <h1 className="notes-reader-title">{selected.title}</h1>
                  <span className="notes-reader-meta">
                    {new Date(selected.created_at).toLocaleDateString()} ·{' '}
                    {formatDuration(selected.duration_seconds)}
                  </span>
                </div>
              )}
            </div>

            {selected && !hideBasicNotes && (
              <div className="notes-reader-actions">
                <button
                  type="button"
                  className={`btn btn-sm ${regenerateLimitReached ? 'btn-pro-gold' : 'btn-secondary'}`}
                  disabled={generatingAi}
                  title={
                    regenerateLimitReached
                      ? '2/2 free regenerates used — Upgrade to Pro Monthly or Yearly for unlimited regenerations'
                      : undefined
                  }
                  onClick={() => {
                    if (regenerateLimitReached) {
                      setUpgradeForMcq(false);
                      setUpgradeOpen(true);
                      return;
                    }
                    void handleGenerateAiNotes();
                  }}
                >
                  <SparklesIcon size={14} />
                  <span>
                    {generatingAi
                      ? 'Analyzing...'
                      : regenerateLimitReached
                        ? 'Pro'
                        : selected.ai_summary
                          ? subscription?.is_unlimited
                            ? 'Regenerate'
                            : `Regenerate (${2 - effectiveRegenCount} left)`
                          : 'Generate Notes'}
                  </span>
                </button>
                {currentPage && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleDownloadVisualPdf}
                    >
                      <DownloadIcon size={14} />
                      <span>Download PDF</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={
                        renderedPages.length > 1
                          ? handleDownloadAllPages
                          : handleDownloadCurrentPage
                      }
                    >
                      <DownloadIcon size={14} />
                      <span>
                        {renderedPages.length > 1
                          ? `PNG (${renderedPages.length})`
                          : 'PNG'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="notes-reader-stack">
            {/* Basic Free AI Visual Summary — hidden whenever user already has Pro Master Notes or an Unlimited Pro subscription */}
            {!hideBasicNotes && (
            <section className="card notes-reader-card">
              {detailLoading ? (
                <div className="empty-state">Loading meeting visual notes...</div>
              ) : !selected ? null : selected.ai_summary && currentPage ? (
              <div className="visual-notes-panel">
                <div className="visual-notes-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-success">
                      <SparklesIcon size={12} /> {selected.ai_summary.environment_label}
                    </span>
                    <span className="status-item-desc">
                      {renderedPages.length} {renderedPages.length === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setLightboxOpen(true)}
                  >
                    Expand Full Screen
                  </button>
                </div>

                {/* Multi-page tabs when summary spans 2+ pages */}
                {renderedPages.length > 1 && (
                  <div className="page-pills-bar">
                    <button
                      type="button"
                      className="nav-arrow-btn nav-arrow-prev"
                      disabled={activePageIdx === 0}
                      onClick={() => setActivePageIdx((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeftIcon size={15} />
                      <span>Prev</span>
                    </button>
                    <div className="page-pills-list">
                      {renderedPages.map((pg, idx) => (
                        <button
                          key={pg.pageNumber}
                          type="button"
                          className={`page-pill ${idx === activePageIdx ? 'active' : ''}`}
                          onClick={() => setActivePageIdx(idx)}
                        >
                          Page {pg.pageNumber}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="nav-arrow-btn nav-arrow-next"
                      disabled={activePageIdx >= renderedPages.length - 1}
                      onClick={() =>
                        setActivePageIdx((p) => Math.min(renderedPages.length - 1, p + 1))
                      }
                    >
                      <span>Next</span>
                      <ChevronRightIcon size={15} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="visual-notes-preview-btn"
                  onClick={() => setLightboxOpen(true)}
                  title="Click to inspect full-resolution visual notes"
                >
                  <img
                    src={currentPage.dataUrl}
                    alt={`${selected.title} — Study Notes Page ${currentPage.pageNumber}`}
                    className="visual-notes-preview-img"
                  />
                </button>

                <div className="visual-notes-footer-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleDownloadVisualPdf}
                  >
                    <DownloadIcon size={14} />
                    <span>Download Notes PDF</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={
                      renderedPages.length > 1
                        ? handleDownloadAllPages
                        : handleDownloadCurrentPage
                    }
                  >
                    <DownloadIcon size={14} />
                    <span>
                      {renderedPages.length > 1
                        ? `Download All ${renderedPages.length} Pages (.png)`
                        : 'Download Image (.png)'}
                    </span>
                  </button>
                </div>

                {/* Get Pro Notes at ₹9 Only CTA Banner at the end of Notes */}
                {!selected.pro_notes && (
                  <div className="pro-cta-banner">
                    <div className="pro-cta-copy">
                      <span className="pro-pill-badge">
                        <SparklesIcon size={12} /> MYMEET PRO NOTES
                      </span>
                      <h3>Get Pro Notes at ₹9 Only</h3>
                      <p>
                        Unlock deep code snippets &amp; step-by-step derivations, comparison tables,
                        exam &amp; interview traps, 1-min cheat sheet, HD PDF &amp; 20-MCQ session
                        practice tests.
                      </p>
                    </div>
                    <div className="pro-cta-actions">
                      {subscription?.is_pro && subscription.credits_remaining > 0 && (
                        <button
                          type="button"
                          className="btn btn-pro-gold"
                          disabled={upgradingPro}
                          onClick={() => void handleUpgradeToProNotes()}
                        >
                          <SparklesIcon size={15} />
                          <span>
                            {upgradingPro
                              ? 'Building Pro Notes...'
                              : `Upgrade with 1 Credit (${subscription.credits_remaining} left)`}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={`btn ${
                          subscription?.is_pro && subscription.credits_remaining > 0
                            ? 'btn-secondary btn-sm'
                            : 'btn-pro-gold'
                        }`}
                        onClick={() => {
                          setUpgradeForMcq(false);
                          setUpgradeOpen(true);
                        }}
                      >
                        <SparklesIcon size={15} />
                        <span>
                          {subscription?.is_pro && subscription.credits_remaining > 0
                            ? 'View All Pro Offers (₹9 · ₹49 · ₹349 · ₹899)'
                            : 'Get Pro Notes at ₹9 Only · See All Offers'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : selected.ai_summary && !hasImportantNotes ? (
              <div className="empty-state">
                <div style={{ marginBottom: 10 }}>
                  <span className="badge badge-neutral">
                    <SparklesIcon size={12} /> {selected.ai_summary.environment_label || 'Casual Session · No Study Notes'}
                  </span>
                </div>
                <p style={{ marginBottom: 14 }}>
                  {selected.ai_summary.overview ||
                    'No important study or meeting notes were detected in this session. Casual conversation and greetings were automatically filtered out.'}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={generatingAi}
                  onClick={() => void handleGenerateAiNotes()}
                >
                  <SparklesIcon size={14} />
                  <span>{generatingAi ? 'Re-checking...' : 'Re-analyze Session'}</span>
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <p style={{ marginBottom: 14 }}>
                  No visual notes have been generated for <strong>{selected.title}</strong> yet.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={generatingAi}
                  onClick={() => void handleGenerateAiNotes()}
                >
                  <SparklesIcon size={15} />
                  <span>{generatingAi ? 'Analyzing Discussion...' : 'Generate Visual Notes'}</span>
                </button>
              </div>
            )}
          </section>
          )}

          {/* Auto-building Pro Master Notes state for Unlimited subscribers */}
          {selected && hideBasicNotes && !selected.pro_notes && (
            <section className="card pro-notes-card" style={{ textAlign: 'center', padding: 32 }}>
              <span className="pro-pill-badge" style={{ marginBottom: 12 }}>
                <SparklesIcon size={12} /> MYMEET PRO · MASTER NOTES
              </span>
              <h2 style={{ margin: '8px 0 6px', fontSize: 19, fontWeight: 800 }}>
                {upgradingPro
                  ? `Building Pro Master Notes for "${selected.title}"...`
                  : `Pro Master Notes Ready for "${selected.title}"`}
              </h2>
              <p className="status-item-desc" style={{ marginBottom: 16 }}>
                Crafting deep explanations, code / derivations, comparison table, exam traps &amp;
                1-minute cheat sheet.
              </p>
              {!upgradingPro && (
                <button
                  type="button"
                  className="btn btn-pro-gold"
                  onClick={() => void handleUpgradeToProNotes()}
                >
                  <SparklesIcon size={15} />
                  <span>Generate Pro Master Notes</span>
                </button>
              )}
            </section>
          )}

          {/* MYMEET PRO Master Notes Card (when unlocked for this meeting) */}
          {selected?.pro_notes && (
            <section className="card pro-notes-card">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="pro-pill-badge">
                    <SparklesIcon size={12} /> MYMEET PRO · MASTER NOTES
                  </span>
                  <span className="status-item-desc">{selected.pro_notes.environment_label}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-pro-gold btn-sm"
                  onClick={() => handleExportProPdf(selected.title, selected.pro_notes!)}
                >
                  <DownloadIcon size={14} />
                  <span>Print / Save HD PDF</span>
                </button>
              </div>

              <div className="pro-overview-box">{selected.pro_notes.pro_overview}</div>

              <div className="pro-sections-stack">
                {selected.pro_notes.deep_sections.map((sec, idx) => (
                  <div key={`${sec.title}-${idx}`} className="pro-deep-section">
                    <div className="pro-deep-section-head">
                      <strong>
                        {idx + 1}. {sec.title}
                      </strong>
                      <span className="badge badge-neutral">{sec.kind.toUpperCase()}</span>
                    </div>
                    <p className="pro-deep-text">{sec.explanation}</p>
                    {sec.code_or_formula && (
                      <pre className="pro-code-block">
                        <code>{sec.code_or_formula}</code>
                      </pre>
                    )}
                    {sec.bullets && sec.bullets.length > 0 && (
                      <ul className="pro-bullet-list">
                        {sec.bullets.map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {sec.worked_example && (
                      <div className="pro-worked-example">
                        <strong>Worked Example:</strong> {sec.worked_example}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selected.pro_notes.comparison_table && (
                <div className="pro-table-wrap">
                  <h3 className="pro-subhead">
                    {selected.pro_notes.comparison_table.title || 'Comparison Matrix'}
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="pro-comparison-table">
                      <thead>
                        <tr>
                          {selected.pro_notes.comparison_table.headers.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.pro_notes.comparison_table.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selected.pro_notes.exam_traps.length > 0 && (
                <div className="pro-traps-box">
                  <h3 className="pro-subhead">⚡ Common Exam &amp; Interview Traps</h3>
                  {selected.pro_notes.exam_traps.map((t, ti) => (
                    <div key={ti} className="pro-trap-item">
                      <div>
                        <strong>Trap:</strong> {t.trap}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <strong>Right Approach:</strong> {t.fix}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected.pro_notes.cheat_sheet.length > 0 && (
                <div className="pro-cheatsheet-box">
                  <h3 className="pro-subhead">📌 1-Minute Rapid Revision Cheat Sheet</h3>
                  <ul className="pro-bullet-list">
                    {selected.pro_notes.cheat_sheet.map((c, ci) => (
                      <li key={ci}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Session MCQ Practice Test Card (Included in ₹349/mo & ₹899/yr) */}
          {selected && hasImportantNotes && (
            <section className="card pro-mcq-cta-card">
              <div className="pro-cta-copy">
                <span className="pro-pill-badge">
                  <SparklesIcon size={12} /> TODAY&apos;S SESSION MCQ TEST
                </span>
                <h3 style={{ margin: '8px 0 4px', fontSize: 17 }}>
                  Polish Every Concept Studied in &ldquo;{selected.title}&rdquo;
                </h3>
                <p className="status-item-desc" style={{ margin: 0 }}>
                  {subscription?.mcq_enabled
                    ? 'Attempt 20 high-level MCQs crafted strictly from today’s session topics with instant grading & detailed concept explanations.'
                    : 'Attempt 20 exam-level MCQs for every session — included in Pro Monthly (₹349/mo) & Pro Yearly (₹899/yr).'}
                </p>
              </div>
              <button
                type="button"
                className={`btn ${subscription?.mcq_enabled ? 'btn-primary' : 'btn-pro-gold'}`}
                disabled={loadingMcq}
                onClick={() => void handleOpenMcqTest()}
              >
                <SparklesIcon size={15} />
                <span>
                  {loadingMcq
                    ? 'Preparing 20 MCQs...'
                    : subscription?.mcq_enabled
                      ? 'Take 20-MCQ Test Now →'
                      : 'Unlock 20-MCQ Tests · ₹349/mo'}
                </span>
              </button>
            </section>
          )}

          {/* HOST-ONLY Meeting Participants History */}
          {selected && isHost && (
            <section className="card">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UsersIcon size={17} />
                  <span>Meeting Participants History ({selected.participants.length})</span>
                </h2>
                <span className="badge badge-neutral">Host Only</span>
              </div>

              {selected.participants.length === 0 ? (
                <p className="status-item-desc">No participants recorded for this meeting.</p>
              ) : (
                <div className="roster-list">
                  {selected.participants.map((p) => (
                    <div key={p.id} className="roster-row">
                      <div className="roster-info">
                        <div className="roster-name">{p.full_name || p.email}</div>
                        <div className="roster-sub">
                          Joined {formatExactTime(p.joined_at)}
                          {p.left_at ? ` · Left ${formatExactTime(p.left_at)}` : ''}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          p.role === 'host' ? 'badge-success' : 'badge-neutral'
                        }`}
                      >
                        {p.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          </div>
        </div>
      )}

      {lightboxOpen && currentPage && selected && (
        <div
          className="visual-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="visual-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="visual-lightbox-bar">
              <strong style={{ color: '#ffffff' }}>
                {selected.title} — Page {currentPage.pageNumber} of {currentPage.totalPages}
              </strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {renderedPages.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="nav-arrow-btn nav-arrow-prev"
                      disabled={activePageIdx === 0}
                      onClick={() => setActivePageIdx((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeftIcon size={15} />
                      <span>Prev</span>
                    </button>
                    <button
                      type="button"
                      className="nav-arrow-btn nav-arrow-next"
                      disabled={activePageIdx >= renderedPages.length - 1}
                      onClick={() =>
                        setActivePageIdx((p) => Math.min(renderedPages.length - 1, p + 1))
                      }
                    >
                      <span>Next</span>
                      <ChevronRightIcon size={15} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleDownloadCurrentPage}
                >
                  <DownloadIcon size={14} />
                  <span>Download Page {currentPage.pageNumber}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setLightboxOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="visual-lightbox-scroll">
              <img
                src={currentPage.dataUrl}
                alt={`${selected.title} — Page ${currentPage.pageNumber}`}
                className="visual-lightbox-img"
              />
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        accessToken={session?.access_token ?? null}
        userEmail={profile?.email ?? user?.email ?? ''}
        userName={profile?.full_name ?? ''}
        meetingCode={selected?.code}
        highlightMcq={upgradeForMcq}
        onClose={() => setUpgradeOpen(false)}
        onActivated={(nextSub, planCode) => {
          setSubscription(nextSub);
          if (upgradeForMcq && nextSub.mcq_enabled) {
            void handleOpenMcqTest(nextSub);
          } else if (
            selected &&
            !selected.pro_notes &&
            (planCode === 'single_9' || planCode === 'pack_49' || nextSub.is_unlimited)
          ) {
            void handleUpgradeToProNotes(nextSub);
          }
        }}
      />

      <SessionMcqModal
        open={quizOpen}
        quiz={activeQuiz}
        meetingTitle={selected?.title ?? 'Session'}
        onClose={() => setQuizOpen(false)}
      />
    </div>
  );
}
