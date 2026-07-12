export const AppColors = {
  bg: "#FFF1F2",
  card: "#FFFFFF",
  accent: "#ec4899",
  accentDark: "#be185d",
  text: "#111827",
  subtext: "#6b7280",
  border: "#f5d0ea",
  danger: "#b91c1c",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Shadows = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
} as const;
