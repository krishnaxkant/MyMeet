import { API_BASE_URL, type HealthResponse } from '../services/api';
import { RefreshIcon } from './Icons';

interface StatusCardProps {
  data: HealthResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function StatusCard({ data, loading, error, onRefresh }: StatusCardProps) {
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

  return (
    <section className="card" aria-label="System Health">
      <div className="card-header">
        <h2 className="card-title">System Health</h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshIcon size={14} />
          <span>{loading ? 'Checking...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="status-list">
        <div className="status-item">
          <div>
            <div className="status-item-label">Meet Backend API</div>
            <div className="status-item-desc">
              {error
                ? `${API_BASE_URL} — ${error}`
                : data
                  ? `${API_BASE_URL} · v${data.version} · uptime ${data.uptimeSeconds}s`
                  : `Connecting to ${API_BASE_URL}...`}
            </div>
          </div>
          <span className={backendBadge.className}>{backendBadge.label}</span>
        </div>

        <div className="status-item">
          <div>
            <div className="status-item-label">Supabase (PostgreSQL + Auth)</div>
            <div className="status-item-desc">
              {data
                ? data.supabase.message
                : error
                  ? 'Start the backend server to check Supabase status.'
                  : 'Verifying connection...'}
            </div>
          </div>
          <span className={supabaseBadge.className}>{supabaseBadge.label}</span>
        </div>
      </div>

      <div className="meta-footer">
        <span>Environment: {data?.environment ?? 'unknown'}</span>
        <span>
          {data?.timestamp ? `Checked ${new Date(data.timestamp).toLocaleTimeString()}` : 'Not checked'}
        </span>
      </div>
    </section>
  );
}
