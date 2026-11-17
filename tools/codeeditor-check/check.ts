/**
 * npm run check:codeeditor - the lab editor's language registry and formatters.
 *
 * Each formatter must: keep heredocs, block comments and multi-line strings
 * byte for byte; refuse (not rewrite) a file it cannot parse; and be
 * idempotent. The registry must give every common lab file the right language.
 */
import { formatBraces, formatDockerfile, formatHcl, formatIni, formatJson, formatPython,
  formatShell, formatXml } from '../../src/utils/codeFormat';
import { LANGUAGES, languageFor, sniffLanguage } from '../../src/utils/codeLanguages';

let failed = 0;
let passed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) { passed += 1; return; }
  failed += 1;
  console.log(`  FAIL  ${label}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400));
}

console.log('\n1. What a file is');
const expect: Record<string, string> = {
  'main.tf': 'terraform', 'prod.tfvars': 'terraform', 'x.hcl': 'hcl', 'app.py': 'python',
  'Dockerfile': 'dockerfile', 'Dockerfile.dev': 'dockerfile', 'Jenkinsfile': 'jenkinsfile',
  'index.html': 'html', 'style.css': 'css', 'script.js': 'javascript', 'a.d.ts': 'typescript',
  'App.vue': 'vue', 'Main.java': 'java', 'main.go': 'go', 'lib.rs': 'rust', 'q.sql': 'sql',
  'site.yml': 'ansible', 'k8s/deploy.yaml': 'kubernetes', '.github/workflows/ci.yml': 'github-actions',
  'docker-compose.yml': 'compose', 'package.json': 'npm', 'x.json': 'json', 'pom.xml': 'xml',
  'deploy.sh': 'shell', '.bashrc': 'shell', 'run.ps1': 'powershell', 'Makefile': 'makefile',
  'README.md': 'markdown', '.env': 'env', 'requirements.txt': 'requirements', 'a.ipynb': 'jupyter',
  'data.db': 'sqlite', 'site.pp': 'puppet', 'nginx.conf': 'nginx', 'x.toml': 'toml',
  'logo.png': 'image', 'notes.txt': 'text', 'weird.zzz': 'text', 'Program.cs': 'csharp',
  'main.cpp': 'cpp', 'app.kt': 'kotlin', 'index.php': 'php', 'Gemfile': 'ruby', 'id_rsa': 'certificate',
  '.gitignore': 'git', 'schema.graphql': 'graphql', 'x.proto': 'protobuf', 'web.service': 'systemd',
};
for (const [path, id] of Object.entries(expect)) {
  check(`${path} is ${id}`, languageFor(path).id === id, languageFor(path).id);
}
check('a shebang names a shell script', sniffLanguage('run', '#!/usr/bin/env bash\necho').id === 'shell');
check('a shebang names Python', sniffLanguage('tool', '#!/usr/bin/python3\nprint(1)').id === 'python');
check('HCL is recognised by content', sniffLanguage('config', 'resource "a" "b" {\n}').id === 'terraform');
check('every badge is at most three characters', LANGUAGES.every(l => l.short.length <= 3),
  LANGUAGES.filter(l => l.short.length > 3).map(l => l.id));
check('every colour is a #rrggbb', LANGUAGES.every(l => /^#[0-9a-f]{6}$/i.test(l.color)));
check('language ids are unique', new Set(LANGUAGES.map(l => l.id)).size === LANGUAGES.length);
check('over 100 languages', LANGUAGES.length > 100, LANGUAGES.length);

console.log('\n2. Terraform / HCL');
const tf = 'resource "aws_iam_role" "r" {\nname = "x"\n  assume_role_policy = <<EOF\n{\n  "a": 1\n}\nEOF\ntags = {\nName = "n" # c\n  LongerKey = "v"\n}\n}\n/* keep\n   this */\n';
const hcl = formatHcl(tf);
check('HCL formats', hcl.ok, hcl.error);
check('nesting is two spaces', hcl.text.includes('\n  name = "x"') && hcl.text.includes('\n    Name      = "n" # c'), hcl.text);
check('= is aligned across a run', hcl.text.includes('Name      = "n"') && hcl.text.includes('LongerKey = "v"'));
check('the heredoc body is byte for byte', hcl.text.includes('<<EOF\n{\n  "a": 1\n}\nEOF\n'), hcl.text);
check('a block comment is kept', hcl.text.includes('/* keep\n   this */'));
check('HCL is idempotent', formatHcl(hcl.text).text === hcl.text);
check('an unclosed block is refused, not rewritten', !formatHcl('resource "a" "b" {\n x = 1\n').ok);
check('a # inside a string is not a comment', formatHcl('x {\na = "#ff"\n}\n').text.includes('  a = "#ff"'));

console.log('\n3. Python');
const py = "def f(x):\n  if x:\n     return 1\n  else:\n\treturn 2\n\ns = '''\n   keep\n'''\nprint(f(\n    1))\n";
const p = formatPython(py);
check('Python formats', p.ok, p.error);
check('levels become four spaces', p.text.startsWith('def f(x):\n    if x:\n        return 1\n    else:\n        return 2'), p.text);
check('a triple-quoted string is kept', p.text.includes("'''\n   keep\n'''"));
check('a continuation line keeps its place', p.text.includes('print(f(\n    1))'));
check('Python is idempotent', formatPython(p.text).text === p.text);
check('an inconsistent dedent is refused', !formatPython('if x:\n    a\n  b\n').ok);

console.log('\n4. Shell, braces, XML, Dockerfile, INI, JSON');
const sh = formatShell("if [ -f x ]; then\necho a\nelse\necho b\nfi\ncase $1 in\nstart)\necho s\n;;\nesac\ncat <<'EOF'\n  raw\nEOF\n");
check('if/else is indented', sh.text.startsWith('if [ -f x ]; then\n  echo a\nelse\n  echo b\nfi'), sh.text);
check('case patterns and bodies are indented', sh.text.includes('case $1 in\n  start)\n    echo s\n    ;;\nesac'), sh.text);
check('a shell heredoc is kept', sh.text.includes("<<'EOF'\n  raw\nEOF"));
check('shell is idempotent', formatShell(sh.text).text === sh.text);
const java = formatBraces('class A {\npublic void f() {\nint x = 1; // }\nString s = "{";\n}\n}\n');
check('braces nest', java.text === 'class A {\n    public void f() {\n        int x = 1; // }\n        String s = "{";\n    }\n}\n', java.text);
const js = formatBraces('const a = `\n  keep {\n`;\nif (a) {\nb();\n}\n', '  ');
check('a template literal is kept', js.text.includes('`\n  keep {\n`'), js.text);
check('XML indents', formatXml('<a><b>t</b><c/></a>').text === '<a>\n  <b>t</b>\n  <c/>\n</a>\n');
check('mismatched XML is refused', !formatXml('<a><b></a>').ok);
check('Dockerfile instructions are upper case', formatDockerfile('from x\nrun a \\\nb\n').text === 'FROM x\nRUN a \\\n    b\n');
check('INI keys are spaced', formatIni('[s]\nkey=value\n').text === '[s]\nkey = value\n');
check('JSON is pretty-printed', formatJson('{"a":[1,2]}').text === '{\n  "a": [\n    1,\n    2\n  ]\n}\n');
check('bad JSON is refused', !formatJson('{"a":').ok);

console.log(`\ncheck:codeeditor: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
