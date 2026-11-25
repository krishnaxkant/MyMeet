export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  navBackground: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSecondary: string;
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
  shadowColor: string;
}

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  navBackground: '#ffffff',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.16)',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#64748b',
  accent: '#2563eb',
  accentSecondary: '#0d9488',
  accentSoft: 'rgba(37, 99, 235, 0.09)',
  accentBorder: 'rgba(37, 99, 235, 0.24)',
  accentText: '#1d4ed8',
  successBg: '#ecfdf5',
  successText: '#15803d',
  successBorder: '#bbf7d0',
  warningBg: '#fffbeb',
  warningText: '#b45309',
  warningBorder: '#fde68a',
  dangerBg: '#fef2f2',
  dangerText: '#b91c1c',
  dangerBorder: '#fecaca',
  placeholder: '#94a3b8',
  shadowColor: '#0f172a',
};

export const darkColors: ThemeColors = {
  background: '#070b14',
  surface: '#0f1626',
  surfaceElevated: '#162036',
  navBackground: '#0c1220',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',
  accent: '#3b82f6',
  accentSecondary: '#14b8a6',
  accentSoft: 'rgba(59, 130, 246, 0.16)',
  accentBorder: 'rgba(59, 130, 246, 0.36)',
  accentText: '#93c5fd',
  successBg: 'rgba(34, 197, 94, 0.14)',
  successText: '#4ade80',
  successBorder: 'rgba(34, 197, 94, 0.3)',
  warningBg: 'rgba(245, 158, 11, 0.14)',
  warningText: '#fbbf24',
  warningBorder: 'rgba(245, 158, 11, 0.3)',
  dangerBg: 'rgba(239, 68, 68, 0.14)',
  dangerText: '#fca5a5',
  dangerBorder: 'rgba(239, 68, 68, 0.3)',
  placeholder: '#64748b',
  shadowColor: '#000000',
};
