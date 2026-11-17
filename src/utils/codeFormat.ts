/**
 * Format a whole file, by language - the editor's Format command.
 *
 * Prettier (JS/TS/CSS/HTML/Vue/Markdown/YAML/GraphQL/JSON) and sql-formatter
 * are DYNAMIC imports, so neither is in any chunk until somebody presses Format.
 * Everything else is written here, as plain functions `check:codeeditor` drives
 * in node: HCL/Terraform (two-space nesting and `=` aligned across a run, the
 * same rules as `terraform fmt` in app 11), Python (indentation normalised to
 * four-space levels WITHOUT changing which block a line belongs to), shell,
 * any brace language, XML, Dockerfile, INI/TOML and plain lines.
 *
 * Three properties every formatter here keeps, because each is a way to break
 * a working file:
 *   - a heredoc body, a block comment and a multi-line string are left exactly
 *     as they were;
 *   - a file that does not parse is NEVER rewritten - the caller is told why;
 *   - formatting twice gives the same text as formatting once.
 */
import { indentString, type Language } from './codeLanguages';

export interface FormatResult {
  ok: boolean;
  text: string;
  /** Why nothing was changed: a parse error, or no formatter for the language. */
  error?: string;
}

const tidyEnd = (text: string) => {
  const body = text.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}$/g, '\n');
  return body.replace(/\s*$/, '') + (body.trim() ? '\n' : '');
};

/* ── HCL / Terraform ─────────────────────────────────────────────────────── */

function hclScan(text: string, inComment: boolean) {
  let delta = 0;
  let lead = 0;
  let seen = false;
  let inStr = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inComment) {
      if (text.startsWith('*/', i)) { inComment = false; i += 1; }
      continue;
    }
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; seen = true; }
    else if (ch === '#' || text.startsWith('//', i)) break;
    else if (text.startsWith('/*', i)) { inComment = true; i += 1; }
    else if ('{[('.includes(ch)) { delta += 1; seen = true; }
    else if ('}])'.includes(ch)) { delta -= 1; if (!seen) lead += 1; }
    else if (!/\s/.test(ch)) seen = true;
  }
  return { delta, lead, inComment };
}

/** `=` aligned over runs of single-line `name = value` at one indentation. */
function alignEquals(lines: string[]): string[] {
  const attr = /^(\s*)([A-Za-z_][\w-]*|"[^"]*")\s*=\s*(.*)$/;
  const out = [...lines];
  let run: { i: number; ind: string; name: string; value: string }[] = [];
  const close = () => {
    if (run.length > 1) {
      const width = Math.max(...run.map(r => r.name.length));
      for (const r of run) out[r.i] = `${r.ind}${r.name.padEnd(width)} = ${r.value}`;
    }
    run = [];
  };
  lines.forEach((line, i) => {
    const m = attr.exec(line);
    const simple = m && !/[{[(]\s*$/.test(m[3]) && !m[3].includes('<<') && !/^=/.test(m[3]);
    if (simple && m && (!run.length || run[run.length - 1].ind === m[1])) {
      run.push({ i, ind: m[1], name: m[2], value: m[3].trim() });
      return;
    }
    close();
    if (simple && m) run.push({ i, ind: m[1], name: m[2], value: m[3].trim() });
  });
  close();
  return out;
}

export function formatHcl(body: string): FormatResult {
  const rows = String(body).replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
  const out: string[] = [];
  let depth = 0;
  let inComment = false;
  let heredoc: { word: string; level: number; dash: boolean } | null = null;
  for (const raw of rows) {
    if (heredoc) {
      out.push(raw);
      if (raw.trim() === heredoc.word) {
        out[out.length - 1] = heredoc.dash ? '  '.repeat(heredoc.level) + raw.trim() : raw.trim();
        heredoc = null;
      }
      continue;
    }
    if (inComment) {
      out.push(raw.replace(/\s+$/, ''));
      inComment = hclScan(raw, true).inComment;
      continue;
    }
    const text = raw.trim();
    if (!text) { out.push(''); continue; }
    const scan = hclScan(text, false);
    inComment = scan.inComment;
    const level = Math.max(0, depth - scan.lead);
    out.push('  '.repeat(level) + text);
    depth = Math.max(0, depth + scan.delta);
    const marker = /<<(-?)([A-Za-z_]\w*)\s*$/.exec(text);
    if (marker && !/^(#|\/\/)/.test(text)) heredoc = { word: marker[2], level, dash: marker[1] === '-' };
  }
  if (heredoc) return { ok: false, text: body, error: `The heredoc is not closed: no "${heredoc.word}" line.` };
  if (depth !== 0) return { ok: false, text: body, error: 'A { or [ is not closed - fix that first, then format.' };
  return { ok: true, text: tidyEnd(alignEquals(out).join('\n').replace(/\n{3,}/g, '\n\n')) };
}

/* ── Python ──────────────────────────────────────────────────────────────── */

/**
 * Re-indent to four-space levels. A line's LEVEL is decided from the stack of
 * indentation widths seen so far, exactly as the Python tokenizer decides
 * INDENT/DEDENT - so a block mixing 2 and 3 spaces maps onto 4 and 8 and no
 * line moves to a different block. Continuation lines (inside brackets, after
 * a backslash) and triple-quoted strings are kept relative, never re-levelled.
 */
export function formatPython(body: string, unit = '    '): FormatResult {
  const rows = String(body).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const stack: number[] = [0];
  let depth = 0;
  let triple: string | null = null;
  let continued = false;
  let shift = 0;
  for (const raw of rows) {
    if (triple) {
      out.push(raw);
      if (raw.includes(triple)) triple = null;
      continue;
    }
    const expanded = raw.replace(/^[ \t]+/, m => m.replace(/\t/g, '        '));
    const text = expanded.trim();
    if (!text) { out.push(''); continue; }
    const width = expanded.length - expanded.trimStart().length;
    if (depth > 0 || continued) {
      out.push(' '.repeat(Math.max(0, width + shift)) + text);
    } else {
      if (text.startsWith('#') && width > stack[stack.length - 1]) {
        out.push(unit.repeat(stack.length - 1) + text);
      } else {
        if (width > stack[stack.length - 1]) stack.push(width);
        else {
          while (stack.length > 1 && width < stack[stack.length - 1]) stack.pop();
          if (width !== stack[stack.length - 1]) {
            return { ok: false, text: body,
              error: `IndentationError on "${text.slice(0, 40)}": unindent does not match any outer level.` };
          }
        }
        const level = stack.length - 1;
        shift = level * unit.length - width;
        out.push(unit.repeat(level) + text);
      }
    }
    // Track brackets and triple quotes outside strings and comments.
    let quote: string | null = null;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') { i += 1; continue; }
        if (text.startsWith(quote, i)) { i += quote.length - 1; quote = null; }
        continue;
      }
      if (ch === '#') break;
      if (text.startsWith('"""', i) || text.startsWith("'''", i)) {
        const q = text.slice(i, i + 3);
        const close = text.indexOf(q, i + 3);
        if (close < 0) { triple = q; break; }
        i = close + 2;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if ('([{'.includes(ch)) depth += 1;
      else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    }
    continued = /\\$/.test(text) && !triple;
  }
  let joined = out.join('\n').replace(/[ \t]+$/gm, '');
  joined = joined.replace(/\n{4,}/g, '\n\n\n');
  return { ok: true, text: tidyEnd(joined) };
}

/* ── shell ───────────────────────────────────────────────────────────────── */

export function formatShell(body: string, unit = '  '): FormatResult {
  const rows = String(body).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let depth = 0;
  let heredoc: { word: string; dash: boolean } | null = null;
  let continued = false;
  for (const raw of rows) {
    if (heredoc) {
      out.push(raw);
      const probe = heredoc.dash ? raw.replace(/^\t+/, '') : raw;
      if (probe === heredoc.word || probe.trim() === heredoc.word) heredoc = null;
      continue;
    }
    const text = raw.trim();
    if (!text) { out.push(''); continue; }
    if (continued) {
      out.push(unit.repeat(depth + 1) + text);
      continued = /\\$/.test(text);
      continue;
    }
    // Strings and comments cannot open or close anything.
    const code = text.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""').replace(/(^|\s)#.*$/, '').trim();
    const closer = /^(fi|done|esac|\})(\s|;|$)/.test(code) || /^\)/.test(code);
    const middle = /^(else|elif)\b/.test(code);
    const level = Math.max(0, depth - (closer || middle ? 1 : 0));
    out.push(unit.repeat(level) + text);
    if (/^esac\b/.test(code)) depth = Math.max(0, depth - 2);
    else if (closer) depth = Math.max(0, depth - 1);
    if (!middle && (/(^|[;\s])(then|do)$/.test(code) || /\{$/.test(code))) depth += 1;
    if (/^case\b.*\bin$/.test(code)) depth += 1;
    else if (!closer && /^[^()]+\)(\s|$)/.test(code) && !/^(if|for|while|function)\b/.test(code)
             && !/\$\(/.test(code) && depth > 0) {
      depth += 1; // a case pattern `start)` - its body is one level in
      if (/;;\s*$/.test(code)) depth -= 1;
    } else if (/^;;|;;\s*$/.test(code)) depth = Math.max(0, depth - 1);
    const marker = /<<(-?)\s*['"]?([A-Za-z_][\w.-]*)['"]?/.exec(text);
    if (marker && !/^#/.test(text)) heredoc = { word: marker[2], dash: marker[1] === '-' };
    continued = /\\$/.test(text);
  }
  return { ok: true, text: tidyEnd(out.join('\n')) };
}

/* ── brace languages: C, Java, C#, Go, Rust, PHP, Groovy, Kotlin, ... ──── */

export function formatBraces(body: string, unit = '    ', hashComments = false): FormatResult {
  const rows = String(body).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let depth = 0;
  let inBlock = false;
  let inTemplate = false;
  for (const raw of rows) {
    const verbatim = inTemplate;
    const commented = inBlock;
    const text = raw.trim();
    let lead = 0;
    let seen = false;
    let quote: string | null = null;
    let delta = 0;
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (inBlock) { if (raw.startsWith('*/', i)) { inBlock = false; i += 1; } continue; }
      if (inTemplate) {
        if (ch === '\\') { i += 1; continue; }
        if (ch === '`') inTemplate = false;
        continue;
      }
      if (quote) { if (ch === '\\') { i += 1; continue; } if (ch === quote) quote = null; continue; }
      if (raw.startsWith('//', i) || (hashComments && ch === '#')) break;
      if (raw.startsWith('/*', i)) { inBlock = true; i += 1; seen = true; continue; }
      if (ch === '`') { inTemplate = true; seen = true; continue; }
      if (ch === '"' || ch === "'") { quote = ch; seen = true; continue; }
      if ('{[('.includes(ch)) { delta += 1; seen = true; }
      else if ('}])'.includes(ch)) { delta -= 1; if (!seen) lead += 1; }
      else if (!/\s/.test(ch)) seen = true;
    }
    if (verbatim) out.push(raw);
    else if (!text) out.push('');
    else if (commented) out.push(unit.repeat(depth) + (text.startsWith('*') ? ' ' : '') + text);
    else out.push(unit.repeat(Math.max(0, depth - lead)) + text);
    depth = Math.max(0, depth + delta);
  }
  if (inTemplate) return { ok: false, text: body, error: 'A ` template string is not closed.' };
  return { ok: true, text: tidyEnd(out.join('\n').replace(/\n{3,}/g, '\n\n')) };
}

/* ── XML ─────────────────────────────────────────────────────────────────── */

export function formatXml(body: string, unit = '  '): FormatResult {
  const source = String(body).replace(/\r\n?/g, '\n').trim();
  const tokens = source.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<[^>]+>|[^<]+/g) || [];
  const out: string[] = [];
  let depth = 0;
  const open: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith('<')) {
      const text = token.trim();
      if (text) out.push(unit.repeat(depth) + text.replace(/\s*\n\s*/g, ' '));
      continue;
    }
    if (/^<\//.test(token)) {
      const name = /^<\/\s*([^\s>]+)/.exec(token)?.[1] || '';
      if (open.pop() !== name) return { ok: false, text: body, error: `Mismatched closing tag </${name}>.` };
      depth = Math.max(0, depth - 1);
      // <a>text</a> on one line.
      const prev = out[out.length - 1];
      const opener = out[out.length - 2];
      if (prev && opener && !prev.trim().startsWith('<') && opener.trim().startsWith(`<${name}`)
          && !opener.trim().endsWith('/>') && prev.length < 80) {
        out.splice(out.length - 2, 2, `${opener}${prev.trim()}${token}`);
        continue;
      }
      out.push(unit.repeat(depth) + token);
      continue;
    }
    out.push(unit.repeat(depth) + token.replace(/\s*\n\s*/g, ' '));
    if (/^<[^!?]/.test(token) && !/\/>$/.test(token)) {
      open.push(/^<\s*([^\s/>]+)/.exec(token)?.[1] || '');
      depth += 1;
    }
  }
  if (open.length) return { ok: false, text: body, error: `<${open[open.length - 1]}> is never closed.` };
  return { ok: true, text: tidyEnd(out.join('\n')) };
}

/* ── Dockerfile, INI, lines ──────────────────────────────────────────────── */

const DOCKER = ['FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY',
  'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'];

export function formatDockerfile(body: string): FormatResult {
  const out: string[] = [];
  let continued = false;
  let heredoc: string | null = null;
  for (const raw of String(body).replace(/\r\n?/g, '\n').split('\n')) {
    if (heredoc) { out.push(raw); if (raw.trim() === heredoc) heredoc = null; continue; }
    const text = raw.trim();
    if (!text) { out.push(''); continue; }
    if (continued) out.push('    ' + text);
    else if (text.startsWith('#')) out.push(text);
    else {
      const [word, ...rest] = text.split(/\s+/);
      const upper = word.toUpperCase();
      out.push(DOCKER.includes(upper) ? [upper, ...rest].join(' ') : text);
    }
    const marker = /<<-?\s*['"]?([A-Za-z_]\w*)['"]?\s*$/.exec(text);
    if (marker) heredoc = marker[1];
    continued = /\\$/.test(text);
  }
  return { ok: true, text: tidyEnd(out.join('\n')) };
}

export function formatIni(body: string): FormatResult {
  const out = String(body).replace(/\r\n?/g, '\n').split('\n').map((raw) => {
    const text = raw.trim();
    if (!text || /^[#;]/.test(text) || /^\[.*\]$/.test(text)) return text;
    const m = /^([^=:]+?)\s*([=:])\s*(.*)$/.exec(text);
    return m ? `${m[1]} ${m[2]} ${m[3]}`.replace(/\s+$/, '') : text;
  });
  return { ok: true, text: tidyEnd(out.join('\n').replace(/\n{3,}/g, '\n\n')) };
}

export function formatLines(body: string): FormatResult {
  return { ok: true, text: tidyEnd(String(body).replace(/\t/g, '    ')) };
}

export function formatJson(body: string, unit: string | number = 2): FormatResult {
  try {
    return { ok: true, text: `${JSON.stringify(JSON.parse(body), null, unit)}\n` };
  } catch (error: any) {
    return { ok: false, text: body, error: `Not valid JSON: ${error?.message || error}` };
  }
}

/* ── the dispatcher ──────────────────────────────────────────────────────── */

let prettierLoad: Promise<any> | null = null;
function loadPrettier() {
  if (!prettierLoad) {
    prettierLoad = Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'), import('prettier/plugins/estree'),
      import('prettier/plugins/typescript'), import('prettier/plugins/postcss'),
      import('prettier/plugins/html'), import('prettier/plugins/markdown'),
      import('prettier/plugins/yaml'), import('prettier/plugins/graphql'),
      import('prettier/plugins/angular'),
    ]).then(([core, ...plugins]) => ({ core: (core as any).default || core,
      plugins: plugins.map((p: any) => p.default || p) }));
    prettierLoad.catch(() => { prettierLoad = null; });
  }
  return prettierLoad;
}

async function viaPrettier(body: string, parser: string, language: Language): Promise<FormatResult> {
  try {
    const { core, plugins } = await loadPrettier();
    const text = await core.format(body, {
      parser, plugins, tabWidth: typeof language.indent === 'number' ? language.indent || 2 : 2,
      useTabs: language.indent === 'tab', printWidth: 100, singleQuote: false,
      proseWrap: 'preserve', htmlWhitespaceSensitivity: 'css', embeddedLanguageFormatting: 'auto',
    });
    return { ok: true, text };
  } catch (error: any) {
    const first = String(error?.message || error).split('\n')[0];
    return { ok: false, text: body, error: `Could not format: ${first}` };
  }
}

export async function formatCode(body: string, language: Language): Promise<FormatResult> {
  const unit = indentString(language);
  switch (language.format) {
    case 'prettier': return viaPrettier(body, language.parser || 'babel', language);
    case 'yaml': return viaPrettier(body, 'yaml', language);
    case 'json': {
      const strict = formatJson(body, language.indent === 1 ? 1 : 2);
      if (strict.ok) return strict;
      return viaPrettier(body, 'json', language); // JSON with comments (jsonc)
    }
    case 'markdown': return viaPrettier(body, 'markdown', language);
    case 'hcl': return formatHcl(body);
    case 'python': return formatPython(body, unit === '\t' ? '    ' : unit);
    case 'shell': return formatShell(body, unit === '\t' ? '\t' : '  ');
    case 'braces': return formatBraces(body, unit, language.comment === '#');
    case 'xml': return formatXml(body, '  ');
    case 'dockerfile': return formatDockerfile(body);
    case 'ini': return formatIni(body);
    case 'lines': return formatLines(body);
    case 'sql': {
      try {
        const mod: any = await import('sql-formatter');
        return { ok: true, text: `${mod.format(body, { language: 'sql', keywordCase: 'upper', tabWidth: 2 }).trim()}\n` };
      } catch (error: any) {
        return { ok: false, text: body, error: `Could not format the SQL: ${String(error?.message || error).split('\n')[0]}` };
      }
    }
    default:
      return { ok: false, text: body, error: `There is no formatter for ${language.name} files.` };
  }
}
