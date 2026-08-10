<script setup lang="ts">
/**
 * A news anchor, drawn rather than filmed.
 *
 * SVG rather than an image or a video for three reasons that all matter here:
 * the page is public and must load fast on a phone, the anchor has to *react*
 * to a speech-synthesis event the instant it fires (a video cannot), and it has
 * to be legible in all ten galaxies — a photograph would be a rectangle of
 * someone else's lighting sitting on top of the theme.
 *
 * The animation is deliberately driven by `speaking`, a prop, and never by a
 * timer of its own. The mouth moves exactly while `speechSynthesis` says it is
 * speaking, so a voice that fails to start leaves a still anchor rather than a
 * mime — which is the honest signal that something is wrong, and the one that
 * led to the bug being found on iOS in the first place.
 *
 * `prefers-reduced-motion` stops the idle sway and the blink but keeps the
 * mouth: the mouth is information (who is talking), the sway is decoration.
 */

interface Props {
    /** Which presenter this is — decides hair, build and attire. */
    anchor: 'female' | 'male';
    /** Mouth moves only while this is true. */
    speaking?: boolean;
    /** Dim the one who is not on camera. */
    active?: boolean;
    name?: string;
    /** Shown under the name — the voice actually cast, or a fallback notice. */
    voiceLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
    speaking: false,
    active: false,
    name: '',
    voiceLabel: '',
});
</script>

<template>
    <div
        class="anchor"
        :class="{
            'anchor--speaking': props.speaking,
            'anchor--active': props.active,
            [`anchor--${props.anchor}`]: true,
        }"
    >
        <div class="anchor__stage">
            <svg
                class="anchor__figure"
                viewBox="0 0 200 220"
                role="img"
                :aria-label="`${props.name || props.anchor} news anchor`"
            >
                <defs>
                    <linearGradient :id="`suit-${props.anchor}`" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" class="suit-top" />
                        <stop offset="100%" class="suit-bottom" />
                    </linearGradient>
                    <radialGradient :id="`key-${props.anchor}`" cx="50%" cy="35%" r="65%">
                        <stop offset="0%" class="key-in" />
                        <stop offset="100%" class="key-out" />
                    </radialGradient>
                    <clipPath :id="`face-${props.anchor}`">
                        <ellipse cx="100" cy="78" rx="34" ry="40" />
                    </clipPath>
                </defs>

                <!-- studio key light behind the presenter -->
                <ellipse class="keylight" cx="100" cy="96" rx="86" ry="92"
                         :fill="`url(#key-${props.anchor})`" />

                <g class="anchor__body">
                    <!-- shoulders and blazer -->
                    <path class="suit"
                          d="M100 132c-34 0-58 15-66 38-4 11-6 24-6 38h144c0-14-2-27-6-38-8-23-32-38-66-38z"
                          :fill="`url(#suit-${props.anchor})`" />
                    <!-- shirt / blouse V -->
                    <path class="shirt" d="M100 134l-17 8 17 30 17-30-17-8z" />
                    <!-- lapels -->
                    <path class="lapel" d="M83 142l17 30-26 36-12-52 21-14z" />
                    <path class="lapel" d="M117 142l-17 30 26 36 12-52-21-14z" />

                    <!-- tie for him, collar necklace for her -->
                    <path v-if="props.anchor === 'male'" class="tie"
                          d="M100 150l-7 9 7 42 7-42-7-9z" />
                    <g v-else class="necklace">
                        <path d="M86 141q14 14 28 0" fill="none" />
                        <circle cx="100" cy="152" r="3.4" />
                    </g>

                    <!-- neck -->
                    <path class="skin neck" d="M88 106h24v28q0 8-12 8t-12-8v-28z" />
                    <ellipse class="neck-shade" cx="100" cy="116" rx="12" ry="7" />

                    <!-- head -->
                    <g class="anchor__head">
                        <ellipse class="skin" cx="100" cy="78" rx="34" ry="40" />
                        <!-- ears -->
                        <ellipse class="skin" cx="66" cy="80" rx="6" ry="9" />
                        <ellipse class="skin" cx="134" cy="80" rx="6" ry="9" />

                        <!-- hair -->
                        <g :clip-path="props.anchor === 'female' ? undefined : `url(#face-${props.anchor})`">
                            <path v-if="props.anchor === 'male'" class="hair"
                                  d="M64 74c0-26 16-42 36-42s36 16 36 42c0-14-12-20-36-20S64 60 64 74z" />
                        </g>
                        <template v-if="props.anchor === 'male'">
                            <path class="hair"
                                  d="M66 72c-2-26 14-44 34-44s36 18 34 44c-3-18-14-26-34-26S69 54 66 72z" />
                        </template>
                        <template v-else>
                            <!-- longer hair: drawn behind and beside the face -->
                            <path class="hair"
                                  d="M62 78c-3-30 16-50 38-50s41 20 38 50c-1 12-3 22-6 30 2-22-4-36-10-42-8 6-22 9-32 6-8-2-14-6-18-11-5 8-9 24-6 47-3-8-5-18-4-30z" />
                            <path class="hair"
                                  d="M62 84c-6 16-8 34-6 50 6-4 10-12 12-22z" />
                            <path class="hair"
                                  d="M138 84c6 16 8 34 6 50-6-4-10-12-12-22z" />
                        </template>

                        <!-- brows -->
                        <path class="brow" d="M78 66q10-6 20-1" />
                        <path class="brow" d="M122 66q-10-6-20-1" />

                        <!-- eyes: the blink is a scaleY on the whole group -->
                        <g class="eyes">
                            <g class="eye">
                                <ellipse class="eye-white" cx="87" cy="78" rx="8" ry="5.2" />
                                <circle class="iris" cx="87" cy="78" r="3.4" />
                                <circle class="pupil" cx="87" cy="78" r="1.6" />
                                <circle class="glint" cx="88.6" cy="76.4" r="1" />
                            </g>
                            <g class="eye">
                                <ellipse class="eye-white" cx="113" cy="78" rx="8" ry="5.2" />
                                <circle class="iris" cx="113" cy="78" r="3.4" />
                                <circle class="pupil" cx="113" cy="78" r="1.6" />
                                <circle class="glint" cx="114.6" cy="76.4" r="1" />
                            </g>
                        </g>

                        <!-- nose -->
                        <path class="nose" d="M100 82v10l-4 3" />

                        <!-- mouth: scaleY animates between a line and an open vowel -->
                        <g class="mouth-group">
                            <ellipse class="mouth" cx="100" cy="100" rx="9" ry="5" />
                            <path class="lip" d="M91 100q9 -4 18 0" />
                        </g>
                    </g>
                </g>

                <!-- desk -->
                <path class="desk" d="M0 196h200v24H0z" />
                <path class="desk-edge" d="M0 196h200v4H0z" />
            </svg>

            <span class="anchor__onair" aria-hidden="true">ON AIR</span>
        </div>

        <div class="anchor__label">
            <span class="anchor__name">{{ props.name }}</span>
            <span v-if="props.voiceLabel" class="anchor__voice">{{ props.voiceLabel }}</span>
        </div>
    </div>
</template>

<style scoped>
/*
  The illustration's own palette.

  Skin and hair are not semantic tokens and never will be, so they are declared
  once here as overridable custom properties with literal fallbacks — the same
  shape working rule 12 asks for (`var(--token, fallback)`), so a theme *can*
  reach them and nothing breaks if none does. Everything with a semantic
  meaning — the studio glow, the desk, the on-air light — spends a real token.
*/
.anchor {
    --anchor-skin: var(--sfs-anchor-skin, #e6b08c);
    --anchor-skin-shade: var(--sfs-anchor-skin-shade, #cf9575);
    --anchor-hair: var(--sfs-anchor-hair, #2f2a3d);
    --anchor-shirt: var(--sfs-anchor-shirt, #f4f6fb);
    --anchor-mouth: var(--sfs-anchor-mouth, #7d3244);

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 0;
    min-width: 0;
    opacity: 0.44;
    filter: saturate(0.6);
    transition: opacity 0.45s ease, filter 0.45s ease, transform 0.45s ease;
    transform: scale(0.94);
}

.anchor--active {
    opacity: 1;
    filter: none;
    transform: scale(1);
}

.anchor__stage {
    position: relative;
    width: 100%;
    max-width: 230px;
    border-radius: 1rem 1rem 0.5rem 0.5rem;
    overflow: hidden;
    background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
    border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
}

.anchor__figure {
    display: block;
    width: 100%;
    height: auto;
}

/* -- gradients ------------------------------------------------------- */
.suit-top { stop-color: var(--sfs-accent, #667eea); stop-opacity: 0.95; }
.suit-bottom { stop-color: var(--sfs-accent-strong, var(--sfs-accent, #4c5fd7)); stop-opacity: 1; }
.anchor--female .suit-top { stop-color: var(--sfs-accent-2, #a06bd8); stop-opacity: 0.95; }
.anchor--female .suit-bottom { stop-color: var(--sfs-accent-3, var(--sfs-accent-2, #7d49b8)); stop-opacity: 1; }

.key-in { stop-color: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.16); }
.key-out { stop-color: rgb(var(--sfs-tint-rgb, 255 255 255) / 0); }

/* -- figure ---------------------------------------------------------- */
.skin { fill: var(--anchor-skin); }
.neck-shade { fill: var(--anchor-skin-shade); opacity: 0.5; }
.hair { fill: var(--anchor-hair); }
.shirt { fill: var(--anchor-shirt); }
.lapel { fill: rgb(0 0 0 / 0.14); }
.tie { fill: var(--sfs-danger, #d24b5a); }
.necklace path { stroke: var(--sfs-warning, #e8c45c); stroke-width: 1.6; }
.necklace circle { fill: var(--sfs-warning, #e8c45c); }

.brow { stroke: var(--anchor-hair); stroke-width: 3.4; stroke-linecap: round; fill: none; }
.eye-white { fill: var(--sfs-paper, #ffffff); }
.iris { fill: var(--sfs-accent-strong, #3f4bb8); }
.anchor--female .iris { fill: var(--sfs-accent-2, #7d49b8); }
.pupil { fill: var(--sfs-on-paper, #14161f); }
.glint { fill: var(--sfs-paper, #ffffff); opacity: 0.9; }
.nose { stroke: var(--anchor-skin-shade); stroke-width: 2; fill: none; stroke-linecap: round; }

.mouth { fill: var(--anchor-mouth); }
.lip { stroke: var(--anchor-skin-shade); stroke-width: 1.4; fill: none; }

.desk { fill: var(--sfs-surface-strong, rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12)); }
.desk-edge { fill: var(--sfs-accent, #667eea); opacity: 0.75; }

/* -- the mouth ------------------------------------------------------- *
   Two frames would read as a puppet. Four uneven ones, at a speed that does not
   divide into the blink, is enough for the eye to stop tracking the loop. */
.mouth-group {
    transform-box: fill-box;
    transform-origin: center;
    transform: scaleY(0.18);
    transition: transform 0.12s ease-out;
}

.anchor--speaking .mouth-group {
    animation: talk 0.34s infinite steps(1, end);
}

@keyframes talk {
    0%   { transform: scaleY(0.22) scaleX(0.96); }
    25%  { transform: scaleY(1.00) scaleX(1.02); }
    50%  { transform: scaleY(0.45) scaleX(0.98); }
    75%  { transform: scaleY(0.80) scaleX(1.00); }
    100% { transform: scaleY(0.30) scaleX(0.97); }
}

/* -- idle life ------------------------------------------------------- */
.eyes {
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 6.5s infinite;
}

.anchor--male .eyes { animation-delay: 2.3s; }   /* not in unison — that reads as a machine */

@keyframes blink {
    0%, 92%, 100% { transform: scaleY(1); }
    95%           { transform: scaleY(0.08); }
}

.anchor__head {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: sway 9s ease-in-out infinite;
}

.anchor--male .anchor__head { animation-delay: 1.7s; }

@keyframes sway {
    0%, 100% { transform: rotate(-0.7deg) translateY(0); }
    50%      { transform: rotate(0.7deg) translateY(-1.5px); }
}

.anchor--speaking .anchor__body {
    animation: present 3.2s ease-in-out infinite;
}

@keyframes present {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-1.5px); }
}

/* -- on air ---------------------------------------------------------- */
.anchor__onair {
    position: absolute;
    top: 0.55rem;
    inset-inline-end: 0.55rem;
    padding: 0.14rem 0.45rem;
    border-radius: 0.3rem;
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    background: var(--sfs-danger, #d24b5a);
    color: var(--sfs-on-danger, #ffffff);
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 0.25s ease, transform 0.25s ease;
}

.anchor--speaking .anchor__onair {
    opacity: 1;
    transform: translateY(0);
    animation: onair 1.6s ease-in-out infinite;
}

@keyframes onair {
    0%, 100% { box-shadow: 0 0 0 0 rgb(var(--sfs-danger-rgb, 210 75 90) / 0.55); }
    50%      { box-shadow: 0 0 0 7px rgb(var(--sfs-danger-rgb, 210 75 90) / 0); }
}

/* -- caption --------------------------------------------------------- */
.anchor__label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    text-align: center;
    min-width: 0;
    width: 100%;
}

.anchor__name {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--sfs-text, #eef1f8);
}

.anchor__voice {
    font-size: 0.68rem;
    color: var(--sfs-text-muted, #a8b0c5);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
    /* The mouth stays: it is how you know who is speaking. Everything else is
       decoration and goes. */
    .eyes,
    .anchor__head,
    .anchor--speaking .anchor__body,
    .anchor--speaking .anchor__onair {
        animation: none;
    }
    .anchor--speaking .mouth-group {
        animation: talk 0.6s infinite steps(1, end);
    }
}
</style>
