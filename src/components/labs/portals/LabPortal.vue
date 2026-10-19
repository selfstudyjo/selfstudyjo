<template>
  <div ref="root" class="sl-portal" :class="{ 'is-full': fs.active.value, 'is-overlay': fs.active.value && !fs.native.value }" dir="ltr">
    <!--
      A BROWSER FRAME around the product, and it is doing two jobs.

      It says where the student is — the address bar carries the URL the real
      console would be on for this page, which is the thing a tutorial or a
      colleague will name — and it is where the platform declares that this is
      a simulation (working rule 21: a stand-in that does not say what it is is
      worse than a refusal). Putting that declaration INSIDE the product's own
      chrome would make the product look wrong; putting it here leaves the
      product exactly as it looks and the statement impossible to miss.
    -->
    <div class="sl-portal__bar">
      <span class="sl-portal__dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <div class="sl-portal__address" :title="location">
        <Lock class="sl-portal__lock" aria-hidden="true" />
        <span class="sl-portal__url">{{ location }}</span>
      </div>
      <span class="sl-portal__sim" :title="tool.fidelity">
        {{ $t('Simulated') }}
      </span>
      <button type="button" class="sl-portal__reload" :disabled="busy"
              :title="$t('Refresh')" :aria-label="$t('Refresh')" @click="$emit('refresh')">
        <RotateCw class="sl-portal__icon" :class="{ 'is-spinning': busy }" />
      </button>
      <!-- FULL SCREEN. Enter, and once in: an explicit exit and an X, plus
           Escape (see useFullscreen) - three ways out, because a student who
           cannot find the way out of a full-window console has a broken page. -->
      <button v-if="!fs.active.value" type="button" class="sl-portal__fs"
              :title="$t('Full screen')" @click="fs.enter()">
        <Maximize2 class="sl-portal__icon" aria-hidden="true" />
        <span class="sl-portal__fs-label">{{ $t('Full screen') }}</span>
      </button>
      <template v-else>
        <button type="button" class="sl-portal__fs"
                :title="$t('Exit full screen')" @click="fs.exit()">
          <Minimize2 class="sl-portal__icon" aria-hidden="true" />
          <span class="sl-portal__fs-label">{{ $t('Exit full screen') }}</span>
        </button>
        <button type="button" class="sl-portal__close" :title="$t('Close')"
                :aria-label="$t('Exit full screen')" @click="fs.exit()">
          <X class="sl-portal__icon" aria-hidden="true" />
        </button>
      </template>
    </div>

    <div class="sl-portal__frame">
      <component
        :is="skin"
        v-if="skin"
        :view="view"
        :api="api"
        :tool="tool"
        :busy="busy || api.busy.value"
        @location="onLocation"
        @refresh="$emit('refresh')"
      />
      <div v-else class="sl-portal__missing">
        {{ $t('This build does not include that console yet.') }}
      </div>
    </div>

    <!--
      THE EQUIVALENT CLI. Every button in the portal ran a command, and this is
      the list of them, newest first, with whether each worked. It is the half
      of the feature that teaches: a student who created a VPC with a form can
      see the `aws ec2 create-vpc` line it was, copy it, and run the next one in
      the console. Collapsed by default so the product keeps the whole frame.
    -->
    <div class="sl-portal__log" :class="{ 'is-open': logOpen }">
      <button type="button" class="sl-portal__log-toggle" :aria-expanded="logOpen"
              @click="logOpen = !logOpen">
        <TerminalSquare class="sl-portal__icon" aria-hidden="true" />
        <span>{{ $t('Equivalent CLI commands') }}</span>
        <span class="sl-portal__count">{{ api.history.value.length }}</span>
        <ChevronUp class="sl-portal__icon sl-portal__chevron" aria-hidden="true" />
      </button>
      <ol v-if="logOpen" class="sl-portal__entries">
        <li v-if="api.history.value.length === 0" class="sl-portal__empty">
          {{ $t('Nothing yet. Every action you take in the console above appears here as the command it ran.') }}
        </li>
        <li v-for="entry in api.history.value" :key="entry.id" class="sl-portal__entry"
            :class="entry.ok ? 'is-ok' : 'is-bad'">
          <span class="sl-portal__status" aria-hidden="true">{{ entry.ok ? '✓' : '✕' }}</span>
          <code class="sl-portal__command">{{ entry.command }}</code>
          <span v-if="entry.surface" class="sl-portal__surface">{{ entry.surface }}</span>
          <button type="button" class="sl-portal__copy" :title="$t('Copy')"
                  :aria-label="$t('Copy')" @click="copy(entry.command)">
            <Copy class="sl-portal__icon" />
          </button>
          <pre v-if="!entry.ok && entry.output" class="sl-portal__output">{{ entry.output }}</pre>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The host every portal is drawn inside.
 *
 * It owns the one `usePortal` instance for the tool — so the command log below
 * the frame and the skin's own notifications read the same history — and it
 * chooses the skin component by the tool's `skin`.
 *
 * **Every skin is its own async chunk** (working rule 47). The fourteen of them are
 * thousands of lines of product chrome each, and a student in a Python lab must
 * not download the AWS console to read a brief. A skin that fails to load
 * renders the "not in this build" note rather than nothing, because an empty
 * frame under a tab labelled "AWS Management Console" is indistinguishable from
 * a broken one.
 *
 * The contract a skin implements (see `README.md` beside this file):
 *
 *   props  view  - this family's view payload, read-only
 *          api   - the PortalApi: exec(command, options), notify, flashes,
 *                  history, busy
 *          tool  - the LabTool (label, fidelity)
 *          busy  - a refresh or an action is in flight
 *   emits  location(url)  - the address the real product would show
 *          refresh        - ask for a fresh view now
 */
import { computed, defineAsyncComponent, h, ref, type Component } from 'vue';
import { ChevronUp, Copy, Lock, Maximize2, Minimize2, RotateCw, TerminalSquare, X } from 'lucide-vue-next';
import type { LabTool } from '@/utils/labCatalogue';
import type { PortalRun } from '@/utils/portalKit';
import { usePortal } from './usePortal';
import { useFullscreen } from '@/composables/useFullscreen';

const props = defineProps<{
  tool: LabTool;
  view: Record<string, unknown>;
  run: PortalRun;
  busy?: boolean;
}>();

defineEmits<{ (event: 'refresh'): void }>();

function lazy(loader: () => Promise<any>): Component {
  return defineAsyncComponent({
    loader,
    errorComponent: {
      render: () => h('div', { class: 'sl-portal__missing' },
                      'This console could not be loaded. Reload the page to try again.'),
    },
  });
}

const SKINS: Record<string, Component> = {
  aws: lazy(() => import('./aws/AwsConsole.vue')),
  awsops: lazy(() => import('./awsops/AwsOpsConsole.vue')),
  azure: lazy(() => import('./azure/AzurePortal.vue')),
  ambari: lazy(() => import('./ambari/AmbariConsole.vue')),
  sparkui: lazy(() => import('./spark/SparkUi.vue')),
  fabric: lazy(() => import('./fabric/FabricPortal.vue')),
  jira: lazy(() => import('./jira/JiraApp.vue')),
  servicenow: lazy(() => import('./servicenow/ServiceNowApp.vue')),
  docker: lazy(() => import('./docker/DockerDesktop.vue')),
  k8s: lazy(() => import('./k8s/K8sDashboard.vue')),
  jenkins: lazy(() => import('./jenkins/JenkinsApp.vue')),
  hcpterraform: lazy(() => import('./terraform/HcpTerraform.vue')),
  githubdesktop: lazy(() => import('./github/GitHubDesktop.vue')),
  mlflow: lazy(() => import('./mlflow/MlflowUi.vue')),
  pgadmin: lazy(() => import('./pgadmin/PgAdmin.vue')),
  snowflake: lazy(() => import('./snowflake/Snowsight.vue')),
  airflow: lazy(() => import('./airflow/AirflowUi.vue')),
  dbt: lazy(() => import('./dbt/DbtCloud.vue')),
  confluent: lazy(() => import('./confluent/ControlCenter.vue')),
  flink: lazy(() => import('./flink/FlinkDashboard.vue')),
  datahub: lazy(() => import('./datahub/DataHub.vue')),
};

const skin = computed<Component | null>(() => SKINS[String(props.tool.skin || '')] || null);

const api = usePortal(payload => props.run(payload));

const root = ref<HTMLElement | null>(null);
const fs = useFullscreen(root);

const DEFAULT_LOCATIONS: Record<string, string> = {
  aws: 'https://console.aws.amazon.com/console/home',
  awsops: 'https://eu-west-1.console.aws.amazon.com/console/home',
  azure: 'https://portal.azure.com/#home',
  ambari: 'http://ambari.lab.internal:8080/#/main/dashboard/metrics',
  sparkui: 'http://spark-history.lab.internal:18080/',
  fabric: 'https://app.fabric.microsoft.com/home?experience=fabric-developer',
  jira: 'https://selfstudy.atlassian.net/jira/software/projects/PLAT/boards/1',
  servicenow: 'https://acme.service-now.com/now/sow/home',
  docker: 'docker-desktop://dashboard/containers',
  k8s: 'https://k8s-dashboard.lab.internal/#/workloads?namespace=default',
  jenkins: 'http://jenkins.lab.internal:8080/',
  hcpterraform: 'https://app.terraform.io/app/selfstudy/workspaces',
  githubdesktop: 'x-github-desktop://repository/changes',
  mlflow: 'http://mlflow.lab.internal:5000/#/experiments',
  pgadmin: 'http://pgadmin.shopflow.internal/browser/',
  snowflake: 'https://app.snowflake.com/eu-west-1/shopflow-xy12345/#/homepage',
  airflow: 'http://airflow.shopflow.internal:8080/home',
  dbt: 'https://cloud.getdbt.com/deploy/71203/projects/40112/',
  confluent: 'http://control-center.shopflow.internal:9021/clusters',
  flink: 'http://flink-jobmanager.shopflow.internal:8081/#/overview',
  datahub: 'http://datahub.shopflow.internal:9002/',
};

const location = ref(DEFAULT_LOCATIONS[String(props.tool.skin || '')] || 'about:blank');
const logOpen = ref(false);

function onLocation(url: string) {
  if (typeof url === 'string' && url) location.value = url;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    api.notify('info', 'Command copied to the clipboard');
  } catch {
    /* A clipboard the browser refuses is not worth an error over a console. */
  }
}
</script>
