import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

/**
 * Every `VITE_*` variable is inlined as a string literal into the published
 * bundle. That makes a leaked credential a *publishing* mistake, not a config
 * mistake — and by the time GitHub's push protection catches it, the value has
 * already been written into a local commit.
 *
 * So fail the build instead. Loudly, locally, before anything leaves the machine.
 */
const SECRET_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'GitHub fine-grained personal access token', re: /^github_pat_[A-Za-z0-9_]{20,}$/ },
  { label: 'GitHub personal access token', re: /^ghp_[A-Za-z0-9]{20,}$/ },
  { label: 'GitHub OAuth / app token', re: /^gh[ousr]_[A-Za-z0-9]{20,}$/ },
  { label: 'OpenAI API key', re: /^sk-[A-Za-z0-9_-]{20,}$/ },
  { label: 'Google API key', re: /^AIza[A-Za-z0-9_-]{30,}$/ },
  { label: 'AWS access key id', re: /^A(KIA|SIA)[A-Z0-9]{16}$/ },
  { label: 'Slack token', re: /^xox[baprs]-[A-Za-z0-9-]{10,}$/ },
  { label: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

/** Variables that must hold a URL. A credential here is always a mistake. */
const URL_ONLY_VARS = [
  'VITE_API_BASE_REGISTRY',
  'VITE_REGISTRY_ALT',
  'VITE_NETSIM_STORAGE_PROXY',
]

function guardEnvSecrets(mode: string): Plugin {
  return {
    name: 'selfstudy:guard-env-secrets',
    enforce: 'pre',
    apply: 'build',
    config() {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const problems: string[] = []

      for (const [key, raw] of Object.entries(env)) {
        const value = (raw || '').trim()
        if (!value) continue

        for (const { label, re } of SECRET_PATTERNS) {
          if (re.test(value)) {
            problems.push(
              `  ${key} looks like a ${label}.\n` +
              `    A VITE_* variable is compiled into dist/assets/*.js and served publicly.\n` +
              `    Anyone loading the site could read and use it. Remove it from .env.`
            )
            break
          }
        }

        if (URL_ONLY_VARS.includes(key) && !/^https?:\/\//i.test(value)) {
          problems.push(
            `  ${key} must be an http(s) URL, but is "${value.slice(0, 12)}…".\n` +
            `    This variable is a service endpoint, never a credential.`
          )
        }
      }

      if (problems.length) {
        throw new Error(
          `\n\n✖ Build stopped: a secret would have been published in the JavaScript bundle.\n\n` +
          problems.join('\n\n') +
          `\n\nA browser app cannot keep a secret. If the value must stay private, it belongs\n` +
          `on a backend that the frontend calls — see the "Storage modes" section of README.md.\n`
        )
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [guardEnvSecrets(mode), vue()],

  // Base path:
  // - '/' for custom domain (yourdomain.com) or username.github.io root
  // - '/repo-name/' for username.github.io/repo-name
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // No /media proxy on purpose: the media backends send
  // `Access-Control-Allow-Origin: *`, so images load directly in dev exactly
  // as they do in production. A dev-only proxy here would hide prod CORS bugs.
  server: {
    port: 3000,
    host: true,
  },
}))
