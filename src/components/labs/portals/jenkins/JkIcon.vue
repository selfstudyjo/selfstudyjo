<template>
  <!-- Jenkins' symbol set is Ionicons-outline style: 512 grid, round caps, 32px strokes. -->
  <svg class="jk-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"
       fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round">
    <template v-if="name === 'search'">
      <path d="M221 400a179 179 0 1 1 179-179 179 179 0 0 1-179 179z" /><path d="M338 338l126 126" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M427 362c-26-32-44-48-44-136 0-81-41-110-75-124-4-2-9-6-10-11-6-20-23-38-42-38s-36 18-42 38c-1 5-6 9-10 11-34 14-75 43-75 124 0 88-18 104-44 136-11 13-1 34 18 34h306c19 0 29-21 18-34z" /><path d="M320 384v16a64 64 0 0 1-128 0v-16" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M463 113c-83-11-147-37-207-81-60 44-124 70-207 81-14 194 110 315 207 367 97-52 221-173 207-367z" /><path d="M256 168v104M256 336v8" />
    </template>
    <template v-else-if="name === 'user'">
      <path d="M344 144c-4 53-44 96-88 96s-84-43-88-96c-4-55 35-96 88-96s92 42 88 96z" /><path d="M256 304c-87 0-175 48-191 139-2 11 4 21 15 21h352c11 0 17-10 15-21-16-91-104-139-191-139z" />
    </template>
    <template v-else-if="name === 'chevron'"><path d="M184 112l144 144-144 144" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="M112 184l144 144 144-144" /></template>
    <template v-else-if="name === 'plus'"><path d="M256 112v288M400 256H112" /></template>
    <template v-else-if="name === 'history'">
      <path d="M256 64C150 64 64 150 64 256s86 192 192 192 192-86 192-192" /><path d="M256 128v144h96" /><path d="M416 64v96h-96" />
    </template>
    <template v-else-if="name === 'gear'">
      <path d="M262 179a77 77 0 1 0 71 71 77 77 0 0 0-71-71zm154 77a157 157 0 0 1-2 25l46 37a11 11 0 0 1 2 14l-44 76a11 11 0 0 1-13 5l-46-18a16 16 0 0 0-15 2 162 162 0 0 1-24 14 16 16 0 0 0-9 12l-7 49a11 11 0 0 1-11 9h-88a11 11 0 0 1-11-9l-7-49a16 16 0 0 0-9-12 156 156 0 0 1-24-14 16 16 0 0 0-15-2l-46 18a11 11 0 0 1-13-5l-44-76a11 11 0 0 1 2-14l39-31a16 16 0 0 0 6-14 128 128 0 0 1 0-28 16 16 0 0 0-6-14l-39-31a11 11 0 0 1-2-14l44-76a11 11 0 0 1 13-5l46 18a16 16 0 0 0 15-2 162 162 0 0 1 24-14 16 16 0 0 0 9-12l7-49a11 11 0 0 1 11-9h88a11 11 0 0 1 11 9l7 49a16 16 0 0 0 9 12 156 156 0 0 1 24 14 16 16 0 0 0 15 2l46-18a11 11 0 0 1 13 5l44 76a11 11 0 0 1-2 14l-39 31a16 16 0 0 0-6 14c1 5 1 9 1 14z" />
    </template>
    <template v-else-if="name === 'views'">
      <rect x="64" y="64" width="160" height="160" rx="24" /><rect x="288" y="64" width="160" height="160" rx="24" /><rect x="64" y="288" width="160" height="160" rx="24" /><rect x="288" y="288" width="160" height="160" rx="24" />
    </template>
    <template v-else-if="name === 'status'">
      <path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192z" /><path d="M352 176L217 336l-57-64" />
    </template>
    <template v-else-if="name === 'changes'">
      <path d="M304 96h112v112M405 107L240 272M368 304v96a48 48 0 0 1-48 48H112a48 48 0 0 1-48-48V192a48 48 0 0 1 48-48h96" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192z" /><path d="M216 176l112 80-112 80z" />
    </template>
    <template v-else-if="name === 'clock-play'">
      <path d="M256 64C150 64 64 150 64 256s86 192 192 192" /><path d="M256 128v128l64 40" /><path d="M352 336l96 56-96 56z" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M112 112l20 320c1 18 14 32 32 32h184c18 0 31-14 32-32l20-320" /><path d="M80 112h352M192 112V72a24 24 0 0 1 24-24h80a24 24 0 0 1 24 24v40M256 176v224M184 176l8 224M328 176l-8 224" />
    </template>
    <template v-else-if="name === 'stages'">
      <rect x="48" y="96" width="112" height="320" rx="24" /><rect x="200" y="96" width="112" height="320" rx="24" /><rect x="352" y="96" width="112" height="320" rx="24" />
    </template>
    <template v-else-if="name === 'pencil'">
      <path d="M364 136l-252 252-16 64 64-16 252-252zM420 80a33 33 0 0 0-47 0l-9 9 47 47 9-9a33 33 0 0 0 0-47z" />
    </template>
    <template v-else-if="name === 'help'">
      <path d="M256 80a176 176 0 1 0 176 176A176 176 0 0 0 256 80z" /><path d="M200 202s1-24 26-44c15-12 33-15 49-15 15 0 28 3 36 7 13 6 39 21 39 53 0 34-22 49-47 66s-31 35-31 54" /><path d="M272 364v4" stroke-width="40" />
    </template>
    <template v-else-if="name === 'terminal'">
      <rect x="32" y="48" width="448" height="416" rx="48" /><path d="M96 112l80 64-80 64M192 240h64" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M160 144h288M160 256h288M160 368h288" /><circle cx="80" cy="144" r="16" /><circle cx="80" cy="256" r="16" /><circle cx="80" cy="368" r="16" />
    </template>
    <template v-else-if="name === 'replay'">
      <path d="M400 148l-21-23a192 192 0 1 0 41 99" /><path d="M464 98v86a10 10 0 0 1-10 10h-86" />
    </template>
    <template v-else-if="name === 'overview'">
      <circle cx="96" cy="256" r="40" /><circle cx="256" cy="256" r="40" /><circle cx="416" cy="256" r="40" /><path d="M136 256h80M296 256h80" />
    </template>
    <template v-else-if="name === 'folder'">
      <path d="M440 432H72a40 40 0 0 1-40-40V120a40 40 0 0 1 40-40h75a40 40 0 0 1 22 7l28 18a40 40 0 0 0 22 7h221a40 40 0 0 1 40 40v240a40 40 0 0 1-40 40z" /><path d="M32 192h448" />
    </template>
    <template v-else-if="name === 'pipeline'">
      <circle cx="96" cy="128" r="48" /><circle cx="416" cy="128" r="48" /><circle cx="256" cy="384" r="48" /><path d="M144 128h224M128 166l96 176M384 166l-96 176" />
    </template>
    <template v-else-if="name === 'freestyle'">
      <path d="M448 341V171a32 32 0 0 0-16-28L272 51a32 32 0 0 0-32 0L80 143a32 32 0 0 0-16 28v170a32 32 0 0 0 16 28l160 92a32 32 0 0 0 32 0l160-92a32 32 0 0 0 16-28z" /><path d="M69 153l187 111 187-111M256 464V264" />
    </template>
    <template v-else-if="name === 'branch'">
      <circle cx="160" cy="96" r="48" /><circle cx="160" cy="416" r="48" /><circle cx="352" cy="176" r="48" /><path d="M160 144v224M352 224c0 96-192 64-192 144" />
    </template>
    <template v-else-if="name === 'key'">
      <path d="M218 251c-11-17-18-37-18-59a104 104 0 1 1 104 104c-22 0-43-7-60-19L64 448v-64l48-48v-48h48l32-32" /><circle cx="336" cy="160" r="24" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'computer'">
      <rect x="32" y="64" width="448" height="320" rx="32" /><path d="M304 448l-8-64h-80l-8 64h96zM368 448H144" />
    </template>
    <template v-else-if="name === 'puzzle'">
      <path d="M413 249h-29v-79a43 43 0 0 0-43-43h-79V98a50 50 0 0 0-100 0v29H83a43 43 0 0 0-43 43v76h28a54 54 0 0 1 54 54 54 54 0 0 1-54 54H40v76a43 43 0 0 0 43 43h76v-28a54 54 0 0 1 54-54 54 54 0 0 1 54 54v28h74a43 43 0 0 0 43-43v-79h29a50 50 0 0 0 0-100z" />
    </template>
    <template v-else-if="name === 'info'">
      <path d="M248 64C146 64 64 146 64 248s82 184 184 184 184-82 184-184S350 64 248 64z" /><path d="M220 220h32v116M208 340h88" /><path d="M248 156v4" stroke-width="40" />
    </template>
    <template v-else-if="name === 'cloud'">
      <path d="M400 240c-8-82-62-128-128-128-62 0-102 41-115 82-54 5-97 39-97 95 0 54 44 87 98 87h236c45 0 82-23 82-72 0-49-40-64-76-64z" />
    </template>
    <template v-else-if="name === 'hammer'">
      <path d="M278 232L83 427a32 32 0 0 1-45-45l195-195M320 272L240 192l64-64 32-16 80 80-16 32z" /><path d="M347 101l-43 27 80 80 27-43" />
    </template>
    <template v-else-if="name === 'doc'">
      <path d="M416 221v203a40 40 0 0 1-40 40H136a40 40 0 0 1-40-40V88a40 40 0 0 1 40-40h107a40 40 0 0 1 28 12l133 133a40 40 0 0 1 12 28z" /><path d="M256 56v120a32 32 0 0 0 32 32h120M176 288h160M176 368h160" />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M32 32v448h448" /><path d="M96 384V256M192 384V176M288 384V224M384 384V112" />
    </template>
    <template v-else-if="name === 'people'">
      <path d="M402 168c-3 41-34 72-66 72s-63-31-66-72c-3-42 26-72 66-72s69 31 66 72z" /><path d="M336 304c-65 0-128 32-144 95-2 8 3 17 12 17h264c9 0 14-8 12-17-16-63-79-95-144-95z" /><path d="M200 183c-3 33-27 58-53 58s-51-25-53-58c-3-34 21-59 53-59s56 26 53 59zM206 306c-18-8-38-11-59-11-52 0-102 27-114 79-2 7 3 14 10 14h112" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M336 176h40a40 40 0 0 1 40 40v208a40 40 0 0 1-40 40H136a40 40 0 0 1-40-40V216a40 40 0 0 1 40-40h40" /><path d="M176 272l80 80 80-80M256 48v288" />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="128" y="128" width="336" height="336" rx="57" /><path d="M383 128l1-24a56 56 0 0 0-56-56H112a64 64 0 0 0-64 64v216a56 56 0 0 0 56 56h24" />
    </template>
    <template v-else-if="name === 'menu'"><path d="M80 160h352M80 256h352M80 352h352" /></template>
    <template v-else-if="name === 'close'"><path d="M368 368L144 144M368 144L144 368" /></template>
    <template v-else-if="name === 'reload'">
      <path d="M320 146s24-12-64-12a160 160 0 1 0 160 160" /><path d="M256 58l80 80-80 80" />
    </template>
    <template v-else-if="name === 'power'">
      <path d="M378 108a191 191 0 0 1 70 148c0 106-86 192-192 192S64 362 64 256a192 192 0 0 1 69-148M256 64v192" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22 0 48 18 48 40v40M368 336l80-80-80-80M176 256h256" />
    </template>
    <template v-else-if="name === 'artifact'">
      <path d="M448 341V171a32 32 0 0 0-16-28L272 51a32 32 0 0 0-32 0L80 143a32 32 0 0 0-16 28v170a32 32 0 0 0 16 28l160 92a32 32 0 0 0 32 0l160-92a32 32 0 0 0 16-28z" />
    </template>
    <template v-else>
      <circle cx="256" cy="256" r="160" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<style scoped>
.jk-icon { width: 20px; height: 20px; flex: none; display: inline-block; vertical-align: middle; }
</style>
