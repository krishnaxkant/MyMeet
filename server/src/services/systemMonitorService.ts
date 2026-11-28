import fs from 'node:fs';
import os from 'node:os';
import { env } from '../config/env.js';
import { registerEmailSentHook, sendFounderAlertEmail } from './emailService.js';

type AlertKey =
  | 'high_ram'
  | 'high_cpu'
  | 'high_disk'
  | 'livekit_down'
  | 'gemini_rate_limit'
  | 'email_quota_high'
  | 'traffic_surge';

const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // Max 1 email per alert type every 4 hours
const lastAlertSentAt = new Map<AlertKey, number>();

// Rolling telemetry counters (in-memory, zero DB load)
const requestTimestamps: number[] = [];
const gemini429Timestamps: number[] = [];
let emailCountDay = new Date().toISOString().slice(0, 10);
let emailsSentToday = 0;
let livekitConsecutiveFails = 0;
let lastLivekitLocalOk: boolean | null = null;
let monitorStarted = false;

function pruneOlderThan(arr: number[], windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  while (arr.length > 0 && arr[0] < cutoff) {
    arr.shift();
  }
}

function getDiskUsedPct(): number | null {
  try {
    const targetPath = process.platform === 'win32' ? process.cwd() : '/';
    const stat = fs.statfsSync(targetPath);
    if (!stat.blocks || stat.blocks <= 0) return null;
    const used = stat.blocks - stat.bfree;
    return Math.round((used / stat.blocks) * 100);
  } catch {
    return null;
  }
}

function getRamUsedPct(): number {
  const total = os.totalmem();
  const free = os.freemem();
  if (total <= 0) return 0;
  return Math.round(((total - free) / total) * 100);
}

function getCpuLoadPct(): number {
  const cores = Math.max(1, os.cpus().length);
  const load1m = os.loadavg()[0] || 0;
  return Math.round((load1m / cores) * 100);
}

function isSelfHostedLiveKit(): boolean {
  return Boolean(env.livekitUrl && !env.livekitUrl.includes('.livekit.cloud'));
}

async function triggerAlert(
  key: AlertKey,
  payload: {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    summary: string;
    metrics: Array<{ label: string; value: string }>;
    actionSteps: string[];
  },
): Promise<void> {
  const to = env.adminAlertEmail;
  if (!to) return;

  const lastSent = lastAlertSentAt.get(key) ?? 0;
  if (Date.now() - lastSent < ALERT_COOLDOWN_MS) {
    return;
  }
  lastAlertSentAt.set(key, Date.now());

  console.warn(`[monitor] Firing founder alert (${key}): ${payload.title}`);
  await sendFounderAlertEmail({
    to,
    ...payload,
  });
}

export function recordApiRequest(): void {
  const now = Date.now();
  requestTimestamps.push(now);
  pruneOlderThan(requestTimestamps, 60_000);

  if (requestTimestamps.length >= 250) {
    const snap = getSystemTelemetrySnapshot();
    void triggerAlert('traffic_surge', {
      severity: 'info',
      title: `Viral Traffic Surge Detected (${snap.requestsLastMin} req/min)!`,
      summary:
        'MyMeet is experiencing a sharp spike in live API traffic. Monitor server capacity so users continue getting a smooth experience.',
      metrics: [
        { label: 'API Requests (last 60s)', value: `${snap.requestsLastMin} req/min` },
        { label: 'Server RAM Used', value: `${snap.ramUsedPct}%` },
        { label: 'CPU Load (1m)', value: `${snap.cpuLoadPct}%` },
        { label: 'Emails Sent Today', value: `${snap.emailsSentToday} / 500` },
      ],
      actionSteps: [
        'Check AWS EC2 Monitoring tab for Network Out (bandwidth) & CPU spikes.',
        'If concurrent meeting users exceed 40+, resize EC2 from t3.micro to t3.small or t3.medium (covered by your $100 AWS credits).',
        'If monthly AWS bandwidth approaches 90+ GB, migrate LiveKit to Hetzner VPS (~₹500/mo with 20 TB free bandwidth).',
      ],
    });
  }
}

export function recordGeminiRateLimitHit(model: string): void {
  const now = Date.now();
  gemini429Timestamps.push(now);
  pruneOlderThan(gemini429Timestamps, 10 * 60 * 1000);

  // Fire alert if 3+ rate-limit errors occur within 10 minutes
  if (gemini429Timestamps.length >= 3) {
    void triggerAlert('gemini_rate_limit', {
      severity: 'warning',
      title: 'Gemini AI Free Tier Rate Limit Reached (HTTP 429)',
      summary: `Your Gemini API key hit rate limits (${gemini429Timestamps.length} times in the last 10 minutes on ${model}). Users generating AI notes or 20-MCQ quizzes may see temporary delays.`,
      metrics: [
        { label: '429 Errors (last 10m)', value: String(gemini429Timestamps.length) },
        { label: 'Active Model', value: env.geminiModel },
        { label: 'Requests (last 60s)', value: `${requestTimestamps.length} req/min` },
      ],
      actionSteps: [
        'Open Google AI Studio (aistudio.google.com) -> Billing and attach a payment method to enable Pay-As-You-Go.',
        'Cost is only ~₹0.14 per Pro Note & ~₹0.19 per shared 20-MCQ quiz (~₹200-₹400/mo for 100 active paid users).',
        'Once enabled, rate limits jump from 15 RPM to 1,000+ RPM automatically with zero code change.',
      ],
    });
  }
}

export function recordOutboundEmailSent(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== emailCountDay) {
    emailCountDay = today;
    emailsSentToday = 0;
  }
  emailsSentToday += 1;

  if (emailsSentToday === 400) {
    void triggerAlert('email_quota_high', {
      severity: 'warning',
      title: 'Approaching Gmail 500/day Email Limit (400 Sent Today)',
      summary:
        'MyMeet has sent 400 transactional emails today (signups, Pro welcomes, invites). Gmail SMTP stops around 500 emails/day.',
      metrics: [
        { label: 'Emails Sent Today', value: `${emailsSentToday} / 500` },
        { label: 'Current SMTP Host', value: env.smtpHost || 'Not set' },
      ],
      actionSteps: [
        'Create a free Brevo (300/day free, ₹700/mo for 20k), Resend, or AWS SES (62k/mo cheap) SMTP account.',
        'Replace SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in ~/MyMeet/server/.env.',
        'Run: pm2 restart mymeet-api --update-env',
      ],
    });
  }
}

async function runPeriodicHealthSweep(): Promise<void> {
  const ramPct = getRamUsedPct();
  const cpuPct = getCpuLoadPct();
  const diskPct = getDiskUsedPct();

  if (ramPct >= 88) {
    await triggerAlert('high_ram', {
      severity: 'warning',
      title: `EC2 Server Memory Critically High (${ramPct}% RAM Used)`,
      summary:
        'Your EC2 server is running low on free RAM. Heavy meeting traffic or concurrent users may cause lag or restarts.',
      metrics: [
        { label: 'RAM Used', value: `${ramPct}% (${Math.round(os.totalmem() / 1024 / 1024)} MB total)` },
        { label: 'CPU Load (1m)', value: `${cpuPct}%` },
        { label: 'Disk Used', value: diskPct !== null ? `${diskPct}%` : 'N/A' },
      ],
      actionSteps: [
        'In AWS Console -> EC2 -> Stop instance -> Actions -> Instance settings -> Change instance type to t3.small (2 GB) or t3.medium (4 GB) -> Start instance.',
        'Your existing $100 AWS credits cover this upgrade automatically.',
        'Run pm2 status after restart to confirm mymeet-api and mymeet-livekit are both online.',
      ],
    });
  }

  if (cpuPct >= 95 && process.platform !== 'win32') {
    await triggerAlert('high_cpu', {
      severity: 'warning',
      title: `EC2 CPU Load Very High (${cpuPct}%)`,
      summary:
        'Sustained high CPU load detected on your EC2 server (likely many simultaneous video streams or active meetings).',
      metrics: [
        { label: 'CPU Load (1m)', value: `${cpuPct}%` },
        { label: 'RAM Used', value: `${ramPct}%` },
        { label: 'API Traffic', value: `${requestTimestamps.length} req/min` },
      ],
      actionSteps: [
        'Upgrade EC2 instance type to t3.medium (2 vCPU, 4 GB RAM) or move LiveKit to a dedicated Hetzner VPS.',
      ],
    });
  }

  if (diskPct !== null && diskPct >= 85) {
    await triggerAlert('high_disk', {
      severity: 'warning',
      title: `EC2 Disk Space Running Low (${diskPct}% Used)`,
      summary:
        'Your EC2 root disk crossed 85% usage. If disk hits 100%, PM2 and Caddy may stop working.',
      metrics: [
        { label: 'Disk Used', value: `${diskPct}%` },
        { label: 'RAM Used', value: `${ramPct}%` },
      ],
      actionSteps: [
        'SSH into EC2 and clear old logs: pm2 flush && sudo journalctl --vacuum-time=3d',
        'Check large files with: df -h && du -sh ~/* /var/log/*',
      ],
    });
  }

  // Ping local self-hosted LiveKit HTTP port (7880) when running on Linux production
  if (isSelfHostedLiveKit() && process.platform !== 'win32') {
    try {
      const res = await fetch('http://127.0.0.1:7880', { signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status < 500) {
        livekitConsecutiveFails = 0;
        lastLivekitLocalOk = true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      livekitConsecutiveFails += 1;
      lastLivekitLocalOk = false;
      if (livekitConsecutiveFails >= 2) {
        await triggerAlert('livekit_down', {
          severity: 'critical',
          title: 'Self-Hosted LiveKit Media Server Unreachable!',
          summary: `Local LiveKit server on port 7880 failed ${livekitConsecutiveFails} consecutive health checks (${
            err instanceof Error ? err.message : 'connection failed'
          }). Video/audio calls will fail until restarted.`,
          metrics: [
            { label: 'LiveKit URL', value: env.livekitUrl },
            { label: 'RAM Used', value: `${ramPct}%` },
            { label: 'Disk Used', value: diskPct !== null ? `${diskPct}%` : 'N/A' },
          ],
          actionSteps: [
            'SSH into EC2 immediately and run: pm2 restart mymeet-livekit',
            'Inspect crash reason: pm2 logs mymeet-livekit --lines 40',
            'If OOM (out of memory), resize EC2 from t3.micro to t3.small / t3.medium.',
          ],
        });
      }
    }
  }
}

export function getSystemTelemetrySnapshot() {
  pruneOlderThan(requestTimestamps, 60_000);
  pruneOlderThan(gemini429Timestamps, 10 * 60 * 1000);
  return {
    ramUsedPct: getRamUsedPct(),
    ramTotalMb: Math.round(os.totalmem() / 1024 / 1024),
    cpuLoadPct: getCpuLoadPct(),
    diskUsedPct: getDiskUsedPct(),
    requestsLastMin: requestTimestamps.length,
    emailsSentToday,
    geminiRateLimitHits10m: gemini429Timestamps.length,
    livekitLocalOk: lastLivekitLocalOk,
    alertsConfigured: Boolean(env.adminAlertEmail),
  };
}

export function startSystemMonitor(): void {
  if (monitorStarted) return;
  monitorStarted = true;
  registerEmailSentHook(recordOutboundEmailSent);

  // First sweep 30s after boot, then every 5 minutes
  setTimeout(() => {
    void runPeriodicHealthSweep().catch((err) => {
      console.warn('[monitor] Initial sweep error:', err);
    });
  }, 30_000);

  const timer = setInterval(() => {
    void runPeriodicHealthSweep().catch((err) => {
      console.warn('[monitor] Periodic sweep error:', err);
    });
  }, 5 * 60 * 1000);

  timer.unref?.();
}
