# Lab portals — the real product's console, interactive

A **portal** is a lab tool of kind `portal`: an interactive replica of a real
product's own console — the AWS Management Console, the Azure portal, Apache
Ambari, the Spark UI, Microsoft Fabric, Jira, ServiceNow, Docker Desktop, the
Kubernetes Dashboard and Jenkins. The read-only `gui`
dashboards (`LabGui.vue`) stay as they are; a portal is the product itself.

```
src/utils/portalKit.ts              PLAIN module: cli() quoting, parseJson, errorText,
                                    pick/rows, matches, sortBy, RULES. Checked.
src/components/labs/portals/
  LabPortal.vue                     the host: browser frame, "Simulated" tag, the
                                    equivalent-CLI drawer, chooses the skin (async)
  usePortal.ts                      headless actions: exec(), flashes, history, busy
  aws/AwsConsole.vue  (+ siblings)  one directory per product, scoped styles only
  azure/AzurePortal.vue
  ambari/AmbariConsole.vue
  spark/SparkUi.vue
  fabric/FabricPortal.vue
  jira/JiraApp.vue
  servicenow/ServiceNowApp.vue
  docker/DockerDesktop.vue
  k8s/K8sDashboard.vue
  jenkins/JenkinsApp.vue
tools/portal-preview/               a harness against a REAL local app 11
```

## The one design decision

**A portal writes by running the command line a student could have typed.**
Creating a VPC in the AWS console runs `aws ec2 create-vpc --cidr-block …`
through the same engine the AWS CLI console uses; creating a Jira issue runs
`mgr backlog add --title …`. Consequences, all deliberate:

* the console and the portal can never disagree — there is one store and one
  set of validation rules;
* a resource made in the portal satisfies the same `state` and `command_*`
  task checks, is saved in the same per-student environment JSON, and is
  mirrored to GitHub exactly like a console command — **progress is never
  lost**;
* the equivalent-CLI drawer under every portal shows each command it ran,
  which is the half of the feature that teaches.

Portals are attached **automatically** to any lab that has their engine
(`PORTALS` / `with_portals` in app 11's `utils/labtools.py`), so a lab served
from a GitHub track repo has one without being republished.

## The skin contract

```ts
props:  view: Record<string, any>   // this family's view payload (read-only)
        api:  PortalApi             // from usePortal(): exec, notify, flashes, history, busy
        tool: LabTool               // label, fidelity
        busy?: boolean
emits:  location(url: string)       // the URL the real product shows for this page
        refresh()
```

* Build every command with `cli([...words], {flags})` from `portalKit.ts`.
  Never concatenate a typed value into a command string by hand.
* `await api.exec(command, { success: 'Created bucket x' })` resolves AFTER the
  view has been refreshed, so the new row is already in `view`.
* Fabric runs a statement as a sibling surface: `api.exec(sql, { surface:
  'fabric_sql' })` (also `fabric_notebook`, `fabric_dax`). The log records the
  surface, so tasks written against it pass.
* Read the view with `pick` / `rows` — a field a replica a release behind does
  not send yet must render as empty, never throw.
* Draw `api.flashes` in the product's own notification style.

## Rules every skin follows

* **Looks like the product.** Palette, typography, spacing, iconography and
  layout follow the real product's design system (Cloudscape, Fluent 2,
  Atlassian Design System, ServiceNow Next Experience, Ambari 2.7, the Spark
  web UI). Its palette lives as custom properties on the skin's root element
  and is spent from there; the galaxy themes do not apply (an AWS console that
  turned purple would be teaching the wrong screen).
* **Product chrome stays in English and the skin is `dir="ltr"`.** "Create
  bucket", "Launch instance" and "Create issue" are the words the real console,
  its documentation and every tutorial use; a translated button is a button the
  student will not find on the job. Platform text around the product (the
  frame, the CLI drawer) is translated.
* **Scoped styles only**, no global selectors, no `:root`.
* **Nothing reaches `v-html` or `innerHTML`.** Every string came from a view
  payload a student can influence.
* **No network requests** of its own — no remote fonts, images or scripts. Icons
  are inline SVG.
* **Every list has create / read / update / delete where the product does**,
  and a delete asks for confirmation the way the product does (AWS: type the
  name / "delete"; Azure: type the name; Jira: a confirm dialog).
* **Responsive to the frame, not the viewport**: container queries on
  `sl-portal` (the frame is `container-name: sl-portal`).
