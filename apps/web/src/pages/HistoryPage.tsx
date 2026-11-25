import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import {
  generateAiSummary,
  getHistoryDetail,
  listHistory,
  type MeetingHistoryDetail,
  type MeetingHistoryItem,
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

export function HistoryPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code');

  const [items, setItems] = useState<MeetingHistoryItem[]>([]);
  const [selected, setSelected] = useState<MeetingHistoryDetail | null>(null);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setGeneratingAi(true);
    setError(null);
    try {
      const summary = await generateAiSummary(session.access_token, selected.code);
      setSelected((prev) => (prev ? { ...prev, ai_summary: summary } : prev));
      setActivePageIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI visual notes.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const renderedPages = useMemo(() => {
    if (!selected?.ai_summary) return [];
    try {
      return renderVisualNotesPages(selected.title, selected.ai_summary);
    } catch {
      return [];
    }
  }, [selected?.title, selected?.ai_summary]);

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

  const isHost = selected?.my_role === 'host';

  return (
    <div className="settings-page">
      <div className="settings-page-head">
        <div>
          <h1 className="settings-page-title">Meeting History & Visual AI Notes</h1>
          <p className="settings-page-sub">
            Review multi-page black-background study & summary notes from every session. Hosts also
            see full participant attendance history.
          </p>
        </div>
      </div>

      <div className="history-grid">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockIcon size={18} />
              <span>Your Meetings</span>
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
                  className={`meeting-row ${selected?.code === item.code ? 'meeting-row-selected' : ''}`}
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

                  <div className="meeting-row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleInspect(item.code)}
                    >
                      <SparklesIcon size={14} />
                      <span>{item.my_role === 'host' ? 'Notes & Roster' : 'Visual Notes'}</span>
                    </button>
                    {item.status === 'active' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
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

        <div className="right-stack">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SparklesIcon size={18} />
                <span>AI Visual Summary Notes</span>
              </h2>
              {selected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={generatingAi}
                    onClick={() => void handleGenerateAiNotes()}
                  >
                    <SparklesIcon size={14} />
                    <span>
                      {generatingAi
                        ? 'Analyzing...'
                        : selected.ai_summary
                          ? 'Regenerate'
                          : 'Generate Notes'}
                    </span>
                  </button>
                  {currentPage && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={
                        renderedPages.length > 1
                          ? handleDownloadAllPages
                          : handleDownloadCurrentPage
                      }
                    >
                      <DownloadIcon size={14} />
                      <span>
                        {renderedPages.length > 1
                          ? `Download All (${renderedPages.length} PNGs)`
                          : 'Download Image (PNG)'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {detailLoading ? (
              <p className="status-item-desc">Loading meeting notes...</p>
            ) : !selected ? (
              <div className="empty-state">
                Select any meeting on the left to inspect and download its multi-page
                black-background study notes.
              </div>
            ) : selected.ai_summary && currentPage ? (
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
                  {renderedPages.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleDownloadCurrentPage}
                    >
                      <DownloadIcon size={14} />
                      <span>Download Page {currentPage.pageNumber} (.png)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
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
                        : 'Download High-Res Notes Image (.png)'}
                    </span>
                  </button>
                </div>
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
    </div>
  );
}
