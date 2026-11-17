/**
 * What a file IS, from its name - the lab editor's language registry.
 *
 * A plain module (no Vue, no DOM, no CodeMirror), so `npm run check:codeeditor`
 * can drive it in node. Three consumers read it and must agree:
 *
 *   - the file-type BADGE drawn beside a file in the tree and on its tab;
 *   - the editor's syntax highlighting (`mode` names a CodeMirror language);
 *   - Format (`format` names one of the formatters in `codeFormat.ts`).
 *
 * Matching order: an exact file name (`Dockerfile`, `Jenkinsfile`, `.bashrc`)
 * beats a compound extension (`.d.ts`, `.tar.gz`, `.blade.php`), which beats a
 * plain extension. A name nothing claims is plain text - never an error.
 */

export type FormatterId =
  | 'prettier' | 'json' | 'hcl' | 'python' | 'sql' | 'xml' | 'shell'
  | 'braces' | 'yaml' | 'ini' | 'dockerfile' | 'markdown' | 'lines' | 'none';

export interface Language {
  /** Stable id, used as a CSS hook and by the checks. */
  id: string;
  /** What a person calls it. */
  name: string;
  /** The badge: at most three characters. */
  short: string;
  /** The badge colour - the language's own brand colour where it has one. */
  color: string;
  /** The CodeMirror language to load (a `@codemirror/language-data` name, or 'hcl'). */
  mode: string;
  /** Indentation unit: a number of spaces, or 'tab'. */
  indent: number | 'tab';
  /** Which formatter Format uses. */
  format: FormatterId;
  /** Prettier's parser, for `format: 'prettier'`. */
  parser?: string;
  /** Line comment token, for Toggle comment. */
  comment?: string;
}

type Spec = [id: string, name: string, short: string, color: string, mode: string,
  indent: number | 'tab', format: FormatterId, extensions: string[],
  extra?: { parser?: string; comment?: string; names?: string[] }];

/* eslint-disable max-len */
const SPECS: Spec[] = [
  // Infrastructure as code and config
  ['terraform', 'Terraform', 'TF', '#7b42bc', 'hcl', 2, 'hcl', ['tf', 'tfvars', 'tftest.hcl', 'tfstate.backup'], { comment: '#' }],
  ['hcl', 'HCL', 'HCL', '#7b42bc', 'hcl', 2, 'hcl', ['hcl', 'nomad', 'pkr.hcl', 'sentinel'], { comment: '#' }],
  ['tfstate', 'Terraform state', 'TFS', '#5c4ee5', 'JSON', 2, 'json', ['tfstate']],
  ['yaml', 'YAML', 'YML', '#cb171e', 'YAML', 2, 'yaml', ['yaml', 'yml'], { parser: 'yaml', comment: '#', names: ['.clang-format', '.yamllint'] }],
  ['kubernetes', 'Kubernetes manifest', 'K8S', '#326ce5', 'YAML', 2, 'yaml', ['k8s.yaml', 'k8s.yml'], { parser: 'yaml', comment: '#' }],
  ['helm', 'Helm chart', 'HLM', '#0f1689', 'YAML', 2, 'yaml', [], { parser: 'yaml', comment: '#', names: ['Chart.yaml', 'values.yaml', 'Chart.lock'] }],
  ['compose', 'Docker Compose', 'DC', '#2496ed', 'YAML', 2, 'yaml', [], { parser: 'yaml', comment: '#', names: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'] }],
  ['ansible', 'Ansible', 'ANS', '#ee0000', 'YAML', 2, 'yaml', [], { parser: 'yaml', comment: '#', names: ['playbook.yml', 'site.yml', 'ansible.cfg', 'requirements.yml'] }],
  ['github-actions', 'GitHub Actions', 'GHA', '#2088ff', 'YAML', 2, 'yaml', [], { parser: 'yaml', comment: '#' }],
  ['cloudformation', 'CloudFormation', 'CFN', '#e7157b', 'YAML', 2, 'yaml', ['template.yaml', 'cfn.yaml', 'cfn.yml', 'cfn.json'], { parser: 'yaml', comment: '#' }],
  ['bicep', 'Bicep', 'BCP', '#0078d4', 'JavaScript', 2, 'braces', ['bicep', 'bicepparam'], { comment: '//' }],
  ['arm', 'ARM template', 'ARM', '#0078d4', 'JSON', 2, 'json', ['azuredeploy.json']],
  ['dockerfile', 'Dockerfile', 'DKR', '#2496ed', 'Dockerfile', 4, 'dockerfile', ['dockerfile', 'containerfile'], { comment: '#', names: ['Dockerfile', 'Containerfile', 'dockerfile'] }],
  ['dockerignore', 'Docker ignore', 'DKI', '#2496ed', 'Shell', 2, 'lines', [], { comment: '#', names: ['.dockerignore'] }],
  ['jenkinsfile', 'Jenkinsfile', 'JNK', '#d33833', 'Groovy', 4, 'braces', ['jenkinsfile'], { comment: '//', names: ['Jenkinsfile'] }],
  ['puppet', 'Puppet', 'PP', '#ffae1a', 'Puppet', 2, 'braces', ['pp'], { comment: '#' }],
  ['chef', 'Chef recipe', 'CHF', '#f09820', 'Ruby', 2, 'none', [], { comment: '#', names: ['metadata.rb', 'Berksfile', 'Policyfile.rb'] }],
  ['vagrant', 'Vagrantfile', 'VGR', '#1868f2', 'Ruby', 2, 'none', [], { comment: '#', names: ['Vagrantfile'] }],
  ['nginx', 'nginx config', 'NGX', '#009639', 'Nginx', 4, 'braces', ['nginx', 'nginxconf'], { comment: '#', names: ['nginx.conf'] }],
  ['apache', 'Apache config', 'APC', '#d22128', 'Properties files', 4, 'lines', [], { comment: '#', names: ['.htaccess', 'httpd.conf', 'apache2.conf'] }],
  ['systemd', 'systemd unit', 'SYD', '#30d475', 'Properties files', 0, 'ini', ['service', 'socket', 'timer', 'mount', 'target', 'path'], { comment: '#' }],
  ['ini', 'INI', 'INI', '#6d8086', 'Properties files', 0, 'ini', ['ini', 'cfg', 'conf', 'cnf', 'properties', 'prefs', 'editorconfig', 'gitconfig', 'npmrc', 'pylintrc'], { comment: '#', names: ['.editorconfig', '.gitconfig', '.npmrc', 'setup.cfg', 'tox.ini', 'pytest.ini', 'my.cnf', 'php.ini'] }],
  ['toml', 'TOML', 'TML', '#9c4221', 'TOML', 0, 'ini', ['toml'], { comment: '#', names: ['Cargo.toml', 'pyproject.toml', 'Pipfile', 'netlify.toml'] }],
  ['env', 'Environment file', 'ENV', '#ecd53f', 'Shell', 0, 'lines', ['env'], { comment: '#', names: ['.env', '.env.local', '.env.example', '.env.production', '.env.development', '.flaskenv'] }],
  ['json', 'JSON', '{ }', '#cbcb41', 'JSON', 2, 'json', ['json', 'jsonc', 'json5', 'webmanifest', 'har', 'geojson', 'topojson', 'babelrc', 'eslintrc', 'prettierrc'], { names: ['.babelrc', '.eslintrc', '.prettierrc', 'composer.json', 'tsconfig.json', 'jsconfig.json', 'package.json', 'package-lock.json', 'manifest.json'] }],
  ['jsonl', 'JSON Lines', 'JSL', '#cbcb41', 'JSON', 2, 'lines', ['jsonl', 'ndjson']],
  ['xml', 'XML', 'XML', '#e37933', 'XML', 2, 'xml', ['xml', 'xsd', 'xsl', 'xslt', 'wsdl', 'plist', 'pom', 'csproj', 'vbproj', 'fsproj', 'props', 'targets', 'nuspec', 'config', 'resx', 'xaml', 'svg', 'rss', 'atom', 'kml', 'gpx', 'xliff'], { names: ['pom.xml', 'web.config', 'AndroidManifest.xml'] }],
  ['csv', 'CSV', 'CSV', '#89e051', 'null', 0, 'lines', ['csv', 'tsv', 'psv']],
  ['protobuf', 'Protocol Buffers', 'PB', '#4285f4', 'ProtoBuf', 2, 'braces', ['proto'], { comment: '//' }],
  ['graphql', 'GraphQL', 'GQL', '#e10098', 'null', 2, 'prettier', ['graphql', 'gql', 'graphqls'], { parser: 'graphql', comment: '#' }],
  // Web
  ['html', 'HTML', 'HTM', '#e34c26', 'HTML', 2, 'prettier', ['html', 'htm', 'xhtml', 'shtml', 'jinja', 'jinja2', 'j2', 'njk', 'hbs', 'handlebars', 'mustache', 'ejs', 'twig', 'liquid', 'djhtml'], { parser: 'html' }],
  ['vue', 'Vue', 'VUE', '#41b883', 'Vue', 2, 'prettier', ['vue'], { parser: 'vue', comment: '//' }],
  ['svelte', 'Svelte', 'SVL', '#ff3e00', 'HTML', 2, 'braces', ['svelte'], { comment: '//' }],
  ['angular', 'Angular template', 'NG', '#dd0031', 'HTML', 2, 'prettier', ['component.html'], { parser: 'angular' }],
  ['css', 'CSS', 'CSS', '#563d7c', 'CSS', 2, 'prettier', ['css', 'pcss', 'postcss'], { parser: 'css' }],
  ['scss', 'SCSS', 'SCS', '#c6538c', 'SCSS', 2, 'prettier', ['scss'], { parser: 'scss', comment: '//' }],
  ['sass', 'Sass', 'SAS', '#c6538c', 'Sass', 2, 'lines', ['sass'], { comment: '//' }],
  ['less', 'Less', 'LES', '#1d365d', 'LESS', 2, 'prettier', ['less'], { parser: 'less', comment: '//' }],
  ['stylus', 'Stylus', 'STY', '#ff6347', 'Stylus', 2, 'lines', ['styl'], { comment: '//' }],
  ['javascript', 'JavaScript', 'JS', '#f1e05a', 'JavaScript', 2, 'prettier', ['js', 'mjs', 'cjs', 'es6', 'gs'], { parser: 'babel', comment: '//' }],
  ['jsx', 'JavaScript React', 'JSX', '#61dafb', 'JSX', 2, 'prettier', ['jsx'], { parser: 'babel', comment: '//' }],
  ['typescript', 'TypeScript', 'TS', '#3178c6', 'TypeScript', 2, 'prettier', ['ts', 'mts', 'cts', 'd.ts'], { parser: 'typescript', comment: '//' }],
  ['tsx', 'TypeScript React', 'TSX', '#3178c6', 'TSX', 2, 'prettier', ['tsx'], { parser: 'typescript', comment: '//' }],
  ['markdown', 'Markdown', 'MD', '#519aba', 'Markdown', 2, 'prettier', ['md', 'markdown', 'mdown', 'mkd', 'mdx'], { parser: 'markdown', names: ['README', 'CHANGELOG', 'CONTRIBUTING', 'LICENSE.md'] }],
  ['rst', 'reStructuredText', 'RST', '#141414', 'reStructuredText', 3, 'lines', ['rst']],
  ['asciidoc', 'AsciiDoc', 'ADC', '#e40046', 'null', 2, 'lines', ['adoc', 'asciidoc']],
  ['latex', 'LaTeX', 'TEX', '#3d6117', 'LaTeX', 2, 'lines', ['tex', 'sty', 'cls', 'bib', 'ltx'], { comment: '%' }],
  ['wasm', 'WebAssembly text', 'WAT', '#654ff0', 'WebAssembly', 2, 'lines', ['wat', 'wast']],
  // Systems and general purpose
  ['python', 'Python', 'PY', '#3572a5', 'Python', 4, 'python', ['py', 'pyw', 'pyi', 'pyx', 'pxd', 'rpy', 'gyp', 'bzl', 'star'], { comment: '#', names: ['SConstruct', 'SConscript', 'BUILD', 'WORKSPACE', 'Snakefile', 'wsgi.py', 'manage.py'] }],
  ['requirements', 'pip requirements', 'PIP', '#3572a5', 'Python', 0, 'lines', [], { comment: '#', names: ['requirements.txt', 'requirements-dev.txt', 'constraints.txt', 'dev-requirements.txt'] }],
  ['jupyter', 'Jupyter notebook', 'IPY', '#da5b0b', 'JSON', 1, 'json', ['ipynb']],
  ['java', 'Java', 'JAV', '#b07219', 'Java', 4, 'braces', ['java', 'jav', 'jsp'], { comment: '//' }],
  ['kotlin', 'Kotlin', 'KT', '#a97bff', 'Kotlin', 4, 'braces', ['kt', 'kts', 'ktm'], { comment: '//' }],
  ['scala', 'Scala', 'SCL', '#c22d40', 'Scala', 2, 'braces', ['scala', 'sc', 'sbt'], { comment: '//' }],
  ['groovy', 'Groovy', 'GRV', '#4298b8', 'Groovy', 4, 'braces', ['groovy', 'gvy', 'gy', 'gsh', 'gradle'], { comment: '//', names: ['build.gradle', 'settings.gradle'] }],
  ['clojure', 'Clojure', 'CLJ', '#db5855', 'Clojure', 2, 'lines', ['clj', 'cljs', 'cljc', 'edn'], { comment: ';' }],
  ['c', 'C', 'C', '#555555', 'C', 4, 'braces', ['c', 'h', 'i'], { comment: '//' }],
  ['cpp', 'C++', 'C++', '#f34b7d', 'C++', 4, 'braces', ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hh', 'hxx', 'h++', 'ino', 'ipp', 'tpp'], { comment: '//' }],
  ['csharp', 'C#', 'C#', '#178600', 'C#', 4, 'braces', ['cs', 'csx', 'cake'], { comment: '//' }],
  ['fsharp', 'F#', 'F#', '#b845fc', 'F#', 4, 'lines', ['fs', 'fsi', 'fsx'], { comment: '//' }],
  ['vb', 'Visual Basic', 'VB', '#945db7', 'VB.NET', 4, 'lines', ['vb', 'vbs', 'bas'], { comment: "'" }],
  ['objectivec', 'Objective-C', 'OBC', '#438eff', 'Objective-C', 4, 'braces', ['m', 'mm'], { comment: '//' }],
  ['swift', 'Swift', 'SWF', '#f05138', 'Swift', 4, 'braces', ['swift'], { comment: '//' }],
  ['go', 'Go', 'GO', '#00add8', 'Go', 'tab', 'braces', ['go'], { comment: '//', names: ['go.mod', 'go.sum', 'go.work'] }],
  ['rust', 'Rust', 'RS', '#dea584', 'Rust', 4, 'braces', ['rs'], { comment: '//' }],
  ['zig', 'Zig', 'ZIG', '#ec915c', 'null', 4, 'braces', ['zig']],
  ['dart', 'Dart', 'DRT', '#00b4ab', 'Dart', 2, 'braces', ['dart'], { comment: '//' }],
  ['php', 'PHP', 'PHP', '#4f5d95', 'PHP', 4, 'braces', ['php', 'php3', 'php4', 'php5', 'phtml', 'blade.php'], { comment: '//' }],
  ['ruby', 'Ruby', 'RB', '#701516', 'Ruby', 2, 'none', ['rb', 'rbw', 'rake', 'gemspec', 'ru', 'erb', 'rabl', 'jbuilder'], { comment: '#', names: ['Gemfile', 'Rakefile', 'Guardfile', 'Podfile', 'Fastfile', 'Brewfile', 'Capfile'] }],
  ['perl', 'Perl', 'PL', '#0298c3', 'Perl', 4, 'braces', ['pl', 'pm', 'pod', 't', 'psgi'], { comment: '#' }],
  ['lua', 'Lua', 'LUA', '#000080', 'Lua', 2, 'lines', ['lua', 'luau', 'rockspec'], { comment: '--' }],
  ['r', 'R', 'R', '#198ce7', 'R', 2, 'braces', ['r', 'rmd', 'rprofile'], { comment: '#' }],
  ['julia', 'Julia', 'JL', '#a270ba', 'Julia', 4, 'lines', ['jl'], { comment: '#' }],
  ['matlab', 'MATLAB', 'MAT', '#e16737', 'Octave', 4, 'lines', ['matlab', 'mlx'], { comment: '%' }],
  ['haskell', 'Haskell', 'HS', '#5e5086', 'Haskell', 2, 'none', ['hs', 'lhs'], { comment: '--' }],
  ['elixir', 'Elixir', 'EX', '#6e4a7e', 'null', 2, 'none', ['ex', 'exs', 'eex', 'heex'], { comment: '#' }],
  ['erlang', 'Erlang', 'ERL', '#b83998', 'Erlang', 4, 'lines', ['erl', 'hrl'], { comment: '%' }],
  ['ocaml', 'OCaml', 'ML', '#3be133', 'OCaml', 2, 'lines', ['ml', 'mli'], { comment: '(*' }],
  ['lisp', 'Lisp', 'LSP', '#3fb68b', 'Common Lisp', 2, 'lines', ['lisp', 'lsp', 'el', 'scm', 'ss', 'rkt'], { comment: ';' }],
  ['fortran', 'Fortran', 'F90', '#4d41b1', 'Fortran', 2, 'lines', ['f', 'f90', 'f95', 'f03', 'for'], { comment: '!' }],
  ['cobol', 'COBOL', 'CBL', '#004d99', 'Cobol', 4, 'lines', ['cob', 'cbl', 'cpy']],
  ['pascal', 'Pascal', 'PAS', '#e3f171', 'Pascal', 2, 'lines', ['pas', 'pp.pas', 'dpr', 'lpr'], { comment: '//' }],
  ['assembly', 'Assembly', 'ASM', '#6e4c13', 'Gas', 8, 'lines', ['asm', 's', 'nasm'], { comment: ';' }],
  ['solidity', 'Solidity', 'SOL', '#aa6746', 'JavaScript', 4, 'braces', ['sol'], { comment: '//' }],
  ['vhdl', 'VHDL', 'VHD', '#adb2cb', 'VHDL', 2, 'lines', ['vhd', 'vhdl'], { comment: '--' }],
  ['verilog', 'Verilog', 'V', '#b2b7f8', 'Verilog', 2, 'lines', ['v', 'sv', 'svh'], { comment: '//' }],
  ['wolfram', 'Mathematica', 'WL', '#dd1100', 'Mathematica', 2, 'lines', ['nb', 'wl', 'wls']],
  // Data and query
  ['sql', 'SQL', 'SQL', '#e38c00', 'SQL', 2, 'sql', ['sql', 'ddl', 'dml', 'psql', 'mysql', 'pgsql', 'plsql', 'hql', 'q', 'cql', 'prql'], { comment: '--' }],
  ['dbt', 'dbt model', 'DBT', '#ff694b', 'SQL', 2, 'lines', [], { comment: '--', names: ['dbt_project.yml', 'profiles.yml', 'schema.yml', 'sources.yml'] }],
  ['sqlite', 'SQLite database', 'DB', '#003b57', 'null', 0, 'none', ['db', 'sqlite', 'sqlite3', 'db3', 'mdb', 'accdb', 'parquet', 'avro', 'orc', 'feather', 'arrow', 'h5', 'hdf5', 'pkl', 'pickle', 'npy', 'npz', 'mat']],
  ['cypher', 'Cypher', 'CYP', '#008cc1', 'Cypher', 2, 'lines', ['cypher', 'cql4'], { comment: '//' }],
  ['sparql', 'SPARQL', 'RQ', '#0c4597', 'SPARQL', 2, 'lines', ['rq', 'sparql'], { comment: '#' }],
  ['kql', 'Kusto (KQL)', 'KQL', '#0078d4', 'SQL', 2, 'lines', ['kql', 'csl'], { comment: '//' }],
  ['dax', 'DAX', 'DAX', '#f2c811', 'SQL', 4, 'lines', ['dax', 'msdax'], { comment: '//' }],
  ['promql', 'PromQL', 'PQL', '#e6522c', 'null', 2, 'lines', ['promql', 'rules.yml'], { comment: '#' }],
  ['log', 'Log file', 'LOG', '#8a8a8a', 'null', 0, 'none', ['log', 'out', 'err', 'trace']],
  // Shells and scripts
  ['shell', 'Shell script', 'SH', '#89e051', 'Shell', 2, 'shell', ['sh', 'bash', 'zsh', 'ksh', 'fish', 'ash', 'command', 'bats', 'tmux', 'zshrc', 'bashrc', 'profile'], { comment: '#', names: ['.bashrc', '.bash_profile', '.profile', '.zshrc', '.zprofile', '.bash_aliases', '.bash_logout', 'bashrc', 'profile', 'configure', 'entrypoint', 'gradlew', 'mvnw'] }],
  ['powershell', 'PowerShell', 'PS', '#012456', 'PowerShell', 4, 'braces', ['ps1', 'psm1', 'psd1', 'ps1xml'], { comment: '#' }],
  ['batch', 'Batch file', 'BAT', '#c1f12e', 'null', 2, 'lines', ['bat', 'cmd'], { comment: 'REM' }],
  ['makefile', 'Makefile', 'MK', '#427819', 'CMake', 'tab', 'none', ['mk', 'mak', 'make'], { comment: '#', names: ['Makefile', 'makefile', 'GNUmakefile', 'Kbuild'] }],
  ['cmake', 'CMake', 'CMK', '#064f8c', 'CMake', 2, 'lines', ['cmake'], { comment: '#', names: ['CMakeLists.txt'] }],
  ['awk', 'AWK', 'AWK', '#c30e9b', 'Shell', 2, 'braces', ['awk', 'gawk', 'sed'], { comment: '#' }],
  ['tcl', 'Tcl', 'TCL', '#e4cc98', 'Tcl', 4, 'braces', ['tcl', 'tk', 'exp'], { comment: '#' }],
  ['diff', 'Diff / patch', 'DIF', '#88dddd', 'Diff', 0, 'none', ['diff', 'patch', 'rej']],
  // Tooling files
  ['git', 'Git file', 'GIT', '#f14e32', 'Shell', 0, 'lines', [], { comment: '#', names: ['.gitignore', '.gitattributes', '.gitmodules', '.gitkeep', '.mailmap', 'COMMIT_EDITMSG', '.git-blame-ignore-revs'] }],
  ['npm', 'npm', 'NPM', '#cb3837', 'JSON', 2, 'json', [], { names: ['package.json', 'package-lock.json', '.npmignore', '.nvmrc'] }],
  ['lock', 'Lock file', 'LCK', '#8a8a8a', 'null', 0, 'none', ['lock'], { names: ['yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Pipfile.lock', 'Gemfile.lock', 'composer.lock', 'Cargo.lock', '.terraform.lock.hcl'] }],
  ['license', 'Licence', 'LIC', '#cbcb41', 'null', 0, 'none', [], { names: ['LICENSE', 'LICENCE', 'COPYING', 'NOTICE', 'AUTHORS'] }],
  ['text', 'Plain text', 'TXT', '#8a96a3', 'null', 0, 'lines', ['txt', 'text', 'nfo', 'readme', 'me']],
  ['certificate', 'Certificate / key', 'KEY', '#e8a33d', 'null', 0, 'none', ['pem', 'crt', 'cer', 'key', 'pub', 'csr', 'p12', 'pfx', 'jks', 'gpg', 'asc'], { names: ['id_rsa', 'id_rsa.pub', 'id_ed25519', 'id_ed25519.pub', 'authorized_keys', 'known_hosts'] }],
  ['image', 'Image', 'IMG', '#a074c4', 'null', 0, 'none', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tif', 'tiff', 'avif', 'heic', 'psd']],
  ['audio', 'Audio / video', 'AV', '#e5a00d', 'null', 0, 'none', ['mp3', 'wav', 'ogg', 'flac', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4a']],
  ['archive', 'Archive', 'ZIP', '#ae7f2b', 'null', 0, 'none', ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'jar', 'war', 'ear', 'whl', 'egg', 'deb', 'rpm', 'apk', 'tar.gz']],
  ['pdf', 'PDF', 'PDF', '#e0301e', 'null', 0, 'none', ['pdf']],
  ['office', 'Office document', 'DOC', '#2b579a', 'null', 0, 'none', ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf']],
  ['binary', 'Binary', 'BIN', '#6d6d6d', 'null', 0, 'none', ['exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'class', 'pyc', 'pyo', 'wasm', 'iso', 'img', 'dmg']],
  ['font', 'Font', 'FNT', '#d86c46', 'null', 0, 'none', ['ttf', 'otf', 'woff', 'woff2', 'eot']],
  ['http', 'HTTP request', 'API', '#ec5b2a', 'HTTP', 0, 'lines', ['http', 'rest']],
  ['mermaid', 'Mermaid diagram', 'MMD', '#ff3670', 'null', 2, 'lines', ['mmd', 'mermaid']],
  ['plantuml', 'PlantUML', 'UML', '#a7b9c9', 'null', 2, 'lines', ['puml', 'plantuml', 'iuml']],
  ['dot', 'Graphviz', 'DOT', '#2596be', 'null', 2, 'braces', ['dot', 'gv']],
];
/* eslint-enable max-len */

function make(spec: Spec): Language {
  const [id, name, short, color, mode, indent, format, , extra] = spec;
  return { id, name, short, color, mode, indent, format,
    parser: extra?.parser, comment: extra?.comment };
}

export const LANGUAGES: Language[] = SPECS.map(make);
const BY_ID = new Map(LANGUAGES.map(language => [language.id, language]));
export const PLAIN = BY_ID.get('text') as Language;
export const FOLDER: Language = { id: 'folder', name: 'Folder', short: '', color: '#90a4ae',
  mode: 'null', indent: 2, format: 'none' };

const NAMES = new Map<string, string>();
const EXTENSIONS = new Map<string, string>();
// Later specs do not overwrite earlier ones, so the more specific entry wins
// where two declare the same thing (`package.json` is npm, not plain JSON,
// because npm is declared... after: so the names table is filled specific-first).
for (const spec of SPECS) {
  for (const ext of spec[7]) if (!EXTENSIONS.has(ext.toLowerCase())) EXTENSIONS.set(ext.toLowerCase(), spec[0]);
}
const SPECIFIC_NAMES = ['npm', 'helm', 'compose', 'ansible', 'dbt', 'lock', 'requirements', 'cmake'];
for (const id of SPECIFIC_NAMES) {
  const spec = SPECS.find(row => row[0] === id);
  for (const n of spec?.[8]?.names || []) NAMES.set(n.toLowerCase(), id);
}
for (const spec of SPECS) {
  for (const n of spec[8]?.names || []) if (!NAMES.has(n.toLowerCase())) NAMES.set(n.toLowerCase(), spec[0]);
}

export function languageById(id: string): Language {
  return BY_ID.get(id) || PLAIN;
}

/** The language of a path. Never throws; an unknown name is plain text. */
export function languageFor(path: string): Language {
  const base = String(path || '').split('/').pop() || '';
  const lower = base.toLowerCase();
  const dir = String(path || '').toLowerCase();
  if (NAMES.has(lower)) return BY_ID.get(NAMES.get(lower) as string) as Language;
  // Where a file lives can say what it is better than its extension does.
  if (/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(dir)) return BY_ID.get('github-actions') as Language;
  if (/\.github\/[^/]+\.ya?ml$/.test(dir) || /(^|\/)\.gitlab-ci\.ya?ml$/.test(dir)) return BY_ID.get('yaml') as Language;
  if (/(^|\/)(roles|playbooks|group_vars|host_vars)\//.test(dir) && /\.ya?ml$/.test(lower)) {
    return BY_ID.get('ansible') as Language;
  }
  if (/(^|\/)(k8s|kubernetes|manifests|charts?\/[^/]+\/templates)\//.test(dir) && /\.ya?ml$/.test(lower)) {
    return BY_ID.get('kubernetes') as Language;
  }
  if (/^dockerfile[.-]/.test(lower) || /\.dockerfile$/.test(lower)) return BY_ID.get('dockerfile') as Language;
  if (/^jenkinsfile[.-]/.test(lower)) return BY_ID.get('jenkinsfile') as Language;
  if (/^\.env(\.|$)/.test(lower)) return BY_ID.get('env') as Language;
  if (/^requirements.*\.(txt|in)$/.test(lower)) return BY_ID.get('requirements') as Language;
  // Longest dotted suffix first: `.d.ts`, `.blade.php`, `.tar.gz`, `.tftest.hcl`.
  const parts = lower.split('.');
  for (let i = 1; i < parts.length; i += 1) {
    const ext = parts.slice(i).join('.');
    const id = EXTENSIONS.get(ext);
    if (id) return BY_ID.get(id) as Language;
  }
  if (parts.length === 1 && lower.startsWith('.') === false && /^[A-Z]/.test(base)
      && /^(README|CHANGELOG|CONTRIBUTING|TODO|NEWS|HISTORY|INSTALL)$/i.test(base)) {
    return BY_ID.get('markdown') as Language;
  }
  return PLAIN;
}

/** The language of the CONTENT, when the name says nothing: a shebang, a `<?xml`. */
export function sniffLanguage(path: string, text: string): Language {
  const named = languageFor(path);
  if (named !== PLAIN) return named;
  const head = String(text || '').slice(0, 400);
  const shebang = /^#!\s*(?:\S*\/)?(?:env\s+(?:-\S+\s+)*)?([\w.]+)/.exec(head);
  if (shebang) {
    const exe = shebang[1];
    if (/^(ba|z|k|da)?sh$/.test(exe)) return BY_ID.get('shell') as Language;
    if (/^python/.test(exe)) return BY_ID.get('python') as Language;
    if (/^node$/.test(exe)) return BY_ID.get('javascript') as Language;
    if (/^ruby$/.test(exe)) return BY_ID.get('ruby') as Language;
    if (/^perl$/.test(exe)) return BY_ID.get('perl') as Language;
    if (/^pwsh$/.test(exe)) return BY_ID.get('powershell') as Language;
  }
  if (/^\s*<\?xml/.test(head)) return BY_ID.get('xml') as Language;
  if (/^\s*<!doctype html|^\s*<html/i.test(head)) return BY_ID.get('html') as Language;
  if (/^\s*[{[]/.test(head)) {
    try { JSON.parse(text); return BY_ID.get('json') as Language; } catch { /* not JSON */ }
  }
  if (/^\s*(resource|variable|provider|terraform|module|data|output|locals)\s+("|\{)/m.test(head)) {
    return BY_ID.get('terraform') as Language;
  }
  if (/^\s*(apiVersion|kind):\s/m.test(head)) return BY_ID.get('kubernetes') as Language;
  if (/^---\s*$/m.test(head) || /^\s*-?\s*[\w-]+:\s/m.test(head.split('\n')[0] || '')) {
    return BY_ID.get('yaml') as Language;
  }
  return PLAIN;
}

/** Whether the editor should open a file as text at all. */
export function isBinary(language: Language): boolean {
  return ['sqlite', 'image', 'audio', 'archive', 'pdf', 'office', 'binary', 'font'].includes(language.id);
}

/** The indentation string for a language. */
export function indentString(language: Language): string {
  if (language.indent === 'tab') return '\t';
  return ' '.repeat(language.indent || 2);
}
