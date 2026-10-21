<template>
  <section class="az-cshell" :class="{ 'is-max': maximized }" aria-label="Cloud Shell">
    <div class="az-cshell__bar">
      <label class="az-cshell__mode">
        <select v-model="mode" aria-label="Shell" @change="restart">
          <option value="bash">Bash</option>
          <option value="pwsh">PowerShell</option>
        </select>
      </label>
      <span class="az-cshell__sep"></span>
      <button type="button" class="az-cshell__btn" title="Restart" aria-label="Restart" @click="restart"><AzIcon name="restart" :size="14" /></button>
      <button type="button" class="az-cshell__btn" title="Clear" aria-label="Clear" @click="term?.clear()"><AzIcon name="trash" :size="14" /></button>
      <button type="button" class="az-cshell__btn" title="Help" aria-label="Help" @click="term?.print(HELP, 'info')"><AzIcon name="help" :size="14" /></button>
      <span class="az-cshell__label">Cloud Shell <span class="az-cshell__sim">simulated · runs az and bicep against this lab</span></span>
      <span class="az-cshell__grow"></span>
      <button type="button" class="az-cshell__btn" :title="maximized ? 'Restore' : 'Maximize'" :aria-label="maximized ? 'Restore' : 'Maximize'"
              @click="maximized = !maximized"><AzIcon :name="maximized ? 'chevrondown' : 'chevron'" :size="12" /></button>
      <button type="button" class="az-cshell__btn" title="Close" aria-label="Close" @click="$emit('close')"><AzIcon name="close" :size="14" /></button>
    </div>
    <div class="az-cshell__screen">
      <AzTerminal ref="term" :key="session" :prompt="prompt" :banner="banner" :send="send" label="Cloud Shell input" @exit="$emit('close')" />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Cloud Shell, docked at the bottom of the portal as the real one is.
 *
 * It runs exactly what the CLI console beside the portal runs - the lab's `az`
 * and `bicep` against the lab's subscription - through the same `api.exec`, so
 * a resource created here appears in the portal above it on the next line and
 * every line is in the equivalent-CLI drawer. There is no file system or Linux
 * shell behind it; anything that is not `az`/`bicep` says so rather than
 * pretending.
 */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import AzIcon from './AzIcon';
import AzTerminal, { type TermReply } from './AzTerminal.vue';

const props = defineProps<{ api: PortalApi }>();
defineEmits<{ (event: 'close'): void }>();
const term = ref<InstanceType<typeof AzTerminal> | null>(null);
const mode = ref<'bash' | 'pwsh'>('bash');
const maximized = ref(false);
const session = ref(1);

const HELP = 'Cloud Shell in this lab runs the Azure CLI (az) and bicep against the lab subscription.\n'
  + 'Try: az group list -o table · az vm list -o table · az account show\n'
  + 'Local commands: clear, help, exit. Up/Down recall history; Ctrl+L clears.';
const banner = computed(() => `Requesting a Cloud Shell.Succeeded.\nConnecting terminal...\n\nWelcome to Azure Cloud Shell\n\n`
  + `Type "az" to use Azure CLI\nType "help" to learn about Cloud Shell\n`);
const prompt = computed(() => (mode.value === 'bash' ? 'lab@Azure:~$ ' : 'PS /home/lab> '));

function restart() { session.value += 1; }

async function send(line: string): Promise<TermReply> {
  const text = line.trim();
  const word = text.split(/\s+/)[0];
  if (text === 'clear' || text === 'cls' || text === 'Clear-Host') return { clear: true };
  if (text === 'help') return { text: HELP };
  if (text === 'exit') return { exit: true };
  if (word !== 'az' && word !== 'bicep') {
    return { text: mode.value === 'bash' ? `bash: ${word}: command not found (this Cloud Shell runs az and bicep)`
      : `${word}: The term '${word}' is not recognized in this Cloud Shell (it runs az and bicep).`, error: true };
  }
  // The line is the student's own, verbatim - exactly as the CLI console takes it.
  const result = await props.api.exec(text, { quiet: true });
  if (result.ok) return { text: String(result.output || '') };
  return { text: [String(result.output || '').trim(), String(result.error || '').trim()].filter(Boolean).join('\n')
    || 'The command failed.', error: true };
}
</script>

<style scoped>
.az-cshell { position: relative; z-index: 46; flex: none; display: flex; flex-direction: column; height: 42%; min-height: 180px;
  border-top: 1px solid #3b3b3b; background: #0c0c0c; }
.az-cshell.is-max { position: absolute; inset: 40px 0 0 0; height: auto; }
.az-cshell__bar { flex: none; display: flex; align-items: center; gap: 2px; height: 34px; padding: 0 6px; background: #1f1f1f; color: #fff; }
.az-cshell__mode select { height: 26px; padding: 0 6px; border: 1px solid #5c5c5c; border-radius: 4px; background: #2b2b2b; color: #fff;
  font: 12px var(--az-font); color-scheme: dark; }
.az-cshell__sep { width: 1px; height: 18px; margin: 0 6px; background: #4d4d4d; }
.az-cshell__btn { display: grid; place-items: center; width: 30px; height: 28px; border: 0; border-radius: 4px; background: transparent;
  color: #fff; cursor: pointer; }
.az-cshell__btn:hover { background: #383838; }
.az-cshell__label { margin-left: 8px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.az-cshell__sim { color: #a6a6a6; margin-left: 6px; }
.az-cshell__grow { flex: 1 1 auto; }
.az-cshell__screen { flex: 1 1 auto; min-height: 0; }
@container sl-portal (max-width: 640px) { .az-cshell__sim { display: none; } }
</style>
