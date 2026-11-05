// The product mark: a ring with an off-centre check, traced from the supplied logo.
// app/icon.svg repeats this geometry as a static file; keep them in sync.
export const LOGO = {
  viewBox: '141 143 970 970',
  ring: { cx: 626, cy: 628, r: 451, strokeWidth: 63 },
  check: { points: '453,523 613,682 875,431', strokeWidth: 74 },
} as const;
