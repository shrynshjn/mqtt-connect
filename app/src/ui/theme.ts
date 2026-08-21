// Tokens match the approved Claude Design canvas 1:1 — do not adjust without updating the canvas too.
export const colors = {
  bg: '#0A0E17',
  surface: '#111725',
  surfaceRaised: '#161E30',
  hairline: '#1F2942',
  hairlineHi: '#2C3A5C',
  rowHairline: '#141B2B',
  text: '#E6ECF7',
  textSecondary: '#8A99B8',
  textTertiary: '#5C6B8A',
  accent: '#2F8CFF',
  accentDeep: '#123B8C',
  accentDim: 'rgba(47,140,255,0.14)',
  accentGlow: 'rgba(47,140,255,0.10)',
  accentMuted: '#5B7FB8',
  fault: '#FFB020',
  faultDim: 'rgba(255,176,32,0.10)',
  faultBorder: 'rgba(255,176,32,0.28)',
  white: '#FFFFFF',
};

export const font = {
  sans: undefined as string | undefined, // system font stack (SF Pro / Roboto) — set per-platform in a real font-loading pass
  mono: 'Menlo', // fallback to ui-monospace-equivalent on Android via monospace family
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const radius = { sm: 6, md: 10, lg: 13, xl: 16, pill: 20 } as const;

export function statusColors(status: 'live' | 'fault' | 'idle') {
  switch (status) {
    case 'live':
      return { dot: colors.accent, fill: colors.accent, glow: colors.accentGlow, chipBg: colors.accentDim, label: 'live', actionColor: colors.textSecondary };
    case 'fault':
      return { dot: colors.fault, fill: 'transparent', glow: colors.faultDim, chipBg: colors.faultDim, label: 'fault', actionColor: colors.fault };
    default:
      return { dot: colors.textTertiary, fill: 'transparent', glow: 'transparent', chipBg: colors.surfaceRaised, label: 'idle', actionColor: colors.accent };
  }
}
