<template>
  <div class="qp" :class="{ 'qp--compact': compact }" dir="ltr">
    <header class="qp-nav">
      <button v-for="link in nav" :key="link.id" type="button" class="qp-nav__link"
              :class="{ 'qp-nav__brand': link.id === 'nav-home' }" :disabled="busy" @click="press(link.id)">
        <span v-if="link.id === 'nav-home'" class="qp-logo" aria-hidden="true">QA</span>
        {{ link.text }}
      </button>
    </header>

    <main class="qp-body">
      <template v-for="el in body" :key="el.id">
        <h1 v-if="el.tag === 'h1'" class="qp-h1">{{ el.text }}</h1>
        <p v-else-if="el.tag === 'p'" class="qp-p" :class="'qp-p--' + el.id">{{ el.text }}</p>
        <pre v-else-if="el.tag === 'pre'" class="qp-pre">{{ el.text }}</pre>
        <div v-else-if="el.tag === 'img'" class="qp-img" role="img" :aria-label="el.name || undefined">
          <svg viewBox="0 0 120 60" width="120" height="60" aria-hidden="true">
            <rect x="20" y="16" width="60" height="34" rx="4" fill="#f6c177" />
            <path d="M20 26h60M50 16v34" stroke="#c98c3a" stroke-width="3" />
            <path d="M86 40h18l6-8" stroke="#64748b" stroke-width="3" fill="none" />
          </svg>
          <span v-if="!el.name" class="qp-img__warn">image has no alt text</span>
        </div>
        <div v-else-if="el.cls === 'product-card'" class="qp-card" :data-testid="el.testid">
          <div class="qp-card__thumb" aria-hidden="true">{{ initials(el.text) }}</div>
          <div class="qp-card__text">{{ el.text }}</div>
          <a v-if="viewLink(el)" href="#" class="qp-link qp-card__go" @click.prevent="press(viewLink(el))">View &rsaquo;</a>
        </div>
        <div v-else-if="el.cls === 'cart-row' || el.testid === 'search-result'" class="qp-row">{{ el.text }}</div>
        <label v-else-if="el.tag === 'input'" class="qp-field">
          <span class="qp-field__label">{{ el.label || '(no label)' }}</span>
          <input :type="el.id === 'password' ? 'password' : el.role === 'spinbutton' ? 'number' : 'text'"
                 class="qp-input" :value="valueOf(el)" :disabled="busy"
                 @input="setValue(el.id, ($event.target as HTMLInputElement).value)"
                 @keydown.enter.prevent="submitNearest(el.id)">
        </label>
        <button v-else-if="el.tag === 'button'" type="button" class="qp-btn"
                :class="{ 'qp-btn--primary': primary(el), 'qp-btn--offscreen': !el.visible }"
                :disabled="busy" :data-testid="el.testid || undefined"
                @click="press(el.id)">{{ el.text }}</button>
        <a v-else-if="el.tag === 'a' && !isCardLink(el)" href="#" class="qp-link" @click.prevent="press(el.id)">{{ el.text }} &rsaquo;</a>
        <div v-else-if="el.role === 'alert' || el.role === 'status'" v-show="el.text" class="qp-alert"
             :class="el.role === 'alert' ? 'qp-alert--error' : 'qp-alert--info'" :role="el.role">{{ el.text }}</div>
        <span v-else-if="el.tag === 'span'" class="qp-money" :class="'qp-money--' + el.id">
          <b>{{ moneyLabel(el.id) }}</b> {{ el.text }}
        </span>
        <div v-else class="qp-p">{{ el.text }}</div>
      </template>
    </main>
    <footer class="qp-foot">QA Shop build {{ build }} &middot; test environment</footer>
  </div>
</template>

<script setup lang="ts">
/**
 * QA Shop as a browser draws it: the elements the engine laid out for this
 * page at this device width (the same list `pytest`'s page sees), rendered as
 * a real shop. Inputs are local until a button is pressed; then the parent
 * sends `qa ui fill` for each changed field and `qa ui click` for the button.
 */
import { computed, reactive, watch } from 'vue';
import type { QaElement, QaPageView } from './qaKit';

const props = defineProps<{ page: QaPageView; busy?: boolean; compact?: boolean; build?: string }>();
const emit = defineEmits<{ (e: 'act', fills: Record<string, string>, clickId: string): void }>();

const nav = computed(() => props.page.elements.filter(el => el.id.startsWith('nav-')));
const body = computed(() => props.page.elements.filter(el => !el.id.startsWith('nav-')));

const edits = reactive<Record<string, string>>({});
watch(() => props.page.path + '|' + props.page.elements.map(e => e.id + '=' + e.value).join(','), () => {
    for (const key of Object.keys(edits)) delete edits[key];
});

function valueOf(el: QaElement) {
    return el.id in edits ? edits[el.id] : el.value;
}
function setValue(id: string, value: string) {
    edits[id] = value;
}
function dirty(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const el of props.page.elements) {
        if (el.tag === 'input' && el.id in edits && edits[el.id] !== el.value) out[el.id] = edits[el.id];
    }
    return out;
}
function press(id: string) {
    emit('act', dirty(), id);
}
function submitNearest(fieldId: string) {
    const list = props.page.elements;
    const start = list.findIndex(el => el.id === fieldId);
    const button = list.slice(start).find(el => el.tag === 'button' && el.visible);
    if (button) press(button.id);
}
// A product card's "View" link is its own element in the page model; it is
// drawn inside its card, the way the shop lays it out.
function viewLink(el: QaElement) {
    const id = el.id.replace(/^product-/, 'view-');
    return props.page.elements.some(e => e.id === id) ? id : '';
}
function isCardLink(el: QaElement) {
    return /^view-\d+$/.test(el.id) && props.page.elements.some(e => e.id === el.id.replace('view-', 'product-'));
}
function primary(el: QaElement) {
    return ['login', 'add-to-cart', 'checkout', 'place-order'].includes(el.id);
}
function initials(text: string) {
    return text.split(' ').slice(0, 2).map(w => w[0] || '').join('');
}
function moneyLabel(id: string) {
    return ({ subtotal: 'Subtotal', discount: 'Discount', total: 'Total' } as Record<string, string>)[id] || '';
}
</script>

<style scoped>
.qp { --qp-ink: #1f2937; --qp-muted: #6b7280; --qp-brand: #0f766e; --qp-line: #e5e7eb;
  background: #fff; color: var(--qp-ink); font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  min-height: 100%; display: flex; flex-direction: column; }
.qp-nav { display: flex; gap: 4px; align-items: center; padding: 10px 16px; background: #0f172a; flex-wrap: wrap; }
.qp-nav__link { background: none; border: 0; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; cursor: pointer; font: inherit; }
.qp-nav__link:hover { background: rgba(255,255,255,.1); }
.qp-nav__brand { font-weight: 700; margin-right: auto; display: inline-flex; align-items: center; gap: 8px; color: #fff; }
.qp-logo { background: #14b8a6; color: #04201d; border-radius: 6px; padding: 1px 6px; font-size: 12px; }
.qp-body { flex: 1; padding: 20px 24px; display: grid; gap: 12px; align-content: start;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.qp-body > :not(.qp-card) { grid-column: 1 / -1; }
.qp-h1 { font-size: 24px; margin: 4px 0 4px; }
.qp-p { margin: 0; color: var(--qp-ink); }
.qp-p--price { font-size: 22px; font-weight: 700; color: var(--qp-brand); }
.qp-p--fineprint { color: #c4c4c4; font-size: 12px; }
.qp-pre { background: #fef2f2; color: #991b1b; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 12px; margin: 0; }
.qp-card { border: 1px solid var(--qp-line); border-radius: 10px; padding: 12px; display: flex; gap: 10px; align-items: center; }
.qp-card__text { flex: 1; }
.qp-card__go { white-space: nowrap; }
.qp-card__thumb { width: 44px; height: 44px; border-radius: 8px; background: #ccfbf1; color: #115e59; display: grid; place-items: center; font-weight: 700; }
.qp-link { color: var(--qp-brand); font-weight: 600; text-decoration: none; align-self: center; }
.qp-link:hover { text-decoration: underline; }
.qp-row { border-bottom: 1px solid var(--qp-line); padding: 8px 0; }
.qp-field { display: grid; gap: 4px; max-width: 420px; }
.qp-field__label { font-size: 13px; font-weight: 600; color: var(--qp-muted); }
.qp-input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 12px; font: inherit; color: var(--qp-ink); background: #fff; }
.qp-input:focus { outline: 2px solid #5eead4; border-color: var(--qp-brand); }
.qp-btn { justify-self: start; border: 1px solid #cbd5e1; background: #fff; color: var(--qp-ink); border-radius: 8px;
  padding: 9px 18px; font: inherit; font-weight: 600; cursor: pointer; }
.qp-btn--primary { background: var(--qp-brand); border-color: var(--qp-brand); color: #fff; }
.qp-btn:disabled { opacity: .6; cursor: progress; }
/* An element the layout pushed off-screen on this viewport: drawn the way the
   page actually shows it - clipped past the right edge, unreachable. */
.qp-btn--offscreen { position: relative; left: 120%; pointer-events: none; }
.qp-alert { padding: 10px 12px; border-radius: 8px; }
.qp-alert--error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.qp-alert--info { background: #f0fdfa; color: #115e59; border: 1px solid #99f6e4; }
.qp-money { display: flex; justify-content: space-between; max-width: 320px; }
.qp-money--total { font-size: 18px; border-top: 1px solid var(--qp-line); padding-top: 6px; }
.qp-img { display: flex; align-items: center; gap: 12px; }
.qp-img__warn { font-size: 11px; color: #b45309; background: #fffbeb; border-radius: 4px; padding: 2px 6px; }
.qp-foot { padding: 10px 24px; color: var(--qp-muted); font-size: 12px; border-top: 1px solid var(--qp-line); }
.qp--compact .qp-body { padding: 14px; grid-template-columns: 1fr; }
.qp--compact .qp-h1 { font-size: 20px; }
.qp--compact .qp-nav { padding: 8px 10px; }
</style>
