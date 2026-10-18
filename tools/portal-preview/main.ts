// Mounts LabPortal for one skin against a real local app 11. See vite.config.ts.
//
//   ?skin=aws|azure|ambari|sparkui|fabric|jira|servicenow
//   ?lab=<lab id>                 defaults per skin
//   ?api=http://127.0.0.1:5311    the local backend (python _portal_server.py)
//   ?user=student                 whose environment
//   ?reset=1                      start the lab from scratch
//   ?lang=ar                      the platform strings around the product
//   ?frame=900                    cap the portal's width, as the lab workspace's
//                                 pane does beside the task list
import { createApp, h, ref } from 'vue';
// EVERY global stylesheet the app loads, in main.ts's order. A skin is drawn
// inside the app's cascade - theme.css styles bare buttons and fields, and
// responsive.css resizes them on a touch screen - so a harness that loaded only
// some of these would photograph a skin no student is served.
import '@/assets/css/theme.css';
import '@/assets/css/responsive.css';
import '@/style.css';
import '@/assets/css/ui.css';
import '@/assets/css/labs.css';
import '@/assets/css/tour.css';
import '@/assets/css/assistant.css';
import '@/assets/css/rtl.css';
import { i18n, setLocale } from '@/i18n/runtime';
import type { LocaleId } from '@/i18n/locales';
import LabPortal from '@/components/labs/portals/LabPortal.vue';

const params = new URLSearchParams(location.search);
const skin = params.get('skin') || 'aws';
const DEFAULT_LAB: Record<string, string> = {
  aws: 'aws-06-architecture',
  awsops: 'ops-08-vpc',
  azure: 'azure-05-arm',
  ambari: 'bigdata-06-pipeline',
  sparkui: 'bigdata-05-spark',
  fabric: 'fab-20-capstone-asset-product',
  jira: 'mgr-14-quarter',
  docker: 'docker-06-compose',
  k8s: 'k8s-06-helm',
  jenkins: 'jen-06-cd',
  hcpterraform: 'tf-06-project',
  githubdesktop: 'git-03-conflict',
  mlflow: 'ml-13-endtoend',
  servicenow: 'ops-03-major-incident',
};
const labId = params.get('lab') || DEFAULT_LAB[skin] || 'aws-06-architecture';
const api = (params.get('api') || 'http://127.0.0.1:5311').replace(/\/$/, '');
const user = params.get('user') || 'student';
setLocale((params.get('lang') || 'en') as LocaleId);

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(api + path, {
    method,
    headers: { Authorization: 'Token preview', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.json();
}

const error = ref('');
const tool = ref<any>(null);
const family = ref('');
const views = ref<Record<string, any>>({});
const busy = ref(false);
const enc = encodeURIComponent;

async function refresh() {
  busy.value = true;
  try {
    const answer = await call('POST', `/api/lab-tools/${enc(labId)}/views/${enc(user)}/`, {});
    views.value = answer?.views || {};
  } finally {
    busy.value = false;
  }
}

async function run(payload: { command: string; surface?: string }) {
  const result = await call('POST',
    `/api/lab-tools/${enc(labId)}/${enc(tool.value.id)}/${enc(user)}/`, payload);
  await refresh();
  return result;
}

async function boot() {
  try {
    const opened = await call('POST', `/api/labs/${enc(labId)}/open/${enc(user)}/`,
                              { reset: params.get('reset') === '1' });
    if (!opened?.ok) throw new Error(JSON.stringify(opened));
    const found = (opened.tools || []).find((t: any) => t.kind === 'portal' && t.skin === skin);
    if (!found) {
      throw new Error(`Lab ${labId} has no ${skin} portal. Tools: `
        + (opened.tools || []).map((t: any) => t.id).join(', '));
    }
    tool.value = found;
    family.value = found.family;
    views.value = opened.views || {};
    (window as any).__portal = { run, refresh, views, ready: true };
  } catch (problem: any) {
    error.value = String(problem?.message || problem);
  }
}

const App = {
  setup() {
    const width = Number(params.get('frame') || 0);
    return () => h('div', { class: 'pp', style: width ? { maxWidth: width + 'px' } : undefined }, [
      error.value
        ? h('div', { class: 'pp__err' }, error.value)
        : !tool.value
          ? h('div', { class: 'pp__err' }, 'Opening the lab…')
          : h(LabPortal, {
              tool: tool.value,
              view: views.value[family.value] || {},
              run,
              busy: busy.value,
              onRefresh: refresh,
            }),
    ]);
  },
};

const app = createApp(App);
app.use(i18n);
app.mount('#app');
boot();
