/**
 * The ten galaxies.
 *
 * A PLAIN module like `contrast.ts` — no Vue, no DOM — so `npm run check:theme`
 * can load it in node and prove every token in every theme is readable on the
 * surface it lands on. `apply.ts` is the half that touches the document.
 *
 * ---------------------------------------------------------------------------
 * The one rule that shapes this file
 * ---------------------------------------------------------------------------
 * A theme author picks a GALAXY — a space colour and two or three lights. They
 * do not pick a single text colour. Every `text`, `on*` and `*Text` token is
 * derived by `ensureContrast()` from the surface it will actually sit on, so
 * "light text on dark, dark text on light" is a consequence of the build
 * rather than an instruction somebody has to remember. Adding an eleventh
 * galaxy means adding a `ThemeSeed`; the readable palette comes out the far
 * end on its own, and `check:theme` fails if the seed is one no palette can be
 * derived from (a mid-tone space colour with no headroom either way).
 *
 * ---------------------------------------------------------------------------
 * Why surfaces are composited before contrast is measured
 * ---------------------------------------------------------------------------
 * Almost every card in this app is a translucent tint over the 3D galaxy —
 * `rgb(var(--sfs-tint-rgb) / 0.08)`, not an opaque fill. Measuring text
 * against the *tint* would be measuring against something the eye never sees.
 * So `surfaceAt()` composites the tint over the space colour first and the
 * derivation runs against that. It is the difference between a palette that
 * passes a checker and one that is legible.
 */

import {
  AAA_TEXT,
  AA_LARGE,
  AA_TEXT,
  alpha,
  bestTextOn,
  channels,
  contrastRatio,
  darken,
  ensureContrast,
  isDark,
  lighten,
  mix,
  over,
  relativeLuminance,
} from './contrast';

export type ThemeMode = 'dark' | 'light';

/**
 * The 3D background's palette. `AnimatedBackground.vue` reads this, which is
 * what makes each theme a different *galaxy* rather than a different button
 * colour.
 */
export interface GalaxyPalette {
  /** Deep space — the scene clear colour and the fog. */
  space: string;
  /** Galactic core bloom. */
  core: string;
  /** Inner arm stars. */
  inner: string;
  /** Mid-disc stars. */
  mid: string;
  /** Arm tips and the outer halo. */
  outer: string;
  /** The field stars scattered around the camera. */
  star: string;
  /** Planet key light. */
  light: string;
}

/** What a theme author writes. Everything else is computed. */
export interface ThemeSeed {
  id: string;
  name: string;
  tagline: string;
  mode: ThemeMode;
  /** Page void — also the 3D scene's clear colour. */
  space: string;
  /** Primary light of this galaxy: buttons, active states, links. */
  accent: string;
  /** Second light — the far end of every gradient. */
  accent2: string;
  /** Third light, used for tertiary chips and the picker's swatch. */
  accent3: string;
  galaxy: GalaxyPalette;
}

export interface Theme extends ThemeSeed {
  /** Every CSS custom property this theme sets, ready for `style.setProperty`. */
  vars: Record<string, string>;
  /** The composited colour text is actually measured against. */
  measuredSurface: string;
  /** The composited scrim `--sfs-on-overlay` is measured against. */
  measuredOverlay: string;
  /** The accent wash a coloured text token most often lands on. */
  accentWash: string;
  /** The same, per status hue. */
  statusWash: Record<string, string>;
}

/* -------------------------------------------------------------------------- *
 * The seeds
 *
 * Seven dark galaxies and three light ones. The split is deliberate: a light
 * theme is the only thing that exercises the other half of requirement 2, and
 * a platform students read on a phone in daylight needs at least one.
 *
 * Hues are spread around the wheel on purpose — indigo, cyan, amber, emerald,
 * rose, azure, lime, then cobalt / peach / slate for the light three — so the
 * ten are told apart at a glance in the picker rather than being ten shades of
 * blue.
 * -------------------------------------------------------------------------- */
export const THEME_SEEDS: ThemeSeed[] = [
  {
    id: 'andromeda',
    name: 'Andromeda',
    tagline: 'Indigo and violet — the original night sky',
    mode: 'dark',
    space: '#04040f',
    // The platform's original two colours, kept exactly. Andromeda is the
    // default, so the app it ships looks like the app it already was — the
    // other nine are the change, this one is the baseline.
    accent: '#667eea',
    accent2: '#764ba2',
    accent3: '#38bdf8',
    galaxy: {
      space: '#04040f',
      core: '#ffe6b8',
      inner: '#fff4de',
      mid: '#c3b6ff',
      outer: '#5b7cff',
      star: '#dfe4ff',
      light: '#ffeedd',
    },
  },
  {
    id: 'orion',
    name: 'Orion Nebula',
    tagline: 'Ice cyan against nebula magenta',
    mode: 'dark',
    space: '#03101a',
    accent: '#22d3ee',
    accent2: '#f472b6',
    accent3: '#5eead4',
    galaxy: {
      space: '#03101a',
      core: '#d9fbff',
      inner: '#a5f3fc',
      mid: '#7dd3fc',
      outer: '#f472b6',
      star: '#d7f7ff',
      light: '#e8fbff',
    },
  },
  {
    id: 'sombrero',
    name: 'Sombrero',
    tagline: 'Molten gold across a dust lane',
    mode: 'dark',
    space: '#0d0904',
    accent: '#f5b642',
    accent2: '#fb7238',
    accent3: '#fcd34d',
    galaxy: {
      space: '#0d0904',
      core: '#fff2cc',
      inner: '#ffd89b',
      mid: '#f0a860',
      outer: '#b4541f',
      star: '#ffeccd',
      light: '#fff0d4',
    },
  },
  {
    id: 'whirlpool',
    name: 'Whirlpool',
    tagline: 'Emerald arms over deep water',
    mode: 'dark',
    space: '#03110f',
    accent: '#34d399',
    accent2: '#22d3ee',
    accent3: '#a3e635',
    galaxy: {
      space: '#03110f',
      core: '#e9fff6',
      inner: '#a7f3d0',
      mid: '#5eead4',
      outer: '#0ea5e9',
      star: '#d6fff2',
      light: '#e6fff7',
    },
  },
  {
    id: 'pinwheel',
    name: 'Pinwheel',
    tagline: 'Rose light through a plum sky',
    mode: 'dark',
    space: '#100518',
    accent: '#fb7185',
    accent2: '#c084fc',
    accent3: '#f0abfc',
    galaxy: {
      space: '#100518',
      core: '#ffe9f3',
      inner: '#fbcfe8',
      mid: '#e9a8ff',
      outer: '#8b5cf6',
      star: '#ffe4f2',
      light: '#ffeaf4',
    },
  },
  {
    id: 'triangulum',
    name: 'Triangulum',
    tagline: 'Amethyst haze over deep space',
    mode: 'dark',
    space: '#0b0518',
    // Violet rather than the azure this started as: at #38bdf8 it sat 10° of
    // hue from Orion and the two were indistinguishable in the picker, which
    // `check:theme` refuses. Ten galaxies means ten, not eight and two
    // near-duplicates.
    accent: '#8b5cf6',
    accent2: '#6366f1',
    accent3: '#67e8f9',
    galaxy: {
      space: '#0b0518',
      core: '#f3e8ff',
      inner: '#ddd6fe',
      mid: '#a78bfa',
      outer: '#4f46e5',
      star: '#e6dcff',
      light: '#f4ecff',
    },
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    tagline: 'Chartreuse bloom on an olive night',
    mode: 'dark',
    space: '#0a0f03',
    accent: '#a3e635',
    accent2: '#facc15',
    accent3: '#4ade80',
    galaxy: {
      space: '#0a0f03',
      core: '#fbffe0',
      inner: '#e4f8a8',
      mid: '#bef264',
      outer: '#65a30d',
      star: '#f2ffd6',
      light: '#f8ffe4',
    },
  },
  {
    id: 'cartwheel',
    name: 'Cartwheel',
    tagline: 'Daylight galaxy — cobalt on cool white',
    mode: 'light',
    space: '#e3e9f6',
    accent: '#1d4ed8',
    accent2: '#7048e8',
    accent3: '#0f766e',
    galaxy: {
      space: '#e3e9f6',
      core: '#4c6ef5',
      inner: '#748ffc',
      mid: '#91a7ff',
      outer: '#b197fc',
      star: '#8da2fb',
      light: '#ffffff',
    },
  },
  {
    id: 'dawn',
    name: 'Dawn Nebula',
    tagline: 'Warm cream and coral at first light',
    mode: 'light',
    space: '#f6e9da',
    accent: '#c2410c',
    accent2: '#be123c',
    accent3: '#a16207',
    galaxy: {
      space: '#f6e9da',
      core: '#f97316',
      inner: '#fb923c',
      mid: '#f9a8a0',
      outer: '#e11d48',
      star: '#f7a08a',
      light: '#fffaf3',
    },
  },
  {
    id: 'silver',
    name: 'Silver Spiral',
    tagline: 'Quiet slate on paper white',
    mode: 'light',
    space: '#e6eaf0',
    accent: '#334f78',
    accent2: '#5b6b8c',
    accent3: '#0f766e',
    galaxy: {
      space: '#e6eaf0',
      core: '#64748b',
      inner: '#7f8ea3',
      mid: '#9aa7b8',
      outer: '#475569',
      star: '#8d9bad',
      light: '#ffffff',
    },
  },
];

export const DEFAULT_THEME_ID = 'andromeda';

/* -------------------------------------------------------------------------- *
 * Derivation
 * -------------------------------------------------------------------------- */

/**
 * The composited colour a card actually presents to the eye: the theme's
 * standard surface tint laid over deep space. Text contrast is measured
 * against this, not against the tint.
 */
function surfaceAt(seed: ThemeSeed, tintAlpha: number): string {
  /*
    White in BOTH modes, and that is the correction that made the light
    galaxies look like a product rather than a washed-out draft.

    A tint's job is to LIFT a surface off the page. Over a dark galaxy that
    means white. The first version flipped it to near-black for the light
    galaxies, on the theory that everything flips — and the result was cards
    DARKER than the page they sat on, elevation running backwards, and a grey
    card carrying grey-on-grey text. Lifting is lifting: cards are white, the
    page behind them is a light grey, and the ink is dark. What flips is the
    INK, not the direction of elevation.
  */
  return over('#ffffff', tintAlpha, seed.space);
}

/**
 * The HARDEST background a coloured text token actually lands on.
 *
 * `--sfs-success-text` is not only used on a plain card. Across the app it
 * mostly sits on a wash of its own hue — `rgb(var(--sfs-success-rgb) / 0.3)`
 * behind a "Passed" pill, an active plan, a completed task. Derived against
 * the plain surface it cleared 4.5 there and only 3.3 on the wash, and the
 * wash is where it is nearly always seen: 117 of the light themes' 173
 * remaining failures were this one mistake.
 *
 * The wash is the harder background in BOTH modes, which is why one reference
 * is enough rather than a search. Over a dark galaxy a light hue washes
 * *lighter* than the surface, and over a pale one a dark hue washes *darker* —
 * either way it moves toward the text and takes contrast away.
 */
function washedBackdrop(hue: string, space: string): string {
  return over(hue, 0.35, space);
}

/**
 * A pale tinted CARD of some hue — the `#fffbeb` behind a warning, the
 * `#fed7d7` behind an error, the `#f0f9ff` behind a hint.
 *
 * Always light, in all ten galaxies, exactly like `--sfs-paper`, and paired
 * with a `-on-paper` ink that is always dark. That pairing is the whole point:
 * a pale callout is a small light island, and an island is the one thing on
 * the page that must NOT invert with the theme, or its two halves invert
 * independently and meet in the middle. Before this existed the codemod had
 * nowhere to send those backgrounds and sent them to the solid status colour,
 * which put amber text on an amber block.
 */
function washOf(hue: string): string {
  return mix(hue, '#ffffff', 0.86);
}

/**
 * A filled control and the ink on it, decided together.
 *
 * The first version derived the ink alone and kept the author's fill exactly.
 * On Andromeda that produced NEAR-BLACK text on the indigo `#667eea` — the
 * arithmetic is right (black is 5.7:1 there, white only 3.66:1) and the result
 * looks broken, because every primary button and active tab on the platform
 * suddenly had dark text. It was reported as "black text in the dark theme".
 *
 * So the fill gives way instead. For a deep hue — anything below `BRIGHT` —
 * the fill is darkened just enough for WHITE to clear AA, which is a shade a
 * viewer cannot pick out of a line-up and keeps the light-text convention that
 * every button on the platform already followed.
 *
 * Above that line the convention flips on its own and dark ink is what a
 * designer would pick anyway: nobody puts white text on a lime or gold button.
 * Orion's cyan, Sombrero's gold, Whirlpool's green and Sunflower's lime all
 * keep their exact colour and take dark ink, and that reads as intentional
 * rather than as a bug.
 */
const BRIGHT = 0.3;

function fillAndInk(hue: string): { fill: string; ink: string } {
  const light = '#ffffff';
  if (contrastRatio(light, hue) >= AA_TEXT) return { fill: hue, ink: light };

  if (relativeLuminance(hue) < BRIGHT) {
    let fill = hue;
    for (let step = 1; step <= 60 && contrastRatio(light, fill) < AA_TEXT; step++) {
      fill = mix(hue, '#000000', step / 100);
    }
    return { fill, ink: light };
  }

  return { fill: hue, ink: ensureContrast(bestTextOn(hue), hue, AA_TEXT) };
}

/** Status hues, per mode, before they are made readable against the surface. */
function statusSeeds(mode: ThemeMode) {
  return mode === 'dark'
    ? { success: '#34d399', warning: '#fbbf24', danger: '#f87171', info: '#38bdf8' }
    : { success: '#047857', warning: '#b45309', danger: '#b91c1c', info: '#0369a1' };
}

function buildTheme(seed: ThemeSeed): Theme {
  const dark = seed.mode === 'dark';

  /* The three surfaces the app really uses, composited. */
  const surface = surfaceAt(seed, dark ? 0.06 : 0.055);
  const surface2 = surfaceAt(seed, dark ? 0.1 : 0.09);
  const surface3 = surfaceAt(seed, dark ? 0.16 : 0.14);

  /* --- Accents. Fill and ink are decided together — see fillAndInk(). --- */
  const a1 = fillAndInk(seed.accent);
  const a2 = fillAndInk(seed.accent2);
  const a3 = fillAndInk(seed.accent3);
  const accent = a1.fill;
  const accent2 = a2.fill;
  const accent3 = a3.fill;
  const onAccent = a1.ink;
  const onAccent2 = a2.ink;
  const onAccent3 = a3.ink;

  /* --- Text, derived. Never written down. --- */
  const inkStart = dark ? '#ffffff' : '#0d1220';
  const text = ensureContrast(inkStart, surface, AAA_TEXT);
  // Muted text carries a hint of the galaxy so the theme reads in body copy
  // too, then is pulled back until it clears AA. Tinting after the contrast
  // pass would undo it.
  const textMuted = ensureContrast(mix(text, accent, 0.42), surface, AA_TEXT);
  // Faint text is captions and timestamps — AA large is the honest bar for it,
  // and pretending otherwise just produces four identical greys.
  const textFaint = ensureContrast(mix(text, surface, 0.42), surface, AA_LARGE);

  // The accent used AS TEXT on a surface is a different colour from the accent
  // used as a fill, and conflating the two is the single most common way an
  // accessible palette stops being one.
  const accentText = ensureContrast(accent, washedBackdrop(accent, seed.space), AA_TEXT);
  const accentTextSoft = ensureContrast(accent, washedBackdrop(accent, seed.space), AA_LARGE);

  /* --- Paper.
   *
   * A certificate is a white page in every theme, and so is anything printed.
   * These two tokens are the escape hatch for that: paper stays light and its
   * ink stays dark in all ten galaxies, taking only a breath of the accent so
   * it still belongs to the theme. Without them, "make the background follow
   * the theme" turns a certificate black and the codemod would have had to
   * skip a third of the stylesheets.
   */
  const paper = mix('#ffffff', accent, 0.035);
  const paper2 = mix('#ffffff', accent, 0.075);
  const paper3 = mix('#ffffff', accent, 0.12);
  const onPaper = ensureContrast(mix('#151a24', accent, 0.1), paper, AAA_TEXT);
  const onPaperMuted = ensureContrast(mix(onPaper, paper, 0.4), paper, AA_TEXT);

  /* --- Status, and the two readings every colour needs.
   *
   * A status hue is three tokens, not one, and the codemod proved why: the
   * same `#f87171` appears in the stylesheets as a filled badge, as error text
   * on a card, and as error text on a white certificate. Those are three
   * different colours if they are to stay legible, and deriving each against
   * the surface it actually lands on is the whole of requirement 2.
   */
  const status = statusSeeds(seed.mode);
  const statusVars: Record<string, string> = {};
  const statusFill: Record<string, string> = {};
  for (const [name, seedHue] of Object.entries(status)) {
    const { fill: hue, ink } = fillAndInk(seedHue);
    const wash = washOf(hue);
    statusFill[name] = hue;
    statusVars[`--sfs-${name}`] = hue;
    statusVars[`--sfs-${name}-rgb`] = channels(hue);
    statusVars[`--sfs-${name}-text`] = ensureContrast(hue, washedBackdrop(hue, seed.space), AA_TEXT);
    statusVars[`--sfs-${name}-wash`] = wash;
    // Derived against the WASH rather than plain paper, because the wash is the
    // darker of the two and this ink has to clear both.
    statusVars[`--sfs-${name}-on-paper`] = ensureContrast(hue, wash, AA_TEXT);
    statusVars[`--sfs-on-${name}`] = ink;
    statusVars[`--sfs-${name}-soft`] = alpha(hue, dark ? 0.16 : 0.13);
    statusVars[`--sfs-${name}-border`] = alpha(hue, dark ? 0.42 : 0.38);
  }

  /* --- Tints.
   *
   * One channel triple serves every opacity in the stylesheets. In a dark
   * galaxy the tint that lifts a card off the background is white; in a light
   * one it is near-black. Flipping this single token is what turns ~1500
   * `rgba(255,255,255,α)` literals into a working light theme.
   */
  const tintRgb = '255 255 255';
  const shadeRgb = '0 0 0';
  /*
    Borders cannot share the tint.

    A hairline written `rgba(255,255,255,0.14)` reads as an edge over a dark
    galaxy and is invisible over a pale one, so the one thing that genuinely
    must flip gets its own channel triple — the ink's. Splitting this out is
    what allowed the tint above to stop flipping.
  */
  const lineRgb = channels(text);

  const borderAlpha = dark ? 0.14 : 0.16;
  const border = alpha(text, borderAlpha);
  const borderStrong = alpha(text, dark ? 0.26 : 0.3);

  /*
    What the eye actually sees where a scrim is used: the overlay's own colour
    composited over the space behind it. Measuring the ink against the rgba()
    itself would be measuring against something nobody ever sees - the same
    correction `surfaceAt()` makes for every tinted card on the platform.
  */
  const overlaySolid = over(dark ? '#01010a' : '#0b1020', dark ? 0.72 : 0.55,
                            seed.space);

  const vars: Record<string, string> = {
    /* Identity — readable in devtools, and what `[data-theme]` selectors use. */
    '--sfs-theme': seed.id,
    '--sfs-mode': seed.mode,

    /* Space and surfaces */
    '--sfs-space': seed.space,
    '--sfs-space-rgb': channels(seed.space),
    '--sfs-surface': surface,
    '--sfs-surface-2': surface2,
    '--sfs-surface-3': surface3,
    '--sfs-surface-rgb': channels(surface),
    '--sfs-overlay': alpha(dark ? '#01010a' : '#0b1020', dark ? 0.72 : 0.55),
    /*
      THE INK FOR AN OVERLAY, WHICH IS THE ONE SURFACE THAT HAD NONE.

      `--sfs-overlay` is dark in ALL TEN galaxies - it is a scrim, and a scrim's
      job is to darken whatever is behind it so light text reads over a
      photograph. Every other surface here has an ink partner and a contrast
      claim; this one did not, and a stylesheet reaching for the nearest thing
      would spend `--sfs-text` - which FLIPS. On the three light galaxies that is
      near-black text on a near-black scrim, which is the exact failure
      `audit:ink` exists to catch, and it would have shipped invisible to anybody
      working in a dark theme.

      So the pair is derived here from the composited scrim, the same way
      `--sfs-on-paper` is derived from paper and for the mirror-image reason:
      paper is light in all ten and takes dark ink, a scrim is dark in all ten
      and takes light ink. `contrastClaims` measures both.
    */
    '--sfs-on-overlay': ensureContrast('#f8fafc', overlaySolid, AA_TEXT),
    '--sfs-on-overlay-muted': ensureContrast('#cbd5e1', overlaySolid, AA_LARGE),

    /* Tint ladder — one triple, every opacity */
    '--sfs-tint-rgb': tintRgb,
    '--sfs-shade-rgb': shadeRgb,
    '--sfs-line-rgb': lineRgb,

    /* Text */
    '--sfs-text': text,
    '--sfs-text-rgb': channels(text),
    '--sfs-text-muted': textMuted,
    '--sfs-text-muted-rgb': channels(textMuted),
    '--sfs-text-faint': textFaint,
    '--sfs-text-inverse': dark ? '#0d1220' : '#ffffff',

    /* Accents */
    '--sfs-accent': accent,
    '--sfs-accent-rgb': channels(accent),
    '--sfs-accent-2': accent2,
    '--sfs-accent-2-rgb': channels(accent2),
    '--sfs-accent-3': accent3,
    '--sfs-accent-3-rgb': channels(accent3),
    '--sfs-accent-soft': dark ? lighten(accent, 0.18) : darken(accent, 0.12),
    '--sfs-accent-strong': darken(accent, dark ? 0.18 : 0.24),
    '--sfs-accent-text': accentText,
    '--sfs-accent-2-text': ensureContrast(accent2, washedBackdrop(accent2, seed.space), AA_TEXT),
    '--sfs-accent-3-text': ensureContrast(accent3, washedBackdrop(accent3, seed.space), AA_TEXT),
    '--sfs-accent-text-soft': accentTextSoft,
    '--sfs-accent-wash': washOf(accent),
    '--sfs-accent-2-wash': washOf(accent2),
    '--sfs-accent-on-paper': ensureContrast(accent, washOf(accent), AA_TEXT),
    '--sfs-accent-2-on-paper': ensureContrast(accent2, washOf(accent2), AA_TEXT),
    '--sfs-on-accent': onAccent,
    // The ink's own channels, so something sitting ON a filled surface can tint
    // itself with a wash of that ink rather than with the page's tint — which
    // is the wrong colour there in one mode or the other.
    '--sfs-on-accent-rgb': channels(onAccent),
    '--sfs-on-accent-2': onAccent2,
    '--sfs-on-accent-3': onAccent3,

    /* Gradients — the app's signature, restated per galaxy */
    '--sfs-gradient': `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)`,
    '--sfs-gradient-soft': `linear-gradient(135deg, ${alpha(accent, 0.22)} 0%, ${alpha(accent2, 0.22)} 100%)`,
    '--sfs-gradient-3': `linear-gradient(135deg, ${accent} 0%, ${accent3} 55%, ${accent2} 100%)`,

    /* Lines, focus, shadow */
    '--sfs-border': border,
    '--sfs-border-strong': borderStrong,
    '--sfs-border-accent': alpha(accent, dark ? 0.45 : 0.4),
    '--sfs-focus': accentTextSoft,
    '--sfs-shadow': dark ? 'rgb(0 0 0 / 0.45)' : 'rgb(15 23 42 / 0.12)',
    '--sfs-shadow-strong': dark ? 'rgb(0 0 0 / 0.65)' : 'rgb(15 23 42 / 0.22)',
    '--sfs-glow': alpha(accent, dark ? 0.4 : 0.28),

    /* Paper — always light, always dark-inked */
    '--sfs-paper': paper,
    '--sfs-paper-2': paper2,
    '--sfs-paper-3': paper3,
    '--sfs-on-paper': onPaper,
    '--sfs-on-paper-muted': onPaperMuted,
    '--sfs-paper-border': alpha(onPaper, 0.16),

    /* Form controls get their own pair so a native <select> popup, which
       inherits from the control rather than from the page, is legible too. */
    '--sfs-field': dark ? over('#ffffff', 0.08, seed.space) : '#ffffff',
    '--sfs-field-text': dark
      ? ensureContrast('#ffffff', over('#ffffff', 0.08, seed.space), AAA_TEXT)
      : ensureContrast('#0d1220', '#ffffff', AAA_TEXT),
    '--sfs-field-border': border,
    '--sfs-placeholder': textFaint,

    /* The 3D scene */
    '--sfs-galaxy-core': seed.galaxy.core,
    '--sfs-galaxy-inner': seed.galaxy.inner,
    '--sfs-galaxy-mid': seed.galaxy.mid,
    '--sfs-galaxy-outer': seed.galaxy.outer,
    '--sfs-galaxy-star': seed.galaxy.star,

    ...statusVars,
  };

  return {
    ...seed,
    vars,
    measuredSurface: surface,
    measuredOverlay: overlaySolid,
    accentWash: washedBackdrop(accent, seed.space),
    statusWash: Object.fromEntries(
      Object.entries(statusFill).map(([name, hue]) => [name, washedBackdrop(hue, seed.space)])
    ),
  };
}

export const THEMES: Theme[] = THEME_SEEDS.map(buildTheme);

export const THEME_IDS = THEMES.map(t => t.id);

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME_ID)!;
}

/**
 * What a first-time visitor gets: Andromeda, always.
 *
 * This deliberately ignores `prefers-color-scheme`. Self Study is a dark
 * product — the 3D galaxy behind every page is the identity, and it is the
 * dark galaxies that show it. Opening a visitor whose laptop happens to be in
 * light mode into a pale theme shows them a different-looking product than
 * everyone else is describing, and the light themes are a preference somebody
 * chooses rather than a default anybody should be dropped into.
 *
 * The parameter is kept so the OS preference stays visible at the call site
 * rather than being quietly dropped somewhere in `apply.ts`.
 */
export function defaultThemeFor(_prefersLight: boolean): string {
  return DEFAULT_THEME_ID;
}

/* -------------------------------------------------------------------------- *
 * Self-description, for the checker and the picker
 * -------------------------------------------------------------------------- */

/** Every (foreground, background, minimum) triple a theme promises to honour. */
export interface ContrastClaim {
  fg: string;
  bg: string;
  min: number;
  label: string;
}

/**
 * The contract `check:theme` enforces. It lives here rather than in the check
 * script so that adding a token and forgetting to claim anything about it is
 * visible in the same file that defines it.
 */
export function contrastClaims(theme: Theme): ContrastClaim[] {
  const v = theme.vars;
  const s = theme.measuredSurface;
  const claims: ContrastClaim[] = [
    { fg: v['--sfs-text'], bg: s, min: AAA_TEXT, label: 'text on surface' },
    { fg: v['--sfs-text'], bg: v['--sfs-space'], min: AA_TEXT, label: 'text on space' },
    { fg: v['--sfs-text'], bg: v['--sfs-surface-2'], min: AA_TEXT, label: 'text on surface-2' },
    { fg: v['--sfs-text'], bg: v['--sfs-surface-3'], min: AA_TEXT, label: 'text on surface-3' },
    { fg: v['--sfs-text-muted'], bg: s, min: AA_TEXT, label: 'muted on surface' },
    { fg: v['--sfs-text-muted'], bg: v['--sfs-surface-3'], min: AA_LARGE, label: 'muted on surface-3' },
    { fg: v['--sfs-text-faint'], bg: s, min: AA_LARGE, label: 'faint on surface' },
    { fg: v['--sfs-accent-text'], bg: s, min: AA_TEXT, label: 'accent text on surface' },
    { fg: v['--sfs-accent-text'], bg: theme.accentWash, min: AA_TEXT, label: 'accent text on its own wash' },
    { fg: v['--sfs-accent-2-text'], bg: s, min: AA_TEXT, label: 'accent-2 text on surface' },
    { fg: v['--sfs-accent-3-text'], bg: s, min: AA_TEXT, label: 'accent-3 text on surface' },
    { fg: v['--sfs-accent-on-paper'], bg: v['--sfs-paper'], min: AA_TEXT, label: 'accent text on paper' },
    { fg: v['--sfs-accent-on-paper'], bg: v['--sfs-accent-wash'], min: AA_TEXT, label: 'accent text on accent wash' },
    { fg: v['--sfs-accent-2-on-paper'], bg: v['--sfs-paper'], min: AA_TEXT, label: 'accent-2 text on paper' },
    { fg: v['--sfs-accent-2-on-paper'], bg: v['--sfs-accent-2-wash'], min: AA_TEXT, label: 'accent-2 text on accent-2 wash' },
    { fg: v['--sfs-on-paper'], bg: v['--sfs-accent-wash'], min: AA_TEXT, label: 'ink on accent wash' },
    { fg: v['--sfs-on-accent'], bg: v['--sfs-accent'], min: AA_TEXT, label: 'ink on accent' },
    { fg: v['--sfs-on-accent-2'], bg: v['--sfs-accent-2'], min: AA_TEXT, label: 'ink on accent-2' },
    { fg: v['--sfs-on-accent-3'], bg: v['--sfs-accent-3'], min: AA_TEXT, label: 'ink on accent-3' },
    { fg: v['--sfs-on-paper'], bg: v['--sfs-paper'], min: AAA_TEXT, label: 'ink on paper' },
    { fg: v['--sfs-on-paper-muted'], bg: v['--sfs-paper'], min: AA_TEXT, label: 'muted ink on paper' },
    { fg: v['--sfs-on-paper'], bg: v['--sfs-paper-3'], min: AA_TEXT, label: 'ink on paper-3' },
    /*
      A scrim is dark in all ten galaxies, so its ink is light in all ten - the
      mirror image of paper.

      CLAIMED AT AA AND NOT AAA, AND THAT IS A MEASURED CEILING RATHER THAN A
      RELAXED STANDARD. On the three light galaxies the scrim is 0.55 alpha over
      a light space, which composites to a mid-grey around #6e727e - and white,
      the lightest ink there is, measures 4.8:1 on that. AAA is not reachable
      with ANY ink, so claiming it would be claiming something no value can
      satisfy. Measured: 4.76 (dawn), 4.80 (silver), 4.82 (cartwheel), and 12-16
      on the seven dark galaxies.

      What makes 4.8 the right answer rather than a shrug is what sits on a
      scrim: a hero title and one line of metadata, both large text, for which
      the applicable threshold is 3:1. A caller putting body copy on a scrim
      should double the scrim - a hero over an arbitrary photograph stacks two stops
      of it precisely because its backdrop is an arbitrary photograph and no
      token can measure that.
    */
    { fg: v['--sfs-on-overlay'], bg: theme.measuredOverlay, min: AA_TEXT, label: 'ink on overlay' },
    { fg: v['--sfs-on-overlay-muted'], bg: theme.measuredOverlay, min: AA_LARGE, label: 'muted ink on overlay' },
    { fg: v['--sfs-field-text'], bg: v['--sfs-field'], min: AAA_TEXT, label: 'field text on field' },
    { fg: v['--sfs-placeholder'], bg: v['--sfs-field'], min: AA_LARGE, label: 'placeholder on field' },
  ];
  for (const name of ['success', 'warning', 'danger', 'info']) {
    claims.push(
      { fg: v[`--sfs-${name}-text`], bg: s, min: AA_TEXT, label: `${name} text on surface` },
      { fg: v[`--sfs-${name}-text`], bg: theme.statusWash[name], min: AA_TEXT, label: `${name} text on its own wash` },
      { fg: v[`--sfs-${name}-on-paper`], bg: v['--sfs-paper'], min: AA_TEXT, label: `${name} text on paper` },
      { fg: v[`--sfs-on-${name}`], bg: v[`--sfs-${name}`], min: AA_TEXT, label: `ink on ${name}` }
    );
  }
  return claims;
}

/** `true` when the derivation actually delivered what the claim asks for. */
export function claimHolds(claim: ContrastClaim): boolean {
  return contrastRatio(claim.fg, claim.bg) >= claim.min - 0.001;
}

/** Does this theme paint a dark world? Used for the `.dark-mode` class. */
export function themeIsDark(theme: Theme): boolean {
  return theme.mode === 'dark' && isDark(theme.measuredSurface);
}
