<template>
  <div class="labs-container">
    <!-- Header Section -->
    <div class="labs-header">
      <div class="header-content">
        <h1><i class="fas fa-flask"></i> Virtual Labs</h1>
        <p>Practice SQL, Linux, and Python in a safe sandbox environment</p>
      </div>
      <div class="header-stats">
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-database"></i>
          </div>
          <div class="stat-info">
            <span class="stat-number">SQL</span>
            <span class="stat-label">Database</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-terminal"></i>
          </div>
          <div class="stat-info">
            <span class="stat-number">Linux</span>
            <span class="stat-label">Terminal</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-code"></i>
          </div>
          <div class="stat-info">
            <span class="stat-number">Python</span>
            <span class="stat-label">Compiler</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Initializing lab environment...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Unable to Access Labs</h3>
      <p>{{ error }}</p>
      <button class="btn btn-secondary" @click="initializeLab">
        <i class="fas fa-redo"></i> Try Again
      </button>
    </div>

    <!-- No Lab Access -->
    <div v-else-if="!hasLabAccess" class="no-access-state">
      <i class="fas fa-flask"></i>
      <h3>No Lab Access</h3>
      <p>You don't have access to virtual labs. Please contact your administrator to enable lab access.</p>
      <router-link to="/profile" class="btn btn-primary">
        <i class="fas fa-user-cog"></i> Go to Profile
      </router-link>
    </div>

    <!-- Main Content -->
    <div v-else class="labs-main">
      <!-- Lab Info Banner -->
      <div class="lab-info-banner">
        <div class="lab-info-content">
          <i class="fas fa-info-circle"></i>
          <div>
            <strong>Lab Environment:</strong> Connected to {{ labUrlDisplay }}
            <span v-if="studentRecord" class="student-info">
              • Student ID: {{ studentRecord.uuid_credentials }}
            </span>
            <span v-else class="student-info warning">
              • Student record not found, but you can still use labs
            </span>
          </div>
        </div>
        <button class="btn btn-sm btn-outline" @click="refreshLabStatus">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': refreshing }"></i> Refresh
        </button>
      </div>

      <!-- Tabs Navigation -->
      <div class="tabs-navigation">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <i :class="tab.icon"></i> {{ tab.label }}
        </button>
      </div>

      <!-- SQL Tab -->
      <div v-if="activeTab === 'sql'" class="tab-content">
        <div class="sql-container">
          <div class="sql-sidebar">
            <h4><i class="fas fa-table"></i> Database Tables</h4>
            <div class="tables-list">
              <div v-for="table in sqlTables" :key="table" class="table-item">
                <i class="fas fa-table"></i>
                <span>{{ table }}</span>
                <button class="btn-sm" @click="showTableSchema(table)">
                  <i class="fas fa-info-circle"></i>
                </button>
              </div>
            </div>

            <div class="sql-instructions">
              <h5><i class="fas fa-lightbulb"></i> Quick Tips</h5>
              <ul>
                <li>Use <code>SELECT * FROM table_name;</code> to view all data</li>
                <li>Use <code>DESCRIBE table_name;</code> to see table structure</li>
                <li>End each query with a semicolon (;)</li>
                <li>Try: <code>SELECT * FROM sqlite_master WHERE type='table';</code></li>
              </ul>
            </div>
          </div>

          <div class="sql-main">
            <div class="sql-editor">
              <div class="editor-header">
                <h4><i class="fas fa-edit"></i> SQL Query Editor</h4>
                <div class="editor-actions">
                  <button class="btn btn-sm" @click="formatSQL">
                    <i class="fas fa-align-left"></i> Format
                  </button>
                  <button class="btn btn-sm" @click="clearSQL">
                    <i class="fas fa-trash"></i> Clear
                  </button>
                </div>
              </div>
              <div class="editor-container">
                <textarea
                  v-model="sqlQuery"
                  placeholder="Enter your SQL query here..."
                  class="sql-textarea"
                  :disabled="runningSQL"
                  @keydown.ctrl.enter="runSQL"
                ></textarea>
                <div class="editor-footer">
                  <div class="query-info">
                    <span v-if="lastSQLQuery">
                      Last query: {{ lastSQLQuery.substring(0, 50) }}...
                    </span>
                  </div>
                  <button
                    class="btn btn-primary"
                    @click="runSQL"
                    :disabled="!sqlQuery.trim() || runningSQL"
                  >
                    <i class="fas fa-play" :class="{ 'fa-spin': runningSQL }"></i>
                    {{ runningSQL ? 'Running...' : 'Run Query' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="sql-results">
              <div class="results-header">
                <h4><i class="fas fa-poll"></i> Results</h4>
                <div class="results-info">
                  <span v-if="sqlResults">
                    {{ sqlResults.length }} row(s) returned
                  </span>
                </div>
              </div>
              <div class="results-container">
                <div v-if="sqlError" class="error-message">
                  <i class="fas fa-exclamation-circle"></i>
                  <div>
                    <strong>SQL Error:</strong> {{ sqlError }}
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
                  <i class="fas fa-database"></i>
                  <p>No results yet. Run a query to see results here.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Linux Tab - COMPLETELY REVISED TERMINAL -->
      <div v-else-if="activeTab === 'linux'" class="tab-content">
        <div class="linux-container">
          <div class="terminal-wrapper">
            <!-- Terminal Header -->
            <div class="terminal-header">
              <div class="terminal-title">
                <i class="fas fa-terminal"></i>
                Linux Terminal - {{ username }}@lab-server
                <span class="terminal-status" v-if="runningProcess">
                  <i class="fas fa-spinner fa-spin"></i> Process running...
                </span>
              </div>
              <div class="terminal-actions">
                <button class="btn btn-sm" @click="clearTerminal" title="Clear terminal">
                  <i class="fas fa-broom"></i> Clear
                </button>
                <button class="btn btn-sm btn-danger" @click="killProcess"
                        :disabled="!runningProcess" title="Stop current process">
                  <i class="fas fa-stop"></i> Stop
                </button>
                <button class="btn btn-sm" @click="copyTerminalContent" title="Copy terminal content">
                  <i class="fas fa-copy"></i> Copy
                </button>
              </div>
            </div>

            <!-- Terminal Content -->
            <div class="terminal-content" ref="terminalContent" @click="focusCommandInput">
              <!-- Welcome message -->
              <div v-if="terminalLines.length === 0" class="terminal-welcome">
                <div class="welcome-line">🌐 Welcome to Linux Terminal Lab!</div>
                <div class="welcome-line">📁 Type 'help' for available commands</div>
                <div class="welcome-line">💡 Press ↑/↓ for command history • Tab for auto-completion</div>
                <div class="welcome-separator">──────────────────────────────────────────────</div>
              </div>

              <!-- Terminal Lines -->
              <div v-for="(line, index) in terminalLines" :key="index" :class="['terminal-line', line.type]">
                <span class="line-prompt" v-if="line.type === 'command'">{{ line.prompt || `${username}@lab-server:~$` }}</span>
                <span class="line-content">{{ line.content }}</span>
              </div>

              <!-- Current Command Input Line -->
              <div class="terminal-input-line">
                <span class="input-prompt">{{ username }}@lab-server:~$</span>
                <div class="input-wrapper">
                  <input
                    v-model="currentCommand"
                    type="text"
                    class="command-input"
                    :placeholder="commandHistory.length > 0 ? '' : 'Type a command and press Enter...'"
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
                  <span class="cursor" v-if="!runningProcess && currentCommand.length === 0">█</span>
                  <span class="cursor" v-else-if="!runningProcess">|</span>
                  <span class="running-indicator" v-if="runningProcess">
                    <i class="fas fa-spinner fa-spin"></i>
                  </span>
                </div>
              </div>
            </div>

            <!-- Terminal Help Section -->
            <div class="terminal-help">
              <div class="help-header">
                <i class="fas fa-bolt"></i> Quick Commands (Click to insert)
              </div>
              <div class="commands-grid">
                <button class="cmd-btn" @click="insertCommand('pwd')" title="Print working directory">
                  <code>pwd</code> Current directory
                </button>
                <button class="cmd-btn" @click="insertCommand('ls -la')" title="List files with details">
                  <code>ls -la</code> List files
                </button>
                <button class="cmd-btn" @click="insertCommand('whoami')" title="Display current user">
                  <code>whoami</code> Current user
                </button>
                <button class="cmd-btn" @click="insertCommand('date')" title="Show current date and time">
                  <code>date</code> Date & time
                </button>
                <button class="cmd-btn" @click="insertCommand('mkdir test_folder')" title="Create directory">
                  <code>mkdir</code> Create folder
                </button>
                <button class="cmd-btn" @click="insertCommand('touch file.txt')" title="Create empty file">
                  <code>touch</code> Create file
                </button>
                <button class="cmd-btn" @click="insertCommand('echo Hello from terminal')" title="Print text">
                  <code>echo</code> Print text
                </button>
                <button class="cmd-btn" @click="insertCommand('clear')" title="Clear terminal">
                  <code>clear</code> Clear screen
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
              <h4><i class="fas fa-code"></i> Python Code Editor</h4>
              <div class="editor-actions">
                <button class="btn btn-sm" @click="insertPythonTemplate">
                  <i class="fas fa-file-code"></i> Template
                </button>
                <button class="btn btn-sm" @click="clearPythonCode">
                  <i class="fas fa-trash"></i> Clear
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
                  <span>{{ pythonCode.length }} characters</span>
                </div>
                <button
                  class="btn btn-primary"
                  @click="runPythonCode"
                  :disabled="!pythonCode.trim() || runningPython"
                >
                  <i class="fas fa-play" :class="{ 'fa-spin': runningPython }"></i>
                  {{ runningPython ? 'Running...' : 'Run Code' }}
                </button>
              </div>
            </div>
          </div>

          <div class="python-output">
            <div class="output-header">
              <h4><i class="fas fa-terminal"></i> Output</h4>
              <div class="output-actions">
                <button class="btn btn-sm" @click="clearPythonOutput">
                  <i class="fas fa-trash"></i> Clear
                </button>
              </div>
            </div>
            <div class="output-container">
              <div v-if="pythonError" class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <div>
                  <strong>Python Error:</strong>
                  <pre>{{ pythonError }}</pre>
                </div>
              </div>

              <div v-else-if="pythonOutput" class="output-content">
                <pre>{{ pythonOutput }}</pre>
              </div>

              <div v-else class="empty-output">
                <i class="fas fa-code"></i>
                <p>Run your Python code to see output here.</p>
              </div>
            </div>

            <div class="python-templates">
              <h5><i class="fas fa-lightbulb"></i> Quick Examples</h5>
              <div class="templates-grid">
                <button class="template-btn" @click="insertPythonExample('hello')">
                  Hello World
                </button>
                <button class="template-btn" @click="insertPythonExample('loop')">
                  For Loop
                </button>
                <button class="template-btn" @click="insertPythonExample('function')">
                  Function
                </button>
                <button class="template-btn" @click="insertPythonExample('file')">
                  File I/O
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
        <i :class="toast.icon"></i>
        <div class="toast-content">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" @click="removeToast(toast.id)">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { labService, type Student, type SQLResult, type CommandResult } from '@/services/lab.service';

const authStore = useAuthStore();
const terminalContent = ref<HTMLElement | null>(null);
const commandInput = ref<HTMLInputElement | null>(null);

// User info
const username = computed(() => authStore.user?.username || '');
const labUrl = computed(() => authStore.user?.lab_url || '');
const labUrlDisplay = computed(() => {
  if (!labUrl.value) return 'Not connected';
  try {
    const url = new URL(labUrl.value);
    return url.hostname;
  } catch {
    return labUrl.value;
  }
});
const hasLabAccess = computed(() => authStore.hasLabAccess);
const studentRecord = ref<Student | null>(null);

// State
const loading = ref(false);
const error = ref<string | null>(null);
const refreshing = ref(false);
const activeTab = ref('sql');

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
  icon: string;
}>>([]);
let toastId = 0;

// Tabs configuration
const tabs = [
  { id: 'sql', label: 'SQL Database', icon: 'fas fa-database' },
  { id: 'linux', label: 'Linux Terminal', icon: 'fas fa-terminal' },
  { id: 'python', label: 'Python Compiler', icon: 'fas fa-code' }
];

// Initialize lab
const initializeLab = async () => {
  if (!hasLabAccess.value) {
    error.value = 'No lab access configured for your account';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Try to get or create student record
    try {
      studentRecord.value = await labService.getOrCreateStudent(username.value, labUrl.value);
    } catch (studentError) {
      console.warn('Failed to get student record:', studentError);
    }

    if (studentRecord.value) {
      showToast('Success', 'Lab environment initialized successfully', 'success');
    } else {
      showToast('Info', 'Lab environment ready (student record may not exist)', 'info');
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
    showToast('Error', error.value, 'error');
  } finally {
    loading.value = false;
  }
};

// Refresh lab status
const refreshLabStatus = async () => {
  refreshing.value = true;
  try {
    studentRecord.value = await labService.getOrCreateStudent(username.value, labUrl.value);
    if (studentRecord.value) {
      showToast('Refreshed', 'Lab status updated', 'success');
    } else {
      showToast('Info', 'Lab ready (no student record)', 'info');
    }
  } catch (err: any) {
    console.error('Failed to refresh lab status:', err);
    showToast('Warning', 'Could not refresh lab status', 'warning');
  } finally {
    refreshing.value = false;
  }
};

// Toast functions
const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const id = ++toastId;
  toasts.value.push({
    id,
    title,
    message,
    type,
    icon: icons[type]
  });

  // Auto-remove after 5 seconds
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
    const result = await labService.runSQL(username.value, labUrl.value, sqlQuery.value);
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
    const result = await labService.runSQL(username.value, labUrl.value, sqlQuery.value);

    if (result.error) {
      sqlError.value = result.error;
      showToast('SQL Error', result.error, 'error');
    } else if (result.result) {
      sqlResults.value = result.result;
      showToast('Success', `Query executed successfully. ${result.result.length} row(s) returned.`, 'success');

      // Refresh tables list if query shows tables
      if (sqlQuery.value.toLowerCase().includes('table')) {
        await loadSQLTables();
      }
    }
  } catch (err: any) {
    sqlError.value = err.message || 'Failed to execute SQL query';
    showToast('Error', sqlError.value, 'error');
  } finally {
    runningSQL.value = false;
  }
};

const formatSQL = () => {
  // Simple SQL formatting
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

  // Auto-scroll to bottom
  nextTick(() => {
    if (terminalContent.value) {
      terminalContent.value.scrollTop = terminalContent.value.scrollHeight;
    }
  });
};

const clearTerminal = () => {
  // Clear terminal lines
  terminalLines.value = [];

  // Reset command input
  currentCommand.value = '';

  // Focus back on input
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

  // Handle clear command locally
  if (command === 'clear') {
    clearTerminal();
    // Add command to history
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

  // Add to history (avoid duplicates)
  if (!commandHistory.value.includes(command)) {
    commandHistory.value.unshift(command);
    if (commandHistory.value.length > 100) {
      commandHistory.value.pop();
    }
  }
  historyIndex.value = -1;

  // Display command in terminal
  addTerminalLine('command', command, `${username.value}@lab-server:~$`);

  runningProcess.value = true;
  const savedCommand = command;
  currentCommand.value = '';

  try {
    const result = await labService.runLinuxCommand(username.value, labUrl.value, command);

    // Display output/error
    if (result.output && result.output.trim()) {
      addTerminalLine('output', result.output.trim());
    }
    if (result.error && result.error.trim()) {
      addTerminalLine('error', result.error.trim());
    }

    // Show toast notification
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

    // Focus back on input
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
    await labService.killProcess(username.value, labUrl.value);
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
    const result = await labService.runPythonCode(username.value, labUrl.value, pythonCode.value);

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
    showToast('Error', pythonError.value, 'error');
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
