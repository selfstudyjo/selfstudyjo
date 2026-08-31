<template>
  <div class="labs-container">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ $t('Initializing lab environment...') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <AlertTriangle class="lab-i lab-i--lg" />
      <h3>{{ $t('Unable to Access Labs') }}</h3>
      <p>{{ error }}</p>
      <button class="btn btn-secondary" @click="initializeLab">
        <RotateCw class="lab-i" /> {{ $t('Try Again') }}
      </button>
    </div>

    <!-- No Lab Access -->
    <!-- This used to also fire for a user who had paid for lab_feature but had no
         lab_url set on their profile, which read as "contact your administrator"
         for something they had already bought. Access is the subscription now, so
         the link goes where it can actually be fixed. -->
    <div v-else-if="!hasLabAccess" class="no-access-state">
      <FlaskConical class="lab-i lab-i--lg" />
      <h3>{{ $t('No Lab Access') }}</h3>
      <p>{{ $t('Your plan doesn\'t include the virtual labs. Add the lab feature to your subscription to open the SQL, Linux and Python sandboxes.') }}</p>
      <router-link to="/plans" class="btn btn-primary">
        <Crown class="lab-i" /> {{ $t('View Plans') }}
      </router-link>
    </div>

    <!-- Main Content -->
    <div v-else class="labs-main">
      <!-- Tabs Navigation -->
      <div class="tabs-navigation">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="selectTab(tab.id)"
        >
          <component :is="tab.icon" class="lab-i" />
          <!-- `$t(tab.label)`: the three labels are keys, and all three already
               exist in the catalogue because `appNav.ts` names the same three
               routes — so the sidebar and the tab bar say the same words in
               every language, and the orphan scan already exempts them. -->
          <span>{{ $t(tab.label) }}</span>
        </button>

        <!-- Which replica holds this workspace. Worth showing: if the lab ever has
             to recreate a workspace elsewhere, this is what changes, and a student
             who can see it can tell us which machine their files were on. -->
        <span v-if="homeReplica" class="workspace-indicator" :title="`Your files are stored on ${homeReplica}`">
          <HardDrive class="lab-i" /> {{ homeReplicaHost }}
        </span>
      </div>

      <!-- SQL Tab -->
      <div v-if="activeTab === 'sql'" class="tab-content">
        <div class="sql-container">
          <div class="sql-sidebar">
            <h4><Table class="lab-i" /> {{ $t('Database Tables') }}</h4>
            <div class="tables-list">
              <div v-for="table in sqlTables" :key="table" class="table-item">
                <Table class="lab-i" />
                <span>{{ table }}</span>
                <button class="btn-sm" @click="showTableSchema(table)">
                  <Info class="lab-i" />
                </button>
              </div>
            </div>

            <div class="sql-instructions">
              <h5><Lightbulb class="lab-i" /> {{ $t('Quick Tips') }}</h5>
              <ul>
                <li>{{ $t('Use') }} <code>SELECT * FROM table_name;</code> {{ $t('to view all data') }}</li>
                <li>{{ $t('Use') }} <code>DESCRIBE table_name;</code> {{ $t('to see table structure') }}</li>
                <li>{{ $t('End each query with a semicolon (;)') }}</li>
                <li>{{ $t('Try:') }} <code>SELECT * FROM sqlite_master WHERE type='table';</code></li>
              </ul>
            </div>
          </div>

          <div class="sql-main">
            <div class="sql-editor">
              <div class="editor-header">
                <h4><Pencil class="lab-i" /> {{ $t('SQL Query Editor') }}</h4>
                <div class="editor-actions">
                  <button class="btn btn-sm" @click="formatSQL">
                    <AlignLeft class="lab-i" /> {{ $t('Format') }}
                  </button>
                  <button class="btn btn-sm" @click="clearSQL">
                    <Trash2 class="lab-i" /> {{ $t('Clear') }}
                  </button>
                </div>
              </div>
              <div class="editor-container">
                <textarea
                  v-model="sqlQuery"
                  :placeholder="$t('Enter your SQL query here...')"
                  class="sql-textarea"
                  :disabled="runningSQL"
                  @keydown.ctrl.enter="runSQL"
                ></textarea>
                <div class="editor-footer">
                  <div class="query-info">
                    <span v-if="lastSQLQuery">
                      {{ $t('Last query: {v0}...', { v0: lastSQLQuery.substring(0, 50) }) }}
                    </span>
                  </div>
                  <button
                    class="btn btn-primary"
                    @click="runSQL"
                    :disabled="!sqlQuery.trim() || runningSQL"
                  >
                    <Loader2 v-if="runningSQL" class="lab-i lab-i--spin" /><Play v-else class="lab-i" />
                    {{ runningSQL ? $t('Running...') : $t('Run Query') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="sql-results">
              <div class="results-header">
                <h4><BarChart3 class="lab-i" /> {{ $t('Results') }}</h4>
                <div class="results-info">
                  <span v-if="sqlResults">
                    {{ $t('{v0} row(s) returned', { v0: sqlResults.length }) }}
                  </span>
                </div>
              </div>
              <div class="results-container">
                <div v-if="sqlError" class="error-message">
                  <AlertCircle class="lab-i" />
                  <div>
                    <strong>{{ $t('SQL Error:') }}</strong> {{ sqlError }}
                  </div>
                </div>

                <div v-else-if="sqlResults && sqlResults.length > 0" class="results-table-container">
                  <table class="results-table">
                    <thead>
                      <tr>
                        <th v-for="column in Object.keys(sqlResults[0])" :key="column">
                          {{ column }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, index) in sqlResults" :key="index">
                        <td v-for="column in Object.keys(sqlResults[0])" :key="column">
                          {{ row[column] }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-else class="empty-results">
                  <Database class="lab-i" />
                  <p>{{ $t('No results yet. Run a query to see results here.') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Linux Tab -->
      <div v-else-if="activeTab === 'linux'" class="tab-content">
        <div class="linux-container">
          <div class="terminal-wrapper">
            <!-- Terminal Header -->
            <div class="terminal-header">
              <div class="terminal-title">
                <Terminal class="lab-i" />
                {{ $t('Linux Terminal - {v0}@lab-server', { v0: username }) }}
                <span class="terminal-status" v-if="runningProcess">
                  <Loader2 class="lab-i lab-i--spin" /> {{ $t('Process running...') }}
                </span>
              </div>
              <div class="terminal-actions">
                <button class="btn btn-sm" @click="clearTerminal" :title="$t('Clear terminal')">
                  <Eraser class="lab-i" /> {{ $t('Clear') }}
                </button>
                <button class="btn btn-sm btn-danger" @click="killProcess"
                        :disabled="!runningProcess" :title="$t('Stop current process')">
                  <Square class="lab-i" /> {{ $t('Stop') }}
                </button>
                <button class="btn btn-sm" @click="copyTerminalContent" :title="$t('Copy terminal content')">
                  <Copy class="lab-i" /> {{ $t('Copy') }}
                </button>
              </div>
            </div>

            <!-- Terminal Content -->
            <div class="terminal-content" ref="terminalContent" @click="focusCommandInput">
              <!-- Welcome message -->
              <div v-if="terminalLines.length === 0" class="terminal-welcome">
                <div class="welcome-line">{{ $t('🌐 Welcome to Linux Terminal Lab!') }}</div>
                <div class="welcome-line">{{ $t('📁 Type \'help\' for available commands') }}</div>
                <div class="welcome-line">{{ $t('💡 Press ↑/↓ for command history • Tab for auto-completion') }}</div>
                <!--
                  Empty on purpose. It used to hold 46 literal `─` box-drawing
                  characters, which a screen reader reads out one by one and which
                  have no break opportunity — so at 390px the run was 18px wider
                  than the terminal and extended its scrollable width. The rule in
                  lab.css already draws the line as a 1px gradient, which is what
                  the characters were imitating.
                -->
                <div class="welcome-separator" aria-hidden="true"></div>
              </div>

              <!-- Terminal Lines -->
              <div v-for="(line, index) in terminalLines" :key="index" :class="['terminal-line', line.type]">
                <span class="line-prompt" v-if="line.type === 'command'">{{ line.prompt || `${username}@lab-server:~$` }}</span>
                <span class="line-content">{{ line.content }}</span>
              </div>

              <!-- Current Command Input Line -->
              <div class="terminal-input-line">
                <span class="input-prompt">{{ $t('{v0}@lab-server:~$', { v0: username }) }}</span>
                <div class="input-wrapper">
                  <input
                    v-model="currentCommand"
                    type="text"
                    class="command-input"
                    :placeholder="commandHistory.length > 0 ? '' : $t('Type a command and press Enter...')"
                    :disabled="runningProcess"
                    @keydown.enter="runLinuxCommand"
                    @keydown.up.prevent="commandHistoryUp"
                    @keydown.down.prevent="commandHistoryDown"
                    @keydown.tab.prevent="handleTabCompletion"
                    @keydown.ctrl.c.prevent="handleCtrlC"
                    ref="commandInput"
                    spellcheck="false"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                  />
                  <!--
                    The fake cursor was here — a `█` or a `|` after the input.
                    `.command-input` is `flex: 1`, so both were pushed to the FAR
                    RIGHT of the terminal, hundreds of pixels from the text being
                    typed, at every width; they also made the row two pixels wider
                    than its own box. The native caret is in the right place by
                    construction and already takes `caret-color: --code-green`.
                  -->
                  <span class="running-indicator" v-if="runningProcess">
                    <Loader2 class="lab-i lab-i--spin" />
                  </span>
                </div>
              </div>
            </div>

            <!-- Terminal Help Section -->
            <div class="terminal-help">
              <div class="help-header">
                <Zap class="lab-i" /> {{ $t('Quick Commands (Click to insert)') }}
              </div>
              <div class="commands-grid">
                <button class="cmd-btn" @click="insertCommand('pwd')" :title="$t('Print working directory')">
                  <code>pwd</code> {{ $t('Current directory') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('ls -la')" :title="$t('List files with details')">
                  <code>ls -la</code> {{ $t('List files') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('whoami')" :title="$t('Display current user')">
                  <code>whoami</code> {{ $t('Current user') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('date')" :title="$t('Show current date and time')">
                  <code>date</code> {{ $t('Date & time') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('mkdir test_folder')" :title="$t('Create directory')">
                  <code>mkdir</code> {{ $t('Create folder') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('touch file.txt')" :title="$t('Create empty file')">
                  <code>touch</code> {{ $t('Create file') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('echo Hello from terminal')" :title="$t('Print text')">
                  <code>echo</code> {{ $t('Print text') }}
                </button>
                <button class="cmd-btn" @click="insertCommand('clear')" :title="$t('Clear terminal')">
                  <code>clear</code> {{ $t('Clear screen') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Python Tab -->
      <div v-else-if="activeTab === 'python'" class="tab-content">
        <div class="python-container">
          <div class="python-editor">
            <div class="editor-header">
              <h4><Code2 class="lab-i" /> {{ $t('Python Code Editor') }}</h4>
              <div class="editor-actions">
                <button class="btn btn-sm" @click="insertPythonTemplate">
                  <FileCode2 class="lab-i" /> {{ $t('Template') }}
                </button>
                <button class="btn btn-sm" @click="clearPythonCode">
                  <Trash2 class="lab-i" /> {{ $t('Clear') }}
                </button>
              </div>
            </div>
            <div class="editor-container">
              <textarea
                v-model="pythonCode"
                placeholder="# Enter your Python code here..."
                class="python-textarea"
                :disabled="runningPython"
                spellcheck="false"
              ></textarea>
              <div class="editor-footer">
                <div class="code-info">
                  <span>{{ $t('{v0} characters', { v0: pythonCode.length }) }}</span>
                </div>
                <button
                  class="btn btn-primary"
                  @click="runPythonCode"
                  :disabled="!pythonCode.trim() || runningPython"
                >
                  <Loader2 v-if="runningPython" class="lab-i lab-i--spin" /><Play v-else class="lab-i" />
                  {{ runningPython ? $t('Running...') : $t('Run Code') }}
                </button>
              </div>
            </div>
          </div>

          <div class="python-output">
            <div class="output-header">
              <h4><Terminal class="lab-i" /> {{ $t('Output') }}</h4>
              <div class="output-actions">
                <button class="btn btn-sm" @click="clearPythonOutput">
                  <Trash2 class="lab-i" /> {{ $t('Clear') }}
                </button>
              </div>
            </div>
            <div class="output-container">
              <div v-if="pythonError" class="error-message">
                <AlertCircle class="lab-i" />
                <div>
                  <strong>{{ $t('Python Error:') }}</strong>
                  <pre>{{ pythonError }}</pre>
                </div>
              </div>

              <div v-else-if="pythonOutput" class="output-content">
                <pre>{{ pythonOutput }}</pre>
              </div>

              <div v-else class="empty-output">
                <Code2 class="lab-i" />
                <p>{{ $t('Run your Python code to see output here.') }}</p>
              </div>
            </div>

            <div class="python-templates">
              <h5><Lightbulb class="lab-i" /> {{ $t('Quick Examples') }}</h5>
              <div class="templates-grid">
                <button class="template-btn" @click="insertPythonExample('hello')">
                  {{ $t('Hello World') }}
                </button>
                <button class="template-btn" @click="insertPythonExample('loop')">
                  {{ $t('For Loop') }}
                </button>
                <button class="template-btn" @click="insertPythonExample('function')">
                  {{ $t('Function') }}
                </button>
                <button class="template-btn" @click="insertPythonExample('file')">
                  {{ $t('File I/O') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div class="toast-container">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
        <component :is="toast.icon" class="lab-i" />
        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" @click="removeToast(toast.id)">
          <X class="lab-i" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
/*
  Icons as components. Labs.vue was the only file in the app using Font
  Awesome — 40 `<i class="fas fa-…">` elements — and Font Awesome is not
  loaded anywhere: not in package.json, not linked from index.html, not
  imported. All 40 rendered as empty `<i>` tags, so every button had a gap
  where its icon should be and every heading started with a blank.
  `lucide-vue-next` is already a dependency and already in the bundle.
*/
import {
    AlertCircle, AlertTriangle, AlignLeft, BarChart3, CheckCircle2, Code2, Copy, Crown, Database, Eraser, FileCode2, FlaskConical, HardDrive, Info, Lightbulb, Loader2, Pencil, Play, RotateCw, Square, Table, Terminal, Trash2, X, Zap,
} from 'lucide-vue-next';
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { labService, type Student } from '@/services/lab.service';

const authStore = useAuthStore();
const terminalContent = ref<HTMLElement | null>(null);
const commandInput = ref<HTMLInputElement | null>(null);

// User info
const username = computed(() => authStore.user?.username || '');

// The replica holding this student's files, once the lab has told us. Display
// only - labService sends each call there itself. There is no lab URL on the
// user's profile any more: app 11 replicates its records and pins each student
// to the replica that holds their workspace.
const homeReplica = computed(() => studentRecord.value?.home_replica || '');
const homeReplicaHost = computed(() =>
  homeReplica.value.replace(/^https?:\/\//, '').replace(/\/$/, ''));

const hasLabAccess = computed(() => authStore.hasLabAccess);
const studentRecord = ref<Student | null>(null);

// State
const loading = ref(false);
const error = ref<string | null>(null);
/*
  Which sandbox is open. Mirrored into the URL as `/labs/<tab>` so the sidebar
  can link straight to one, a reload comes back to the same place, and a
  student can send a classmate the tab they are stuck on. `/labs` with no
  segment is SQL.
*/
const route = useRoute();
const router = useRouter();

const TABS = ['sql', 'linux', 'python'] as const;
type TabId = (typeof TABS)[number];

const tabFromRoute = (): TabId => {
  const value = String(route.params.tab || '');
  return (TABS as readonly string[]).includes(value) ? (value as TabId) : 'sql';
};

const activeTab = ref<TabId>(tabFromRoute());

/** Clicking a tab navigates; the watcher below is what actually switches it. */
function selectTab(id: TabId) {
  if (activeTab.value === id) return;
  router.push(id === 'sql' ? '/labs' : `/labs/${id}`);
}

// Back button, a pasted link, and the sidebar all arrive here.
watch(() => route.params.tab, () => { activeTab.value = tabFromRoute(); });

// SQL state
const sqlQuery = ref('SELECT * FROM sqlite_master WHERE type="table";');
const sqlResults = ref<any[] | null>(null);
const sqlError = ref<string | null>(null);
const runningSQL = ref(false);
const lastSQLQuery = ref('');
const sqlTables = ref<string[]>(['sqlite_master']);

// Linux Terminal State
const currentCommand = ref('');
const runningProcess = ref(false);
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);
const terminalLines = ref<Array<{
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  prompt?: string;
}>>([]);

// Common Linux commands for tab completion
const linuxCommands = [
  'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'cat', 'echo',
  'grep', 'find', 'chmod', 'chown', 'ps', 'kill', 'top', 'df', 'du',
  'tar', 'gzip', 'unzip', 'ssh', 'scp', 'wget', 'curl', 'ping', 'ifconfig',
  'netstat', 'date', 'whoami', 'id', 'groups', 'passwd', 'su', 'sudo',
  'apt', 'yum', 'dnf', 'systemctl', 'journalctl', 'uname', 'history',
  'man', 'help', 'clear', 'exit'
];

// Python state
const pythonCode = ref(`# Welcome to Python Lab!
# This is a safe sandbox to practice Python programming.

print("Hello, World!")

# You can write any Python code here
def fibonacci(n):
    """Generate Fibonacci sequence up to n"""
    a, b = 0, 1
    while a < n:
        print(a, end=' ')
        a, b = b, a + b
    print()

fibonacci(100)

# Try writing your own code below:`);
const pythonOutput = ref<string | null>(null);
const pythonError = ref<string | null>(null);
const runningPython = ref(false);

// Toast notifications
const toasts = ref<Array<{
  id: number;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  icon: Component;
}>>([]);
let toastId = 0;

// Tabs configuration
/*
  The icon is a COMPONENT and the label is a KEY.

  Both were strings: a Font Awesome class that rendered nothing, and an English
  label that rendered in English on an Arabic page. The label is resolved through
  `t()` at read time rather than stored translated, so switching language
  re-labels the tabs without rebuilding the array.
*/
const tabs: Array<{ id: TabId; label: string; icon: Component }> = [
  { id: 'sql', label: 'SQL Database', icon: Database },
  { id: 'linux', label: 'Linux Terminal', icon: Terminal },
  { id: 'python', label: 'Python Compiler', icon: Code2 },
];

// Initialize lab — automatically create the student record if it doesn't exist
const initializeLab = async () => {
  if (!hasLabAccess.value) {
    error.value = 'Your plan does not include the virtual labs';
    return;
  }

  if (!username.value) {
    error.value = 'You are not signed in.';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // /api/check-and-create-user/ on any lab replica — they all hold the same
    // records. It creates the student if they are new, creates their workspace, and
    // returns the replica that now holds it, which labService remembers so the
    // sandbox calls below go straight there instead of being forwarded.
    try {
      studentRecord.value = await labService.getOrCreateStudent(username.value);
      if (!studentRecord.value) {
        error.value = 'The lab service could not be reached. Try again in a moment.';
        return;
      }
    } catch (studentError) {
      console.warn('Failed to ensure student record (non-critical):', studentError);
    }

    // Try to load initial SQL tables
    try {
      await loadSQLTables();
    } catch (sqlError) {
      console.warn('Failed to load SQL tables:', sqlError);
    }

  } catch (err: any) {
    console.error('Failed to initialize lab:', err);
    error.value = err.message || 'Failed to initialize lab environment';
    showToast('Error', error.value || 'Something went wrong.', 'error');
  } finally {
    loading.value = false;
  }
};

// Toast functions
const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const id = ++toastId;
  toasts.value.push({
    id,
    title,
    message,
    type,
    icon: icons[type]
  });

  setTimeout(() => {
    removeToast(id);
  }, 5000);
};

const removeToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// SQL Functions
const loadSQLTables = async () => {
  try {
    const result = await labService.runSQL(username.value, sqlQuery.value);
    if (result.result && Array.isArray(result.result)) {
      const tables = result.result
        .filter((row: any) => row.type === 'table' && row.name !== 'sqlite_sequence')
        .map((row: any) => row.name);
      sqlTables.value = ['sqlite_master', ...tables];
    }
  } catch (err) {
    console.error('Failed to load SQL tables:', err);
  }
};

const runSQL = async () => {
  if (!sqlQuery.value.trim() || runningSQL.value) return;

  runningSQL.value = true;
  sqlError.value = null;
  sqlResults.value = null;
  lastSQLQuery.value = sqlQuery.value;

  try {
    const result = await labService.runSQL(username.value, sqlQuery.value);

    if (result.error) {
      sqlError.value = result.error;
      showToast('SQL Error', result.error, 'error');
    } else if (result.result) {
      sqlResults.value = result.result;
      showToast('Success',
        result.truncated
          ? result.message || `Showing the first ${result.result.length} rows.`
          : `Query executed successfully. ${result.result.length} row(s) returned.`,
        result.truncated ? 'warning' : 'success');

      if (sqlQuery.value.toLowerCase().includes('table')) {
        await loadSQLTables();
      }
    }
  } catch (err: any) {
    sqlError.value = err.message || 'Failed to execute SQL query';
    showToast('Error', sqlError.value || 'Something went wrong.', 'error');
  } finally {
    runningSQL.value = false;
  }
};

const formatSQL = () => {
  const formatted = sqlQuery.value
    .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|HAVING|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/gi, '\n$1')
    .replace(/;/g, ';\n')
    .trim();
  sqlQuery.value = formatted;
};

const clearSQL = () => {
  sqlQuery.value = '';
  sqlResults.value = null;
  sqlError.value = null;
};

const showTableSchema = async (tableName: string) => {
  sqlQuery.value = `PRAGMA table_info(${tableName});`;
  await runSQL();
};

// Linux Terminal Functions
const addTerminalLine = (type: 'command' | 'output' | 'error' | 'info', content: string, prompt?: string) => {
  terminalLines.value.push({ type, content, prompt });

  nextTick(() => {
    if (terminalContent.value) {
      terminalContent.value.scrollTop = terminalContent.value.scrollHeight;
    }
  });
};

const clearTerminal = () => {
  terminalLines.value = [];
  currentCommand.value = '';

  nextTick(() => {
    if (commandInput.value) {
      commandInput.value.focus();
    }
  });

  showToast('Terminal Cleared', 'All terminal content has been cleared', 'info');
};

const copyTerminalContent = () => {
  const content = terminalLines.value
    .map(line => {
      if (line.type === 'command') {
        return `${line.prompt || `${username.value}@lab-server:~$`} ${line.content}`;
      }
      return line.content;
    })
    .join('\n');

  navigator.clipboard.writeText(content);
  showToast('Copied', 'Terminal content copied to clipboard', 'success');
};

const runLinuxCommand = async () => {
  const command = currentCommand.value.trim();
  if (!command || runningProcess.value) return;

  if (command === 'clear') {
    clearTerminal();
    if (!commandHistory.value.includes(command)) {
      commandHistory.value.unshift(command);
      if (commandHistory.value.length > 100) {
        commandHistory.value.pop();
      }
    }
    historyIndex.value = -1;
    currentCommand.value = '';
    return;
  }

  if (!commandHistory.value.includes(command)) {
    commandHistory.value.unshift(command);
    if (commandHistory.value.length > 100) {
      commandHistory.value.pop();
    }
  }
  historyIndex.value = -1;

  addTerminalLine('command', command, `${username.value}@lab-server:~$`);

  runningProcess.value = true;
  const savedCommand = command;
  currentCommand.value = '';

  try {
    const result = await labService.runLinuxCommand(username.value, command);

    if (result.output && result.output.trim()) {
      addTerminalLine('output', result.output.trim());
    }
    if (result.error && result.error.trim()) {
      addTerminalLine('error', result.error.trim());
    }

    if (result.note) {
      addTerminalLine('info', result.note);
      showToast('Workspace moved', result.note, 'warning');
    }

    if (result.error) {
      showToast('Command Error', result.error, 'error');
    } else {
      showToast('Command Executed', `Command "${savedCommand}" completed`, 'success');
    }

  } catch (err: any) {
    const errorMessage = err.message || 'Failed to execute command';
    addTerminalLine('error', errorMessage);
    showToast('Error', errorMessage, 'error');
  } finally {
    runningProcess.value = false;

    nextTick(() => {
      if (commandInput.value) {
        commandInput.value.focus();
      }
    });
  }
};

const killProcess = async () => {
  if (!runningProcess.value) return;

  try {
    await labService.killProcess(username.value);
    addTerminalLine('info', 'Process terminated by user');
    runningProcess.value = false;
    showToast('Process Killed', 'Current process has been terminated', 'warning');
  } catch (err: any) {
    showToast('Error', 'Failed to kill process', 'error');
  }
};

const insertCommand = (command: string) => {
  currentCommand.value = command;
  nextTick(() => {
    if (commandInput.value) {
      commandInput.value.focus();
      commandInput.value.setSelectionRange(command.length, command.length);
    }
  });
};

const commandHistoryUp = () => {
  if (commandHistory.value.length === 0) return;

  if (historyIndex.value < commandHistory.value.length - 1) {
    historyIndex.value++;
    currentCommand.value = commandHistory.value[historyIndex.value];
  }
};

const commandHistoryDown = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--;
    currentCommand.value = commandHistory.value[historyIndex.value];
  } else if (historyIndex.value === 0) {
    historyIndex.value = -1;
    currentCommand.value = '';
  }
};

const handleTabCompletion = () => {
  if (!currentCommand.value.trim()) return;

  const currentInput = currentCommand.value.trim();
  const matchingCommands = linuxCommands.filter(cmd =>
    cmd.startsWith(currentInput)
  );

  if (matchingCommands.length === 1) {
    currentCommand.value = matchingCommands[0];
  } else if (matchingCommands.length > 1) {
    addTerminalLine('info', `Suggestions: ${matchingCommands.join(', ')}`);
  }
};

const handleCtrlC = () => {
  if (runningProcess.value) {
    killProcess();
  } else {
    currentCommand.value = '';
  }
};

const focusCommandInput = () => {
  if (commandInput.value) {
    commandInput.value.focus();
  }
};

// Python Functions
const runPythonCode = async () => {
  if (!pythonCode.value.trim() || runningPython.value) return;

  runningPython.value = true;
  pythonOutput.value = null;
  pythonError.value = null;

  try {
    const result = await labService.runPythonCode(username.value, pythonCode.value);

    if (result.error) {
      pythonError.value = result.error;
      showToast('Python Error', result.error, 'error');
    } else {
      pythonOutput.value = result.output || '';
      if (result.error) {
        pythonError.value = result.error;
      }
      showToast('Code Executed', 'Python code executed successfully', 'success');
    }
  } catch (err: any) {
    pythonError.value = err.message || 'Failed to execute Python code';
    showToast('Error', pythonError.value || 'Something went wrong.', 'error');
  } finally {
    runningPython.value = false;
  }
};

const clearPythonCode = () => {
  pythonCode.value = '';
};

const clearPythonOutput = () => {
  pythonOutput.value = null;
  pythonError.value = null;
};

const insertPythonTemplate = () => {
  pythonCode.value = `# Python Template
# Write your code below this line

def main():
    print("Hello from Python Lab!")

    # Example: Calculate factorial
    def factorial(n):
        if n == 0:
            return 1
        return n * factorial(n - 1)

    print(f"Factorial of 5 is: {factorial(5)}")

    # Example: List comprehension
    squares = [x**2 for x in range(10)]
    print(f"Squares: {squares}")

if __name__ == "__main__":
    main()`;
};

const insertPythonExample = (type: string) => {
  const examples: Record<string, string> = {
    hello: `# Hello World
print("Hello, World!")

# Variables
name = "Python Learner"
age = 25
print(f"Name: {name}, Age: {age}")`,

    loop: `# For Loop Example
print("Counting from 1 to 10:")
for i in range(1, 11):
    print(f"Number: {i}")

# While Loop
print("\\nCounting down from 5:")
count = 5
while count > 0:
    print(count)
    count -= 1
print("Blast off!")`,

    function: `# Function Example
def greet(name):
    return f"Hello, {name}!"

def calculate_sum(a, b):
    return a + b

# Using functions
print(greet("Student"))
print(f"Sum of 5 and 3: {calculate_sum(5, 3)}")

# Lambda function
square = lambda x: x ** 2
print(f"Square of 4: {square(4)}")`,

    file: `# File I/O Example
import os

# Create and write to a file
filename = "example.txt"
with open(filename, 'w') as file:
    file.write("Hello from Python Lab!\\n")
    file.write("This is a test file.\\n")

print(f"File '{filename}' created and written.")

# Read from the file
print("\\nReading file content:")
with open(filename, 'r') as file:
    content = file.read()
    print(content)

# List files in current directory
print("\\nFiles in directory:")
for file in os.listdir('.'):
    print(f"  - {file}")`
  };

  if (examples[type]) {
    pythonCode.value = examples[type];
    showToast('Example Loaded', `${type.replace('_', ' ')} example loaded`, 'info');
  }
};

// Lifecycle
onMounted(() => {
  if (hasLabAccess.value) {
    initializeLab();
  }

  // Focus command input when Linux tab is active
  watch(activeTab, (newTab) => {
    if (newTab === 'linux' && commandInput.value) {
      nextTick(() => {
        commandInput.value?.focus();
      });
    }
  });
});

// Initialize when lab access becomes available
watch(hasLabAccess, (newValue) => {
  if (newValue && !loading.value && !error.value) {
    initializeLab();
  }
});
</script>

<style scoped>
/* Import lab styles */
@import '@/assets/css/lab.css';
</style>