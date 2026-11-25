import { useState } from 'react';
import { API_BASE_URL, type HealthResponse } from '../services/api';
import { RefreshIcon } from './Icons';

interface StatusCardProps {
  data: HealthResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function StatusCard({ data, loading, error, onRefresh }: StatusCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const backendBadge = loading
    ? { label: 'Checking', className: 'badge badge-warning' }
    : data
      ? { label: 'Online', className: 'badge badge-success' }
      : { label: 'Offline', className: 'badge badge-danger' };

  const supabaseStatus = data?.supabase.status;
  const supabaseBadge = loading
    ? { label: 'Checking', className: 'badge badge-warning' }
    : !data
      ? { label: 'Waiting', className: 'badge badge-warning' }
      : supabaseStatus === 'connected'
        ? { label: 'Connected', className: 'badge badge-success' }
        : supabaseStatus === 'not_configured'
          ? { label: 'Needs Keys', className: 'badge badge-warning' }
          : { label: 'Error', className: 'badge badge-danger' };

  const livekitReady = data?.livekit?.status === 'configured';

  return (
    <section className="card" aria-label="System Status">
      <div className="card-header" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="card-title">System Status</h2>
          <p className="status-item-desc">Live connection diagnostics</p>
        </div>
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setShowDetails((prev) => !prev)}
          >
            {showDetails ? 'Hide details' : 'Details'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshIcon size={14} />
            <span>{loading ? 'Checking' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="status-compact-grid">
        <div className="status-compact-pill">
          <span className="status-compact-name">Backend API</span>
          <span className={backendBadge.className}>{backendBadge.label}</span>
        </div>
        <div className="status-compact-pill">
          <span className="status-compact-name">Supabase</span>
          <span className={supabaseBadge.className}>{supabaseBadge.label}</span>
        </div>
        <div className="status-compact-pill">
          <span className="status-compact-name">LiveKit SFU</span>
          <span className={livekitReady ? 'badge badge-success' : 'badge badge-warning'}>
            {!data ? 'Waiting' : livekitReady ? 'Ready' : 'Setup'}
          </span>
        </div>
      </div>

      {showDetails && (
        <div className="status-list" style={{ marginTop: 12 }}>
          <div className="status-item">
            <div>
              <div className="status-item-label">Endpoint</div>
              <div className="status-item-desc">
                {error
                  ? `${API_BASE_URL} — ${error}`
                  : data
                    ? `${API_BASE_URL} · v${data.version} · uptime ${data.uptimeSeconds}s`
                    : API_BASE_URL}
              </div>
            </div>
          </div>
          <div className="status-item">
            <div>
              <div className="status-item-label">Services</div>
              <div className="status-item-desc">
                {data?.supabase.message}
                {data?.livekit ? ` · ${data.livekit.message}` : ''}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
