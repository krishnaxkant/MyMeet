import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';
import { ShieldIcon } from './Icons';
import { ThemeToggle } from './ThemeToggle';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      <div className="auth-topbar">
        <ThemeToggle />
      </div>

      <aside className="auth-showcase" aria-hidden="true">
        <div className="auth-showcase-brand">
          <BrandLogo size="lg" showTagline inverted />
        </div>

        <div className="auth-showcase-body">
          <span className="auth-showcase-eyebrow">
            <ShieldIcon size={14} />
            <span>HD Video · Web & Android</span>
          </span>
          <h2 className="auth-showcase-title">
            Clear conversations, without the friction.
          </h2>
          <p className="auth-showcase-sub">
            Start instant rooms, share screen, run waiting rooms, and chat in real time across
            desktop browsers and Android phones.
          </p>

          <div className="mock-stage">
            <div className="mock-tiles">
              <div className="mock-tile mock-tile-speaking">
                <div className="mock-avatar">AK</div>
                <span className="mock-tile-label">Aarav · Speaking</span>
              </div>
              <div className="mock-tile">
                <div className="mock-avatar mock-avatar-alt">PR</div>
                <span className="mock-tile-label">Priya · Host</span>
              </div>
            </div>
            <div className="mock-dock">
              <span className="mock-pill" />
              <span className="mock-pill" />
              <span className="mock-pill" />
              <span className="mock-pill mock-pill-end" />
            </div>
          </div>
        </div>

        <div className="auth-showcase-footer">
          <span>Encrypted meeting codes</span>
          <span>·</span>
          <span>LiveKit SFU media</span>
          <span>·</span>
          <span>Light & Dark studio</span>
        </div>
      </aside>

      <main className="auth-form-pane">{children}</main>
    </div>
  );
}
