export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  successBg: string;
  successText: string;
  successBorder: string;
  warningBg: string;
  warningText: string;
  warningBorder: string;
  dangerBg: string;
  dangerText: string;
  dangerBorder: string;
  placeholder: string;
}

export const lightColors: ThemeColors = {
  background: '#f6f8fc',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#64748b',
  accent: '#2563eb',
  accentSoft: 'rgba(37, 99, 235, 0.1)',
  accentBorder: 'rgba(37, 99, 235, 0.25)',
  accentText: '#1d4ed8',
  successBg: '#dcfce7',
  successText: '#15803d',
  successBorder: '#bbf7d0',
  warningBg: '#fef3c7',
  warningText: '#b45309',
  warningBorder: '#fde68a',
  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',
  dangerBorder: '#fecaca',
  placeholder: '#94a3b8',
};

export const darkColors: ThemeColors = {
  background: '#090d16',
  surface: '#111827',
  surfaceElevated: '#182235',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  accent: '#3b82f6',
  accentSoft: 'rgba(59, 130, 246, 0.16)',
  accentBorder: 'rgba(59, 130, 246, 0.35)',
  accentText: '#93c5fd',
  successBg: 'rgba(34, 197, 94, 0.15)',
  successText: '#4ade80',
  successBorder: 'rgba(34, 197, 94, 0.32)',
  warningBg: 'rgba(245, 158, 11, 0.15)',
  warningText: '#fbbf24',
  warningBorder: 'rgba(245, 158, 11, 0.32)',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  dangerText: '#fca5a5',
  dangerBorder: 'rgba(239, 68, 68, 0.32)',
  placeholder: '#64748b',
};
