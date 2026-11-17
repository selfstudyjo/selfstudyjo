/**
 * CodeMirror language loading for the lab editor. Imported ONLY by
 * CodeEditor.vue, which is itself an async chunk - so neither CodeMirror nor any
 * grammar is downloaded by a page without an editor on it.
 *
 * `@codemirror/language-data` describes ~150 languages and loads each grammar
 * on demand. HCL/Terraform is not among them, so it is a StreamLanguage here:
 * comments (#, //, block), strings with ${...} interpolation, heredocs, numbers,
 * block keywords, attribute names and function calls.
 */
import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import type { Language } from './codeLanguages';

interface HclState { inComment: boolean; inString: boolean; interp: number; heredoc: string | null }

const HCL_BLOCKS = /^(resource|data|variable|output|locals|module|provider|terraform|backend|required_providers|provisioner|lifecycle|dynamic|content|moved|import|check|removed|statement|principals|condition|ingress|egress|tags|filter|connection)\b/;
const HCL_WORDS = /^(true|false|null|for|in|if|else|endif|endfor)\b/;

const hcl = StreamLanguage.define<HclState>({
  name: 'hcl',
  startState: () => ({ inComment: false, inString: false, interp: 0, heredoc: null }),
  token(stream, state) {
    if (state.heredoc) {
      if (stream.sol() && stream.string.trim() === state.heredoc) {
        stream.skipToEnd(); state.heredoc = null; return 'keyword';
      }
      stream.skipToEnd(); return 'string';
    }
    if (state.inComment) {
      if (stream.skipTo('*/')) { stream.match('*/'); state.inComment = false; } else stream.skipToEnd();
      return 'comment';
    }
    if (state.inString) {
      if (state.interp > 0) {
        if (stream.eat('}')) { state.interp -= 1; return 'processingInstruction'; }
        if (stream.eat('{')) { state.interp += 1; return null; }
        if (stream.match(/^[A-Za-z_][\w.-]*/)) return 'variableName';
        stream.next(); return null;
      }
      if (stream.match('${') || stream.match('%{')) { state.interp = 1; return 'processingInstruction'; }
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '\\') { stream.next(); continue; }
        if (ch === '"') { state.inString = false; return 'string'; }
        if ((ch === '$' || ch === '%') && stream.peek() === '{') { stream.backUp(1); return 'string'; }
      }
      return 'string';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('#') || stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.inComment = true; return 'comment'; }
    const heredoc = stream.match(/^<<-?([A-Za-z_]\w*)\s*$/) as RegExpMatchArray | null;
    if (heredoc) { state.heredoc = heredoc[1]; return 'keyword'; }
    if (stream.eat('"')) { state.inString = true; return 'string'; }
    if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return 'number';
    if (stream.sol() || /^\s*$/.test(stream.string.slice(0, stream.pos))) {
      if (stream.match(HCL_BLOCKS)) return 'keyword';
    }
    if (stream.match(HCL_WORDS)) return 'atom';
    if (stream.match(/^[A-Za-z_][\w-]*(?=\s*\()/)) return 'function';
    if (stream.match(/^[A-Za-z_][\w-]*(?=\s*=[^=])/)) return 'propertyName';
    if (stream.match(/^(var|local|module|data|each|count|path|terraform|self)(?=\.)/)) return 'typeName';
    if (stream.match(/^[A-Za-z_][\w-]*/)) return 'variableName';
    if (stream.match(/^(==|!=|<=|>=|&&|\|\||=>|[=+\-*/%<>!?:])/)) return 'operator';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '#', block: { open: '/*', close: '*/' } },
                  closeBrackets: { brackets: ['(', '[', '{', '"'] } },
});

const cache = new Map<string, Promise<LanguageSupport | null>>();

/** The CodeMirror support for one registry language, or null for plain text. */
export function loadLanguage(language: Language): Promise<LanguageSupport | null> {
  const key = language.mode;
  if (!cache.has(key)) {
    let job: Promise<LanguageSupport | null>;
    if (key === 'hcl') job = Promise.resolve(new LanguageSupport(hcl));
    else if (!key || key === 'null') job = Promise.resolve(null);
    else {
      const found = LanguageDescription.matchLanguageName(languages, key, true);
      job = found ? found.load().catch(() => null) : Promise.resolve(null);
    }
    cache.set(key, job);
  }
  return cache.get(key) as Promise<LanguageSupport | null>;
}
