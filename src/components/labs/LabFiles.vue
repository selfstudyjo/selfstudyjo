<template>
  <div class="sl-files">
    <div class="sl-console__head">
      <div class="sl-console__title">
        <Files class="sl-i" />
        <span>{{ $t('Files') }}</span>
      </div>
      <div class="sl-console__actions">
        <button type="button" class="sl-btn sl-btn--ghost sl-btn--sm" @click="refresh">
          <RotateCw class="sl-i" /> {{ $t('Refresh') }}
        </button>
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm"
                :disabled="saving || !path.trim()" @click="save">
          <Save class="sl-i" /> {{ $t('Save') }}
        </button>
      </div>
    </div>

    <p class="sl-console__fidelity">
      {{ $t('These files are what every tool in this lab sees. Write a Dockerfile, a manifest or a .tf file here and run it in the console.') }}
    </p>

    <div class="sl-files__body">
      <aside class="sl-files__list">
        <p v-if="entries.length === 0" class="sl-files__empty">{{ $t('No files yet') }}</p>
        <button
          v-for="entry in entries"
          :key="entry.path"
          type="button"
          class="sl-files__item"
          :class="{ 'is-active': entry.path === path }"
          @click="open(entry.path)"
        >
          <span class="sl-files__name" dir="ltr">{{ entry.path }}</span>
          <span class="sl-files__size">{{ entry.bytes }}</span>
        </button>
      </aside>

      <div class="sl-files__editor">
        <div class="sl-files__pathrow">
          <input
            v-model="path"
            class="sl-files__path"
            dir="ltr"
            spellcheck="false"
            :placeholder="$t('file name, e.g. Dockerfile')"
          >
          <button type="button" class="sl-btn sl-btn--danger sl-btn--sm"
                  :disabled="!exists" @click="remove">
            <Trash2 class="sl-i" />
          </button>
        </div>
        <!-- LTR: these are Dockerfiles, YAML manifests and HCL. Mirrored, the
             indentation reads from the wrong side and YAML stops being valid. -->
        <textarea
          v-model="content"
          class="sl-files__text"
          dir="ltr"
          spellcheck="false"
          rows="18"
          @keydown.tab.prevent="indent"
        ></textarea>
        <p v-if="message" class="sl-files__msg" :class="{ 'is-error': failed }">
          {{ message }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Files tool: one filesystem, shared by every engine in the lab.
 *
 * That sharing is the whole reason this exists as a tool rather than as a text
 * box inside each console. A student writes `docker-compose.yml` here and runs
 * `docker compose up`; writes `deployment.yaml` and runs `kubectl apply -f`;
 * writes `main.tf` and runs `terraform init`. The backend keeps ONE `files` dict
 * and injects it into whichever engine is about to run — see `utils/labenv.py`.
 *
 * **The path is validated by the backend, not here**, and the error is shown as
 * it came back. A client-side rule that disagreed with the server's would be a
 * second copy of the containment check, and the one that matters is the one on
 * the machine.
 */
import { onMounted, ref, watch } from 'vue';
import { Files, RotateCw, Save, Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  list: () => Promise<Array<{ path: string; bytes: number }>>;
  read: (path: string) => Promise<string>;
  write: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>;
  remove?: (path: string) => Promise<{ ok: boolean; error?: string }>;
}>();

const emit = defineEmits<{ (event: 'changed'): void }>();

const entries = ref<Array<{ path: string; bytes: number }>>([]);
const path = ref('');
const content = ref('');
const message = ref('');
const failed = ref(false);
const saving = ref(false);
const exists = ref(false);

async function refresh() {
  entries.value = await props.list();
  if (!path.value && entries.value.length) await open(entries.value[0].path);
}

async function open(target: string) {
  path.value = target;
  exists.value = true;
  message.value = '';
  failed.value = false;
  content.value = await props.read(target);
}

async function save() {
  const target = path.value.trim();
  if (!target) return;
  saving.value = true;
  message.value = '';
  failed.value = false;
  try {
    const result = await props.write(target, content.value);
    if (result?.ok) {
      message.value = 'Saved';
      exists.value = true;
      await refresh();
      emit('changed');
    } else {
      failed.value = true;
      message.value = result?.error || 'That file could not be saved';
    }
  } finally {
    saving.value = false;
  }
}

async function removeFile() {
  if (!props.remove || !path.value) return;
  const result = await props.remove(path.value);
  if (result?.ok) {
    path.value = '';
    content.value = '';
    exists.value = false;
    await refresh();
    emit('changed');
  } else {
    failed.value = true;
    message.value = result?.error || 'That file could not be deleted';
  }
}

function indent(event: KeyboardEvent) {
  const field = event.target as HTMLTextAreaElement;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  content.value = content.value.slice(0, start) + '  ' + content.value.slice(end);
  requestAnimationFrame(() => {
    field.selectionStart = field.selectionEnd = start + 2;
  });
}

defineExpose({ refresh });
onMounted(refresh);
watch(path, () => {
  exists.value = entries.value.some(entry => entry.path === path.value);
});

// `remove` is the prop name AND the handler name, so the template binds the
// local one explicitly.
const remove = removeFile;
</script>
