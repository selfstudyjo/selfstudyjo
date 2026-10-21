/**
 * Apache Ambari 2.7 skin — the plain half: routes, URLs, formatting, and the
 * command lines each form stands for. No Vue, no DOM.
 *
 * Every write in this skin is a command a student could have typed:
 *   - HDFS (Files View)      hdfs dfs -mkdir / -put / -mv / -cp / -rm / -chmod / -setrep
 *   - Hive View 2.0          the HiveQL statement itself (a bare statement)
 *   - YARN                   yarn application -kill / -status, yarn schedulerconf
 *   - services and configs   curl against Ambari's own REST API, exactly as the
 *                            Ambari documentation scripts it.
 */
import { cli } from '@/utils/portalKit';

export type AmbPage = 'dashboard' | 'service' | 'hosts' | 'host' | 'alerts' | 'admin'
  | 'files' | 'hive' | 'queues' | 'rm';

export interface AmbRoute {
  page: AmbPage;
  id?: string;
  tab?: string;
}

export const AMBARI_BASE = 'http://ambari.lab.internal:8080';

export const SERVICE_ORDER = ['HDFS', 'YARN', 'MAPREDUCE2', 'HIVE', 'SPARK2', 'ZOOKEEPER'];

export const SERVICE_NAMES: Record<string, string> = {
  HDFS: 'HDFS', YARN: 'YARN', MAPREDUCE2: 'MapReduce2', HIVE: 'Hive',
  SPARK2: 'Spark2', ZOOKEEPER: 'ZooKeeper',
};

/** The URL the real Ambari shows for a page. */
export function locationFor(route: AmbRoute): string {
  const hash = (path: string) => `${AMBARI_BASE}/#/main/${path}`;
  switch (route.page) {
    case 'dashboard':
      return hash('dashboard/' + (route.tab === 'heatmaps' ? 'heatmap'
        : route.tab === 'configs' ? 'config_history' : 'metrics'));
    case 'service':
      return hash(`services/${route.id}/${route.tab || 'summary'}`);
    case 'hosts':
      return hash('hosts');
    case 'host':
      return hash(`host/${route.id}.lab.internal/${route.tab || 'summary'}`);
    case 'alerts':
      return hash('alerts');
    case 'admin':
      return hash('admin/stack/services');
    case 'files':
      return hash('view/FILES/auto_files_instance');
    case 'hive':
      return hash(`view/HIVE/auto_hive20_instance/${route.tab || 'query'}`);
    case 'queues':
      return hash('view/CAPACITY-SCHEDULER/auto_cs_instance');
    case 'rm':
      return 'http://resourcemanager.lab.internal:8088/cluster/' + (route.id ? `app/${route.id}` : 'apps');
    default:
      return hash('dashboard/metrics');
  }
}

/** A curl against Ambari's REST API, the documented way to script Ambari. */
export function ambariCurl(cluster: string, method: 'GET' | 'PUT' | 'POST', path: string,
                           body?: unknown): string {
  const url = `${AMBARI_BASE}/api/v1/clusters/${cluster}${path}`;
  return cli(['curl'], {
    '-u': 'admin:admin',
    '-H': method === 'GET' ? null : 'X-Requested-By: ambari',
    '-X': method === 'GET' ? null : method,
    '-d': body === undefined ? null : JSON.stringify(body),
    '--fail-with-body': true,
  }) + ' ' + url;
}

export function serviceStateCommand(cluster: string, service: string, state: 'STARTED' | 'INSTALLED',
                                    context: string): string {
  return ambariCurl(cluster, 'PUT', `/services/${service}`, {
    RequestInfo: { context },
    Body: { ServiceInfo: { state } },
  });
}

export function maintenanceCommand(cluster: string, service: string, on: boolean): string {
  return ambariCurl(cluster, 'PUT', `/services/${service}`, {
    RequestInfo: { context: `${on ? 'Turn On' : 'Turn Off'} Maintenance Mode for ${SERVICE_NAMES[service] || service}` },
    Body: { ServiceInfo: { maintenance_state: on ? 'ON' : 'OFF' } },
  });
}

export function requestCommand(cluster: string, service: string, command: string, context: string): string {
  return ambariCurl(cluster, 'POST', '/requests', {
    RequestInfo: { command, context },
    'Requests/resource_filters': [{ service_name: service }],
  });
}

export function configCommand(cluster: string, type: string, properties: Record<string, string>,
                              note: string): string {
  return ambariCurl(cluster, 'PUT', '', {
    Clusters: {
      desired_config: [{
        type,
        tag: 'version' + Date.now(),
        properties,
        service_config_version_note: note,
      }],
    },
  });
}

/** Make Current: restore an older service config version as a new one. */
export function revertConfigCommand(cluster: string, service: string, version: number, note: string): string {
  return ambariCurl(cluster, 'PUT', '', {
    Clusters: {
      desired_service_config_versions: {
        service_name: service,
        service_config_version: version,
        service_config_version_note: note,
      },
    },
  });
}

/** Start / stop a component on every host it runs on. */
export function componentStateCommand(cluster: string, service: string, component: string,
                                      state: 'STARTED' | 'INSTALLED', context: string): string {
  return ambariCurl(cluster, 'PUT', `/services/${service}/components/${component}`, {
    RequestInfo: { context },
    Body: { ServiceComponentInfo: { state } },
  });
}

/** Start / stop one component on one host. */
export function hostComponentCommand(cluster: string, host: string, component: string,
                                     state: 'STARTED' | 'INSTALLED', context: string): string {
  return ambariCurl(cluster, 'PUT', `/hosts/${host}.lab.internal/host_components/${component}`, {
    RequestInfo: { context },
    Body: { HostRoles: { state } },
  });
}

/** Host Actions > Start / Stop All Components. */
export function hostAllComponentsCommand(cluster: string, host: string, state: 'STARTED' | 'INSTALLED',
                                         context: string): string {
  return ambariCurl(cluster, 'PUT', `/hosts/${host}.lab.internal/host_components`, {
    RequestInfo: { context },
    Body: { HostRoles: { state } },
  });
}

export function hostMaintenanceCommand(cluster: string, host: string, on: boolean): string {
  return ambariCurl(cluster, 'PUT', `/hosts/${host}.lab.internal`, {
    RequestInfo: { context: `Turn ${on ? 'On' : 'Off'} Maintenance Mode for ${host}.lab.internal` },
    Body: { Hosts: { maintenance_state: on ? 'ON' : 'OFF' } },
  });
}

/** Restart a component on the named hosts (one host or all of them). */
export function restartComponentsCommand(cluster: string, service: string, component: string,
                                         hosts: string[], context: string): string {
  return ambariCurl(cluster, 'POST', '/requests', {
    RequestInfo: { command: 'RESTART', context },
    'Requests/resource_filters': [{
      service_name: service,
      component_name: component,
      hosts: hosts.map(h => `${h}.lab.internal`).join(','),
    }],
  });
}

/** Host Actions > Restart All Components: one request, one filter per component. */
export function restartHostCommand(cluster: string, host: string,
                                   components: { service: string; component: string }[]): string {
  return ambariCurl(cluster, 'POST', '/requests', {
    RequestInfo: { command: 'RESTART', context: `Restart all components on ${host}.lab.internal` },
    'Requests/resource_filters': components.map(c => ({
      service_name: c.service, component_name: c.component, hosts: `${host}.lab.internal`,
    })),
  });
}

/** Alerts > an alert definition: enable / disable / edit the check interval. */
export function alertDefinitionCommand(cluster: string, id: number,
                                       body: { enabled?: boolean; interval?: number }): string {
  return ambariCurl(cluster, 'PUT', `/alert_definitions/${id}`, { AlertDefinition: body });
}

/** One entry of a right-click / row-actions menu. */
export interface AmbMenuItem {
  label?: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  sep?: boolean;
  header?: boolean;
  run?: () => void;
}

/** Split a worksheet into statements on `;`, ignoring semicolons in quotes. */
export function splitStatements(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote = '';
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';') {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  // A line comment on its own is not a statement.
  return out.map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
}

export function bytes(value: unknown): string {
  let size = Number(value || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${size} B` : `${size.toFixed(1)} ${units[unit]}`;
}

export function uptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}.${Math.floor(h / 2.4)} d`;
  if (h) return `${h}.${Math.floor(m / 6)} hr`;
  if (m) return `${m}.${Math.floor((s % 60) / 6)} min`;
  return `${s} secs`;
}

/** '-rwxr-x---' -> '750' */
export function permOctal(perm: string): string {
  const bits = String(perm || '').slice(1).padEnd(9, '-');
  let out = '';
  for (let i = 0; i < 3; i++) {
    const group = bits.slice(i * 3, i * 3 + 3);
    out += String((group[0] === 'r' ? 4 : 0) + (group[1] === 'w' ? 2 : 0) + (group[2] === 'x' ? 1 : 0));
  }
  return out;
}

export function joinPath(dir: string, name: string): string {
  return (dir === '/' ? '' : dir.replace(/\/$/, '')) + '/' + name;
}

export function parentOf(path: string): string {
  const cut = path.replace(/\/$/, '').lastIndexOf('/');
  return cut <= 0 ? '/' : path.slice(0, cut);
}

export function shortStamp(stamp: string): string {
  const text = String(stamp || '');
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${months[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const HIVE_TYPES = ['STRING', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DOUBLE', 'FLOAT',
  'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'VARCHAR(255)', 'CHAR(10)'];

export const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
