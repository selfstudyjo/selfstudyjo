<template>
  <div class="sl-cm" :class="{ 'is-disabled': disabled, 'is-compact': compact }" dir="ltr">
    <div ref="host" class="sl-cm__host" />
    <div v-if="!compact" class="sl-cm__status" aria-live="off">
      <span>{{ $t('Ln') }} {{ cursor.line }}, {{ $t('Col') }} {{ cursor.col }}</span>
      <span v-if="cursor.selected">({{ cursor.selected }} {{ $t('selected') }})</span>
      <span class="sl-cm__spacer" />
      <span>{{ indentLabel }}</span>
      <span>UTF-8</span>
      <span>LF</span>
      <span class="sl-cm__lang">
        <FileIcon :path="path || 'file.txt'" />
        {{ language.name }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The lab editor: CodeMirror 6 with line numbers, folding, bracket matching,
 * auto-closing, multiple cursors, search and replace (Ctrl+F / Ctrl+H),
 * comment toggling (Ctrl+/), indentation that follows the language (Tab and
 * Shift+Tab indent the selection), and highlighting for every language in
 * `codeLanguages.ts`.
 *
 * PASTE IS VERBATIM. CodeMirror inserts the clipboard's text exactly - no
 * re-indentation, no trimming - which is what a textarea with a hand-written
 * Tab handler got wrong. Formatting is a separate, explicit command (Format,
 * Shift+Alt+F) that is one undo step.
 *
 * The parent owns the text (`v-model`); this component never writes anywhere.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { placeholder as cmPlaceholder } from '@codemirror/view';
import {
  EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine,
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentWithTab, toggleComment,
} from '@codemirror/commands';
import {
  foldGutter, indentOnInput, syntaxHighlighting, bracketMatching, foldKeymap,
  indentUnit, HighlightStyle,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { tags as tag } from '@lezer/highlight';
import FileIcon from './FileIcon.vue';
import { indentString, sniffLanguage, type Language } from '@/utils/codeLanguages';
import { formatCode, type FormatResult } from '@/utils/codeFormat';
import { loadLanguage } from '@/utils/codeEditorLangs';
import { useI18n } from '@/i18n/runtime';

const { t } = useI18n();

const props = defineProps<{
  modelValue: string; path: string; disabled?: boolean;
  /** No status bar - the code, query and web tools' own editors. */
  compact?: boolean;
  placeholder?: string;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'save'): void;
  (e: 'run'): void;
}>();

const host = ref<HTMLElement | null>(null);
const view = shallowRef<EditorView | null>(null);
const cursor = ref({ line: 1, col: 1, selected: 0 });
const languageBox = new Compartment();
const indentBox = new Compartment();
const editableBox = new Compartment();

const language = computed<Language>(() => sniffLanguage(props.path, props.modelValue));
const indentLabel = computed(() => (language.value.indent === 'tab'
  ? 'Tabs' : `Spaces: ${language.value.indent || 2}`));

/* The palette: VS Code Dark+-like, every pair over 4.5:1 on #1e1e1e. */
const highlight = HighlightStyle.define([
  { tag: [tag.keyword, tag.controlKeyword, tag.moduleKeyword, tag.definitionKeyword, tag.operatorKeyword], color: '#c586c0' },
  { tag: [tag.comment, tag.lineComment, tag.blockComment, tag.docComment], color: '#6a9955', fontStyle: 'italic' },
  { tag: [tag.string, tag.special(tag.string), tag.regexp, tag.character], color: '#ce9178' },
  { tag: [tag.number, tag.integer, tag.float], color: '#b5cea8' },
  { tag: [tag.bool, tag.null, tag.atom, tag.self], color: '#569cd6' },
  { tag: [tag.function(tag.variableName), tag.function(tag.propertyName), tag.macroName], color: '#dcdcaa' },
  { tag: [tag.typeName, tag.className, tag.namespace, tag.standard(tag.typeName)], color: '#4ec9b0' },
  { tag: [tag.propertyName, tag.attributeName, tag.labelName], color: '#9cdcfe' },
  { tag: [tag.variableName, tag.definition(tag.variableName)], color: '#9cdcfe' },
  { tag: [tag.tagName, tag.angleBracket], color: '#569cd6' },
  { tag: [tag.heading, tag.strong], color: '#569cd6', fontWeight: '700' },
  { tag: tag.emphasis, fontStyle: 'italic' },
  { tag: [tag.link, tag.url], color: '#4fc1ff', textDecoration: 'underline' },
  { tag: [tag.processingInstruction, tag.meta, tag.annotation], color: '#d7ba7d' },
  { tag: [tag.operator, tag.punctuation, tag.separator], color: '#d4d4d4' },
  { tag: [tag.inserted], color: '#89d185' },
  { tag: [tag.deleted], color: '#f48771' },
  { tag: tag.invalid, color: '#f44747' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#1e1e1e', color: '#d4d4d4', fontSize: '13.5px' },
  '.cm-scroller': {
    fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, Menlo, monospace",
    lineHeight: '1.55',
  },
  '.cm-content': { caretColor: '#aeafad', padding: '6px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#aeafad', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: '#264f78 !important',
  },
  '.cm-activeLine': { backgroundColor: '#ffffff0b' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#858585', border: 'none', borderRight: '1px solid #2d2d2d' },
  '.cm-activeLineGutter': { backgroundColor: '#ffffff0b', color: '#c6c6c6' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '3ch' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', cursor: 'pointer' },
  '.cm-matchingBracket': { backgroundColor: '#0064001a', outline: '1px solid #888' },
  '.cm-searchMatch': { backgroundColor: '#623315', outline: '1px solid #9e6a03' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#515c6a' },
  '.cm-selectionMatch': { backgroundColor: '#3a3d41' },
  '.cm-panels': { backgroundColor: '#252526', color: '#ccc' },
  '.cm-panels input, .cm-panels button': { color: '#ddd', background: '#3c3c3c', border: '1px solid #555', borderRadius: '3px' },
  '.cm-tooltip': { backgroundColor: '#252526', border: '1px solid #454545', color: '#ccc' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#04395e', color: '#fff' },
  '.cm-foldPlaceholder': { backgroundColor: '#3a3d41', border: 'none', color: '#ccc' },
}, { dark: true });

function indentFor(language: Language): Extension {
  return [indentUnit.of(indentString(language)),
    EditorState.tabSize.of(language.indent === 'tab' ? 4 : (language.indent || 2))];
}

let languageSeq = 0;
async function applyLanguage() {
  const current = view.value;
  if (!current) return;
  const seq = ++languageSeq;
  const support = await loadLanguage(language.value);
  if (seq !== languageSeq || !view.value) return;
  view.value.dispatch({ effects: [
    languageBox.reconfigure(support || []),
    indentBox.reconfigure(indentFor(language.value)),
  ] });
}

async function format(): Promise<FormatResult> {
  const current = view.value;
  if (!current) return { ok: false, text: '', error: 'No file is open.' };
  const before = current.state.doc.toString();
  const result = await formatCode(before, language.value);
  if (result.ok && result.text !== before && view.value) {
    // One transaction, so one Ctrl+Z undoes the whole format.
    const head = Math.min(view.value.state.selection.main.head, result.text.length);
    view.value.dispatch({ changes: { from: 0, to: view.value.state.doc.length, insert: result.text },
                          selection: { anchor: head }, userEvent: 'input.format' });
  }
  return result;
}

function focus() { view.value?.focus(); }

defineExpose({ format, focus, language });

const formatKey = keymap.of([
  { key: 'Shift-Alt-f', run: () => { void format(); return true; } },
  { key: 'Mod-Shift-i', run: () => { void format(); return true; } },
  { key: 'Mod-s', preventDefault: true, run: () => { emit('save'); return true; } },
  { key: 'Mod-Enter', preventDefault: true, run: () => { emit('run'); return true; } },
  { key: 'Mod-/', run: toggleComment },
]);

function buildState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(),
      foldGutter(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true),
      indentOnInput(), syntaxHighlighting(highlight), bracketMatching(), closeBrackets(),
      autocompletion({ activateOnTyping: true }), rectangularSelection(), crosshairCursor(),
      highlightActiveLine(), highlightSelectionMatches(),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap,
        ...foldKeymap, ...completionKeymap, indentWithTab]),
      formatKey,
      theme,
      props.placeholder ? cmPlaceholder(props.placeholder) : [],
      languageBox.of([]),
      indentBox.of(indentFor(language.value)),
      editableBox.of(EditorView.editable.of(!props.disabled)),
      EditorView.contentAttributes.of({ 'aria-label': t('File contents'), spellcheck: 'false',
                                        autocorrect: 'off', autocapitalize: 'off' }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString();
          if (text !== props.modelValue) emit('update:modelValue', text);
        }
        if (update.selectionSet || update.docChanged) {
          const sel = update.state.selection.main;
          const line = update.state.doc.lineAt(sel.head);
          cursor.value = { line: line.number, col: sel.head - line.from + 1,
                           selected: Math.abs(sel.to - sel.from) };
        }
      }),
    ],
  });
}

onMounted(() => {
  const state = buildState(props.modelValue);
  view.value = new EditorView({ state, parent: host.value as HTMLElement });
  void applyLanguage();
});

// The parent replaced the text (another tab, a reload, a save that formatted):
// swap the document without emitting it back.
watch(() => props.modelValue, (value) => {
  const current = view.value;
  if (!current || current.state.doc.toString() === value) return;
  current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } });
});
watch(() => props.path, (next, previous) => {
  // A different file: a fresh state, so Ctrl+Z cannot undo into the last one.
  if (next !== previous && view.value) {
    view.value.setState(buildState(props.modelValue));
    void applyLanguage();
  }
});
watch(() => language.value.id, () => { void applyLanguage(); });
watch(() => props.disabled, (value) => {
  view.value?.dispatch({ effects: editableBox.reconfigure(EditorView.editable.of(!value)) });
});

onBeforeUnmount(() => { view.value?.destroy(); view.value = null; });
</script>

<style scoped>
.sl-cm { display: flex; flex-direction: column; min-height: 22rem; height: 100%; border: 1px solid #2d2d2d;
  border-radius: 0 0 6px 6px; overflow: hidden; background: #1e1e1e; }
.sl-cm__host { flex: 1 1 auto; min-height: 0; overflow: hidden; }
.sl-cm__host :deep(.cm-editor) { height: 100%; }
.sl-cm__host :deep(.cm-editor.cm-focused) { outline: none; }
.sl-cm.is-disabled { opacity: 0.6; }
.sl-cm.is-compact { min-height: 12rem; border-radius: 6px; }
.sl-cm :deep(.cm-placeholder) { color: #6e7681; }
.sl-cm__status { flex: none; display: flex; align-items: center; gap: 1rem; padding: 0.15rem 0.75rem;
  background: #007acc; color: #fff; font-size: 12px; font-family: system-ui, sans-serif; white-space: nowrap;
  overflow: hidden; }
.sl-cm__spacer { flex: 1; }
.sl-cm__lang { display: inline-flex; align-items: center; gap: 0.35rem; }
</style>
