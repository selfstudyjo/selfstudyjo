<template>
  <div class="rs" dir="ltr" :class="{ 'rs--narrow': narrow }" ref="rootEl">
    <!-- ===== Title bar + ribbon tabs ===== -->
    <header class="rs-top">
      <div class="rs-brand">
        <svg viewBox="0 0 24 24" class="rs-logo" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" transform="rotate(15 12 12)" /><rect x="10" y="10" width="4" height="4" fill="#2b2d31" transform="rotate(15 12 12)" /></svg>
        <span>Roblox Studio</span>
        <span class="rs-place">{{ experienceName }}</span>
      </div>
      <nav class="rs-tabs" role="tablist" aria-label="Ribbon">
        <button v-for="t in RIBBON" :key="t.id" type="button" role="tab" :aria-selected="ribbon === t.id"
                :class="{ on: ribbon === t.id }" @click="ribbon = t.id">{{ t.label }}</button>
      </nav>
      <div class="rs-playctl">
        <button type="button" class="rs-play" :disabled="busy" title="Play (studio play)" @click="play()">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>Play
        </button>
      </div>
    </header>

    <!-- ===== Ribbon ===== -->
    <section class="rs-ribbon" aria-label="Tools">
      <template v-if="ribbon === 'home'">
        <div class="rs-group">
          <div class="rs-group__row">
            <button type="button" class="rs-tool" @click="insert('Part')"><i class="ic ic-part" />Part</button>
            <button type="button" class="rs-tool" @click="insert('SpawnLocation')"><i class="ic ic-spawn" />Spawn</button>
            <button type="button" class="rs-tool" @click="insert('Model', 'Workspace')"><i class="ic ic-model" />Model</button>
            <button type="button" class="rs-tool" @click="insert('Folder', 'Workspace')"><i class="ic ic-folder" />Folder</button>
          </div>
          <span class="rs-group__label">Insert</span>
        </div>
        <div class="rs-group">
          <div class="rs-group__row">
            <button type="button" class="rs-tool" @click="insert('Script')"><i class="ic ic-script" />Script</button>
            <button type="button" class="rs-tool" @click="insert('LocalScript')"><i class="ic ic-local" />LocalScript</button>
            <button type="button" class="rs-tool" @click="insert('ModuleScript')"><i class="ic ic-module" />Module</button>
            <button type="button" class="rs-tool" @click="insert('RemoteEvent')"><i class="ic ic-remote" />Remote</button>
          </div>
          <span class="rs-group__label">Scripting</span>
        </div>
        <div class="rs-group">
          <div class="rs-group__row">
            <button type="button" class="rs-tool" :disabled="!selectedPart" @click="toggleAnchor">
              <i class="ic ic-anchor" />{{ selectedPart && selectedNode?.raw.Anchored ? 'Unanchor' : 'Anchor' }}
            </button>
            <label class="rs-tool rs-tool--input" :class="{ dis: !selectedPart }">
              <i class="ic ic-color" />Color
              <input type="color" :disabled="!selectedPart" :value="selectedColor" @change="setColor(($event.target as HTMLInputElement).value)" />
            </label>
            <label class="rs-tool rs-tool--input" :class="{ dis: !selectedPart }">
              <i class="ic ic-material" />
              <select :disabled="!selectedPart" :value="selectedMaterial" aria-label="Material" @change="setProp('Material', ($event.target as HTMLSelectElement).value)">
                <option v-for="m in enumValues('Material')" :key="m" :value="m">{{ m }}</option>
              </select>
            </label>
          </div>
          <span class="rs-group__label">Part</span>
        </div>
        <div class="rs-group">
          <div class="rs-group__row">
            <button v-for="n in NUDGES" :key="n.label" type="button" class="rs-tool rs-tool--small"
                    :disabled="!selectedPart" :title="n.title" @click="nudge(n.axis, n.delta)">{{ n.label }}</button>
          </div>
          <span class="rs-group__label">Move (studs)</span>
        </div>
      </template>

      <template v-else-if="ribbon === 'model'">
        <div class="rs-group">
          <div class="rs-group__row">
            <button type="button" class="rs-tool" @click="openInsert(selectedNode?.id ?? null)"><i class="ic ic-plus" />Insert Object…</button>
            <button type="button" class="rs-tool" :disabled="!canEdit" @click="duplicate"><i class="ic ic-copy" />Duplicate</button>
            <button type="button" class="rs-tool" :disabled="!canEdit" @click="startRename(selectedNode!)"><i class="ic ic-rename" />Rename</button>
            <button type="button" class="rs-tool rs-tool--danger" :disabled="!canEdit" @click="remove"><i class="ic ic-delete" />Delete</button>
          </div>
          <span class="rs-group__label">Edit</span>
        </div>
        <div class="rs-group">
          <div class="rs-group__row">
            <button v-for="c in ['ScreenGui', 'Frame', 'TextLabel', 'TextButton', 'ImageLabel', 'UICorner']" :key="c"
                    type="button" class="rs-tool" @click="insertGui(c)"><i class="ic ic-gui" />{{ c }}</button>
          </div>
          <span class="rs-group__label">UI</span>
        </div>
      </template>

      <template v-else-if="ribbon === 'test'">
        <div class="rs-group rs-group--grow">
          <div class="rs-group__row">
            <label class="rs-actions">
              <span>Test actions</span>
              <input v-model="actions" type="text" spellcheck="false" placeholder="touch:Coin gui:ShopButton buy:&quot;100 Coins&quot;"
                     @keydown.enter.prevent="play()" />
            </label>
            <button type="button" class="rs-tool" :disabled="busy" @click="play()"><i class="ic ic-play" />Play</button>
          </div>
          <div class="rs-chips">
            <button v-for="chip in actionChips" :key="chip" type="button" class="rs-chip" @click="addAction(chip)">{{ chip }}</button>
          </div>
          <span class="rs-group__label">Play test - every action runs in order, one second apart</span>
        </div>
        <div class="rs-group">
          <div class="rs-group__row">
            <button type="button" class="rs-tool" @click="runTool(['studio', 'analyze'], 'analysis')"><i class="ic ic-check" />Script Analysis</button>
            <button type="button" class="rs-tool" @click="runTool(['studio', 'stats'], 'perf')"><i class="ic ic-perf" />Performance</button>
            <button type="button" class="rs-tool" @click="runTool(['studio', 'ui-check'], 'ui')"><i class="ic ic-device" />UI Check</button>
          </div>
          <span class="rs-group__label">Diagnose</span>
        </div>
      </template>

      <template v-else>
        <div class="rs-group">
          <div class="rs-group__row">
            <button type="button" class="rs-tool" @click="dialog = 'settings'"><i class="ic ic-gear" />Game Settings</button>
            <button type="button" class="rs-tool" @click="dialog = 'money'"><i class="ic ic-robux" />Monetization</button>
            <button type="button" class="rs-tool" @click="dialog = 'publish'"><i class="ic ic-publish" />Publish to Roblox</button>
          </div>
          <span class="rs-group__label">Experience</span>
        </div>
      </template>
    </section>

    <!-- ===== Notifications ===== -->
    <div class="rs-flash" aria-live="polite">
      <div v-for="f in api.flashes.value" :key="f.id" class="rs-flash__item" :class="'is-' + f.type" role="status">
        <strong>{{ f.title }}</strong><span v-if="f.detail">{{ f.detail }}</span>
        <button type="button" aria-label="Dismiss" @click="api.dismiss(f.id)">×</button>
      </div>
    </div>

    <!-- ===== Main area ===== -->
    <div class="rs-main">
      <section class="rs-center">
        <div class="rs-doctabs" role="tablist" aria-label="Open documents">
          <button type="button" role="tab" :aria-selected="doc === 0" :class="{ on: doc === 0 }" @click="doc = 0">Place</button>
          <span v-for="id in openScripts" :key="id" class="rs-doctab" :class="{ on: doc === id }">
            <button type="button" role="tab" :aria-selected="doc === id" @click="doc = id">
              {{ nodeById.get(id)?.name || '?' }}<span v-if="drafts[id] !== undefined && drafts[id] !== scriptSource(id)"> ●</span>
            </button>
            <button type="button" class="rs-doctab__x" aria-label="Close" @click="closeScript(id)">×</button>
          </span>
        </div>

        <!-- 3D viewport -->
        <div v-if="doc === 0" class="rs-viewport">
          <div class="rs-vp-tools">
            <button type="button" title="Rotate the camera" @click="yaw = (yaw + 90) % 360">⟳</button>
            <button type="button" title="Zoom in" @click="zoom = Math.min(zoom * 1.25, 8)">＋</button>
            <button type="button" title="Zoom out" @click="zoom = Math.max(zoom / 1.25, 0.25)">－</button>
            <button type="button" :class="{ on: showUi }" title="Show the StarterGui UI" @click="showUi = !showUi">UI</button>
            <select v-if="showUi" v-model="device" aria-label="Device">
              <option value="desktop">Desktop 16:9</option><option value="tablet">Tablet 4:3</option><option value="phone">Phone</option>
            </select>
          </div>
          <svg class="rs-scene" :viewBox="`0 0 ${VW} ${VH}`" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Workspace">
            <defs><linearGradient id="rs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2e8" /><stop offset="1" stop-color="#cfe3f5" /></linearGradient></defs>
            <rect width="100%" height="100%" fill="url(#rs-sky)" />
            <polygon :points="groundPoints" fill="#5b5d69" stroke="#4a4c56" />
            <g v-for="(f, i) in faces" :key="i" @click.stop="select(f.id)">
              <polygon :points="f.points" :fill="f.fill" :fill-opacity="f.opacity" :stroke="f.selected ? '#0d99ff' : 'rgba(0,0,0,0.25)'" :stroke-width="f.selected ? 2 : 0.6" />
            </g>
            <text v-if="!parts.length" x="50%" y="50%" text-anchor="middle" class="rs-scene__empty">Insert a Part from the Home tab</text>
          </svg>
          <div v-if="showUi" class="rs-ui" :style="uiFrameStyle">
            <div v-for="(b, i) in uiBoxes" :key="i" class="rs-ui__el" :class="{ sel: b.node.id === selectedId, hidden: b.node.raw.Visible === false }"
                 :style="uiStyle(b)" @click.stop="select(b.node.id)">{{ uiText(b.node) }}</div>
            <p v-if="!uiBoxes.length" class="rs-ui__empty">No UI in StarterGui yet</p>
          </div>
        </div>

        <!-- Script editor -->
        <div v-else class="rs-editor">
          <div class="rs-editor__bar">
            <span>{{ nodeById.get(doc)?.path }} <em>{{ scriptFile(doc) }}</em></span>
            <button type="button" class="rs-btn rs-btn--primary" :disabled="drafts[doc] === undefined || drafts[doc] === scriptSource(doc)" @click="saveScript(doc)">Save (Ctrl+S)</button>
          </div>
          <div class="rs-editor__body">
            <pre class="rs-gutter" aria-hidden="true">{{ gutter }}</pre>
            <textarea class="rs-code" spellcheck="false" :value="drafts[doc] ?? scriptSource(doc)" aria-label="Script source"
                      @input="drafts[doc] = ($event.target as HTMLTextAreaElement).value"
                      @keydown="editorKey($event)" />
          </div>
        </div>
      </section>

      <aside class="rs-side">
        <!-- Explorer -->
        <section class="rs-panel rs-explorer">
          <header class="rs-panel__head">Explorer
            <input v-model="filter" type="search" placeholder="Filter workspace (Ctrl+Shift+X)" aria-label="Filter the Explorer" />
          </header>
          <ul class="rs-tree" role="tree">
            <li v-for="row in treeRows" :key="row.id" role="treeitem" :aria-selected="row.id === selectedId"
                :class="{ sel: row.id === selectedId, drop: dropTarget === row.id }" :style="{ paddingLeft: (row.depth - 1) * 14 + 4 + 'px' }"
                draggable="true" @dragstart="dragId = row.id" @dragover.prevent="dropTarget = row.id" @dragleave="dropTarget = null"
                @drop.prevent="dropOn(row.id)" @click="select(row.id)" @dblclick="openNode(row)">
              <button v-if="row.children.length" type="button" class="rs-twist" :aria-label="expanded.has(row.id) ? 'Collapse' : 'Expand'" @click.stop="toggle(row.id)">{{ expanded.has(row.id) ? '▾' : '▸' }}</button>
              <span v-else class="rs-twist" />
              <i class="cls" :style="{ background: classColor(row.class) }">{{ classGlyph(row.class) }}</i>
              <input v-if="renaming === row.id" ref="renameInput" v-model="renameText" class="rs-rename" aria-label="New name"
                     @keydown.enter.prevent="commitRename(row)" @keydown.esc.prevent="renaming = null" @blur="commitRename(row)" @click.stop />
              <span v-else class="rs-tree__name">{{ row.name }}</span>
              <button type="button" class="rs-tree__add" title="Insert Object" @click.stop="openInsert(row.id)">+</button>
            </li>
          </ul>
        </section>

        <!-- Properties -->
        <section class="rs-panel rs-props">
          <header class="rs-panel__head">Properties<span v-if="selectedNode"> - {{ selectedNode.class }} "{{ selectedNode.name }}"</span></header>
          <div v-if="!selectedNode" class="rs-props__empty">Select an object in the Explorer or the viewport.</div>
          <table v-else class="rs-proptable">
            <tbody>
              <tr><th>Name</th><td><input :value="selectedNode.name" :disabled="!canEdit" aria-label="Name" @change="rename(selectedNode, ($event.target as HTMLInputElement).value)" /></td></tr>
              <tr><th>ClassName</th><td class="ro">{{ selectedNode.class }}</td></tr>
              <tr v-for="p in selectedProps" :key="p.name">
                <th :title="p.type">{{ p.name }}</th>
                <td>
                  <input v-if="p.type === 'bool'" type="checkbox" :checked="p.raw === true" :aria-label="p.name" @change="setProp(p.name, ($event.target as HTMLInputElement).checked ? 'true' : 'false')" />
                  <select v-else-if="p.type.startsWith('Enum:')" :value="p.text" :aria-label="p.name" @change="setProp(p.name, ($event.target as HTMLSelectElement).value)">
                    <option v-for="v in enumValues(p.type.slice(5))" :key="v" :value="v">{{ v }}</option>
                  </select>
                  <select v-else-if="p.type === 'BrickColor'" :value="p.text" :aria-label="p.name" @change="setProp(p.name, ($event.target as HTMLSelectElement).value)">
                    <option v-for="v in view.brick_colors || []" :key="v" :value="v">{{ v }}</option>
                  </select>
                  <select v-else-if="p.type === 'Instance'" :value="p.text" :aria-label="p.name" @change="setProp(p.name, ($event.target as HTMLSelectElement).value || 'nil')">
                    <option value="">nil</option>
                    <option v-for="n in refChoices" :key="n" :value="n">{{ n }}</option>
                  </select>
                  <span v-else-if="p.type === 'Color3'" class="rs-colorcell">
                    <input type="color" :value="hexOf(p.raw)" :aria-label="p.name" @change="setProp(p.name, hexToRgb(($event.target as HTMLInputElement).value))" />
                    <input :value="p.text" :aria-label="p.name + ' RGB'" @change="setProp(p.name, ($event.target as HTMLInputElement).value)" />
                  </span>
                  <input v-else :value="p.text" :aria-label="p.name" :inputmode="p.type === 'number' || p.type === 'int' ? 'decimal' : 'text'"
                         @change="setProp(p.name, ($event.target as HTMLInputElement).value)" />
                </td>
              </tr>
              <tr v-for="(v, k) in selectedNode.attributes" :key="'a' + k" class="attr"><th>@{{ k }}</th><td class="ro">{{ v }}</td></tr>
            </tbody>
          </table>
        </section>
      </aside>
    </div>

    <!-- ===== Bottom panels ===== -->
    <section class="rs-bottom">
      <nav class="rs-bottom__tabs" role="tablist" aria-label="Panels">
        <button v-for="t in BOTTOM" :key="t.id" type="button" role="tab" :aria-selected="bottom === t.id" :class="{ on: bottom === t.id }" @click="bottom = t.id">
          {{ t.label }}<span v-if="t.id === 'output' && lastPlay" class="rs-badge" :class="{ bad: lastPlay.errors }">{{ lastPlay.errors ? lastPlay.errors + ' error' + (lastPlay.errors > 1 ? 's' : '') : 'ok' }}</span>
        </button>
        <span class="rs-spacer" />
        <select v-if="bottom === 'output'" v-model="outFilter" aria-label="Filter Output">
          <option value="all">All messages</option><option value="problems">Warnings and errors</option><option value="server">Server</option><option value="client">Client</option>
        </select>
      </nav>
      <div class="rs-bottom__body">
        <template v-if="bottom === 'output'">
          <p v-if="!lastPlay" class="rs-muted">No play test yet. Press Play - or add test actions on the Test tab.</p>
          <ol v-else class="rs-output">
            <li v-for="(row, i) in outputRows" :key="i" :class="'k-' + row.kind">
              <span class="t">{{ Number(row.t || 0).toFixed(2) }}s</span>
              <span class="m">{{ row.text }}</span>
              <span class="w">{{ row.side === 'client' ? 'Client' : 'Server' }}{{ row.where ? ' - ' + row.where : '' }}</span>
            </li>
          </ol>
        </template>
        <template v-else-if="bottom === 'analysis'">
          <p v-if="!view.analysis" class="rs-muted">Run Script Analysis from the Test tab.</p>
          <p v-else-if="!view.analysis.issues.length" class="rs-ok">No problems found.</p>
          <ul v-else class="rs-list">
            <li v-for="(r, i) in view.analysis.issues" :key="i" :class="r.level"><b>{{ r.code }}</b> {{ r.text }}</li>
          </ul>
        </template>
        <template v-else-if="bottom === 'perf'">
          <table class="rs-grid">
            <thead><tr><th>Check</th><th>Value</th><th>Budget</th><th /></tr></thead>
            <tbody>
              <tr v-for="row in view.perf?.checks || []" :key="row.label" :class="{ bad: !row.ok }">
                <td>{{ row.label }}</td><td>{{ row.value }}</td><td>{{ row.budget }}</td><td>{{ row.ok ? '✓' : '!!' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="view.perf && !view.perf.current" class="rs-warn">The place changed since the last play test - play again for current numbers.</p>
        </template>
        <template v-else-if="bottom === 'ui'">
          <p v-if="!view.ui_check" class="rs-muted">Run UI Check from the Test tab.</p>
          <p v-else-if="!view.ui_check.issues.length" class="rs-ok">{{ view.ui_check.elements }} elements checked on phone, tablet, desktop and console - no issues.</p>
          <ul v-else class="rs-list"><li v-for="(r, i) in view.ui_check.issues" :key="i" class="warning"><b>{{ r.device }}</b> {{ r.text }}</li></ul>
        </template>
        <template v-else>
          <p v-if="!(view.datastore_keys || []).length" class="rs-muted">Nothing saved yet. DataStores need Game Settings &gt; Security &gt; API access.</p>
          <table v-else class="rs-grid"><thead><tr><th>Store</th><th>Key</th><th>Value</th></tr></thead>
            <tbody><tr v-for="(r, i) in view.datastore_keys" :key="i"><td>{{ r.store }}</td><td>{{ r.key }}</td><td class="mono">{{ r.value }}</td></tr></tbody>
          </table>
        </template>
      </div>
    </section>

    <!-- ===== Dialogs ===== -->
    <div v-if="dialog" class="rs-modal" role="dialog" aria-modal="true" :aria-label="dialogTitle" @keydown.esc="dialog = null">
      <div class="rs-modal__card">
        <header><h3>{{ dialogTitle }}</h3><button type="button" class="rs-x" aria-label="Close" @click="dialog = null">×</button></header>

        <div v-if="dialog === 'insert'" class="rs-insert">
          <p class="rs-muted">Insert into <b>{{ insertParentPath || 'Workspace' }}</b></p>
          <input v-model="insertFilter" type="search" placeholder="Search objects" aria-label="Search objects" />
          <ul class="rs-insert__list">
            <li v-for="c in insertable" :key="c"><button type="button" @click="insert(c, insertParentPath || undefined); dialog = null">
              <i class="cls" :style="{ background: classColor(c) }">{{ classGlyph(c) }}</i>{{ c }}</button></li>
          </ul>
        </div>

        <div v-else-if="dialog === 'settings'" class="rs-form">
          <h4>Security</h4>
          <label class="rs-switch"><input type="checkbox" :checked="view.settings?.api_access" @change="toggleSetting('api', ($event.target as HTMLInputElement).checked)" />Enable Studio Access to API Services</label>
          <label class="rs-switch"><input type="checkbox" :checked="view.settings?.http" @change="toggleSetting('http', ($event.target as HTMLInputElement).checked)" />Allow HTTP Requests</label>
          <p class="rs-muted">DataStores in Studio only work with API access on, exactly as in Roblox Studio.</p>
        </div>

        <div v-else-if="dialog === 'money'" class="rs-form">
          <h4>Developer products and passes</h4>
          <table class="rs-grid"><thead><tr><th>Kind</th><th>Name</th><th>Id</th><th>Price</th></tr></thead>
            <tbody><tr v-for="p in view.products || []" :key="p.kind + p.name"><td>{{ p.kind }}</td><td>{{ p.name }}</td><td class="mono">{{ p.id }}</td><td>R$ {{ p.price }}</td></tr></tbody>
          </table>
          <div class="rs-inline">
            <select v-model="newProduct.kind" aria-label="Kind"><option value="product">Developer product</option><option value="pass">Game pass</option></select>
            <input v-model="newProduct.name" placeholder="Name" aria-label="Name" />
            <input v-model.number="newProduct.price" type="number" min="1" placeholder="Robux" aria-label="Price in Robux" />
            <button type="button" class="rs-btn rs-btn--primary" :disabled="!newProduct.name || !newProduct.price" @click="addProduct">Create</button>
          </div>
        </div>

        <div v-else-if="dialog === 'publish'" class="rs-form">
          <h4>Basic info</h4>
          <label>Name<input :value="view.experience?.name" @change="setExp('name', ($event.target as HTMLInputElement).value)" /></label>
          <label>Description<textarea rows="3" :value="view.experience?.description" @change="setExp('description', ($event.target as HTMLTextAreaElement).value)" /></label>
          <div class="rs-inline">
            <label>Genre<select :value="view.experience?.genre" @change="setExp('genre', ($event.target as HTMLSelectElement).value)">
              <option value="">Choose…</option><option v-for="g in GENRES" :key="g" :value="g">{{ g }}</option></select></label>
            <label>Max players<input type="number" min="1" max="100" :value="view.experience?.max_players" @change="setExp('max_players', ($event.target as HTMLInputElement).value)" /></label>
            <label>Privacy<select :value="view.experience?.privacy" @change="setExp('privacy', ($event.target as HTMLSelectElement).value)">
              <option value="private">Private</option><option value="friends">Friends</option><option value="public">Public</option></select></label>
          </div>
          <div class="rs-inline">
            <label>Icon asset<input :value="view.experience?.icon" placeholder="rbxassetid://…" @change="setExp('icon', ($event.target as HTMLInputElement).value)" /></label>
            <label>Thumbnail asset<input :value="view.experience?.thumbnail" placeholder="rbxassetid://…" @change="setExp('thumbnail', ($event.target as HTMLInputElement).value)" /></label>
          </div>
          <label class="rs-switch"><input type="checkbox" :checked="view.experience?.questionnaire" @change="setExp('questionnaire', ($event.target as HTMLInputElement).checked ? 'done' : 'no')" />Maturity &amp; compliance questionnaire completed</label>
          <h4>Checklist</h4>
          <ul class="rs-checklist"><li v-for="c in view.publish_checks || []" :key="c.label" :class="{ ok: c.ok }">{{ c.ok ? '✓' : '○' }} {{ c.label }}</li></ul>
          <p v-if="(view.published || []).length" class="rs-ok">Published versions: {{ view.published.map((p: any) => 'v' + p.version + ' (' + p.privacy + ')').join(', ') }}</p>
          <button type="button" class="rs-btn rs-btn--primary" @click="publish">Publish</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Roblox Studio, over the lab's `sim:roblox` engine (app 11).
 *
 * Every click runs the `studio ...` command a student could type into the
 * Studio Console beside it - insert, set a property, rename, move, save a
 * script, play with test actions, analyse, publish - so the console and this
 * window edit ONE place, and the "Equivalent CLI commands" drawer under the
 * portal teaches the commands. The viewport is an isometric drawing of the
 * Workspace parts and an overlay of the StarterGui UI laid out with the same
 * arithmetic the engine's UI check uses (robloxStudio.ts).
 */
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import type { PortalApi } from '../usePortal';
import { cli, rows } from '@/utils/portalKit';
import {
    GUI_CLASSES, SCRIPT_CLASSES, SERVICES, color, hexToRgb, isGui, isPart, layoutGui, project, rawText,
    toBase64, vec, type RsNode, type UiBox,
} from './robloxStudio';

const props = defineProps<{ view: Record<string, any>; api: PortalApi; tool: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'location', url: string): void; (e: 'refresh'): void }>();

const RIBBON = [{ id: 'home', label: 'HOME' }, { id: 'model', label: 'MODEL' }, { id: 'test', label: 'TEST' },
    { id: 'file', label: 'FILE' }];
const BOTTOM = [{ id: 'output', label: 'Output' }, { id: 'analysis', label: 'Script Analysis' },
    { id: 'perf', label: 'Performance' }, { id: 'ui', label: 'UI Check' }, { id: 'data', label: 'Data Stores' }];
const NUDGES = [{ label: 'X−', axis: 0, delta: -1, title: 'Move -1 stud along X' }, { label: 'X+', axis: 0, delta: 1, title: 'Move +1 stud along X' },
    { label: 'Y−', axis: 1, delta: -1, title: 'Move down 1 stud' }, { label: 'Y+', axis: 1, delta: 1, title: 'Move up 1 stud' },
    { label: 'Z−', axis: 2, delta: -1, title: 'Move -1 stud along Z' }, { label: 'Z+', axis: 2, delta: 1, title: 'Move +1 stud along Z' }];
const GENRES = ['Action', 'Adventure', 'Obby', 'Platformer', 'Roleplay', 'Simulator', 'Strategy', 'Survival', 'Shooter',
    'Sports', 'Puzzle', 'Party', 'Education', 'Social', 'Tycoon'];
const VW = 800;
const VH = 460;

const ribbon = ref('home');
const bottom = ref('output');
const selectedId = ref<number | null>(null);
const expanded = reactive(new Set<number>());
const filter = ref('');
const doc = ref<number>(0);
const openScripts = ref<number[]>([]);
const drafts = reactive<Record<number, string>>({});
const dialog = ref<null | 'insert' | 'settings' | 'money' | 'publish'>(null);
const insertParent = ref<number | null>(null);
const insertFilter = ref('');
const actions = ref('');
const outFilter = ref('all');
const yaw = ref(0);
const zoom = ref(1);
const showUi = ref(false);
const device = ref('desktop');
const renaming = ref<number | null>(null);
const renameText = ref('');
const renameInput = ref<HTMLInputElement[] | null>(null);
const dragId = ref<number | null>(null);
const dropTarget = ref<number | null>(null);
const newProduct = reactive({ kind: 'product', name: '', price: 25 });
const rootEl = ref<HTMLElement | null>(null);
const narrow = ref(false);
let observer: ResizeObserver | null = null;

const nodes = computed<RsNode[]>(() => rows<RsNode>(props.view, 'nodes'));
const nodeById = computed(() => new Map(nodes.value.map(n => [n.id, n])));
const selectedNode = computed(() => (selectedId.value != null ? nodeById.value.get(selectedId.value) : undefined) || null);
const lastPlay = computed(() => props.view?.play || null);
const busy = computed(() => Boolean(props.busy) || props.api.busy.value);
const experienceName = computed(() => props.view?.experience?.name || 'Place1');
const canEdit = computed(() => Boolean(selectedNode.value && !SERVICES.includes(selectedNode.value.class)
    && selectedNode.value.class !== 'DataModel' && !selectedNode.value.class.startsWith('Starter')));
const selectedPart = computed(() => Boolean(selectedNode.value && isPart(selectedNode.value.class)));
const selectedColor = computed(() => color(selectedNode.value?.raw.Color));
const selectedMaterial = computed(() => selectedNode.value?.raw.Material?.v || 'Plastic');

onMounted(() => {
    emit('location', 'roblox-studio://place/edit');
    for (const n of nodes.value) if (n.depth <= 1) expanded.add(n.id);
    if (rootEl.value && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(entries => { narrow.value = entries[0].contentRect.width < 860; });
        observer.observe(rootEl.value);
    }
    window.addEventListener('keydown', globalKey);
});
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('keydown', globalKey); });
watch(nodes, list => { if (!expanded.size) for (const n of list) if (n.depth <= 1) expanded.add(n.id); });

// ---------------------------------------------------------------- Explorer
const treeRows = computed(() => {
    const q = filter.value.trim().toLowerCase();
    const list = nodes.value.filter(n => n.class !== 'DataModel');
    if (q) return list.filter(n => n.name.toLowerCase().includes(q) || n.class.toLowerCase().includes(q))
        .map(n => ({ ...n, depth: 1 }));
    return list.filter(n => {
        let p = n.parent;
        while (p != null) {
            const parent = nodeById.value.get(p);
            if (!parent || parent.class === 'DataModel') break;
            if (!expanded.has(p)) return false;
            p = parent.parent;
        }
        return true;
    });
});

function toggle(id: number) { if (expanded.has(id)) expanded.delete(id); else expanded.add(id); }

function select(id: number) {
    selectedId.value = id;
    let p = nodeById.value.get(id)?.parent;
    while (p != null) { expanded.add(p); p = nodeById.value.get(p)?.parent ?? null; }
}

function openNode(row: RsNode) {
    if (SCRIPT_CLASSES.includes(row.class)) {
        if (!openScripts.value.includes(row.id)) openScripts.value.push(row.id);
        doc.value = row.id;
    } else {
        toggle(row.id);
    }
}

const GLYPH: Record<string, [string, string]> = {
    Workspace: ['W', '#3b82f6'], Players: ['P', '#22c55e'], Lighting: ['L', '#eab308'], ReplicatedStorage: ['R', '#06b6d4'],
    ReplicatedFirst: ['R', '#06b6d4'], ServerScriptService: ['S', '#64748b'], ServerStorage: ['S', '#64748b'],
    StarterGui: ['G', '#a855f7'], StarterPack: ['B', '#f97316'], StarterPlayer: ['P', '#22c55e'], Teams: ['T', '#ec4899'],
    SoundService: ['♪', '#64748b'], Script: ['S', '#38bdf8'], LocalScript: ['L', '#4ade80'], ModuleScript: ['M', '#c084fc'],
    Part: ['■', '#94a3b8'], SpawnLocation: ['⌂', '#94a3b8'], Model: ['◈', '#cbd5e1'], Folder: ['▤', '#f59e0b'],
    RemoteEvent: ['⇅', '#f472b6'], UnreliableRemoteEvent: ['⇅', '#fb7185'], RemoteFunction: ['ƒ', '#f472b6'],
    ScreenGui: ['▭', '#a855f7'], IntValue: ['#', '#60a5fa'], NumberValue: ['#', '#60a5fa'], StringValue: ['"', '#60a5fa'],
    BoolValue: ['?', '#60a5fa'], Humanoid: ['☺', '#fde047'],
};
function classGlyph(cls: string) { return (GLYPH[cls] || [isGui(cls) ? '▫' : cls.slice(0, 1)])[0]; }
function classColor(cls: string) { return (GLYPH[cls] || [null, isGui(cls) ? '#8b5cf6' : '#475569'])[1] as string; }

const insertParentPath = computed(() => (insertParent.value != null ? nodeById.value.get(insertParent.value)?.path : '') || '');
const insertable = computed<string[]>(() => {
    const q = insertFilter.value.trim().toLowerCase();
    return (props.view?.insertable || []).filter((c: string) => !q || c.toLowerCase().includes(q));
});
function openInsert(parentId: number | null) { insertParent.value = parentId; insertFilter.value = ''; dialog.value = 'insert'; }

const dialogTitle = computed(() => ({ insert: 'Insert Object', settings: 'Game Settings', money: 'Monetization',
    publish: 'Publish to Roblox' } as Record<string, string>)[dialog.value || ''] || '');

// ---------------------------------------------------------------- commands
async function run(words: (string | number)[], success = '', flags: Record<string, any> = {}) {
    return props.api.exec(cli(words, flags), { success });
}

function defaultParent(cls: string): string | undefined {
    const sel = selectedNode.value;
    if (!sel) return undefined;
    if (SCRIPT_CLASSES.includes(cls) || cls.startsWith('UI') || isGui(cls) || cls === 'ClickDetector'
        || cls === 'ProximityPrompt' || cls.endsWith('Light') || cls === 'ParticleEmitter') return sel.path || undefined;
    if (isPart(cls) && ['Model', 'Folder', 'Workspace'].includes(sel.class)) return sel.path;
    return undefined;
}

async function insert(cls: string, parent?: string) {
    const target = parent ?? defaultParent(cls);
    const flags: Record<string, any> = {};
    const words: (string | number)[] = ['studio', 'new', cls];
    if (target) words.push(target);
    if (isPart(cls)) Object.assign(flags, { '--set': 'Anchored=true' });
    const res = await run(words, `Inserted ${cls}`, flags);
    if (res.ok) {
        const created = nodes.value.filter(n => n.class === cls).sort((a, b) => b.id - a.id)[0];
        if (created) {
            select(created.id);
            if (SCRIPT_CLASSES.includes(cls)) openNode(created);
        }
    }
}

function insertGui(cls: string) {
    const sel = selectedNode.value;
    const inGui = sel && (sel.class === 'ScreenGui' || isGui(sel.class));
    if (cls === 'ScreenGui') return insert('ScreenGui', 'StarterGui');
    if (cls === 'UICorner') return insert('UICorner', sel?.path || undefined);
    const screen = nodes.value.find(n => n.class === 'ScreenGui');
    return insert(cls, inGui ? sel!.path : (screen?.path || 'StarterGui'));
}

async function setProp(name: string, value: string) {
    const sel = selectedNode.value;
    if (!sel) return;
    await run(['studio', 'set', sel.path, name, value]);
}

function setColor(hex: string) { return setProp('Color', hexToRgb(hex)); }
function toggleAnchor() { return setProp('Anchored', selectedNode.value?.raw.Anchored ? 'false' : 'true'); }

function nudge(axis: number, delta: number) {
    const sel = selectedNode.value;
    if (!sel) return;
    const p = vec(sel.raw.Position, [0, 0.5, 0]).slice();
    p[axis] = Math.round((p[axis] + delta) * 100) / 100;
    return setProp('Position', p.join(','));
}

async function rename(node: RsNode, name: string) {
    if (!name.trim() || name === node.name) return;
    await run(['studio', 'rename', node.path, name.trim()], `Renamed to ${name.trim()}`);
}

function startRename(node: RsNode) {
    renaming.value = node.id;
    renameText.value = node.name;
    nextTick(() => renameInput.value?.[0]?.select());
}
function commitRename(node: RsNode) {
    if (renaming.value !== node.id) return;
    renaming.value = null;
    rename(node, renameText.value);
}

function duplicate() { const s = selectedNode.value; if (s) run(['studio', 'clone', s.path], `Duplicated ${s.name}`); }
async function remove() {
    const s = selectedNode.value;
    if (!s) return;
    const res = await run(['studio', 'rm', s.path], `Deleted ${s.name}`);
    if (res.ok) { selectedId.value = null; closeScript(s.id); }
}

async function dropOn(targetId: number) {
    dropTarget.value = null;
    const moving = dragId.value != null ? nodeById.value.get(dragId.value) : null;
    const target = nodeById.value.get(targetId);
    dragId.value = null;
    if (!moving || !target || moving.id === target.id || SERVICES.includes(moving.class)) return;
    await run(['studio', 'mv', moving.path, target.path], `Moved ${moving.name} into ${target.name}`);
}

const refChoices = computed(() => nodes.value.filter(n => n.path).map(n => n.path).slice(0, 400));

// ---------------------------------------------------------------- properties
const selectedProps = computed(() => {
    const sel = selectedNode.value;
    if (!sel) return [];
    const spec = (props.view?.classes || {})[sel.class] || [];
    return spec.map((p: any) => {
        const raw = sel.raw[p.name] !== undefined ? sel.raw[p.name] : p.default;
        return { name: p.name, type: p.type, raw, text: rawText(raw, refPath) };
    });
});
function refPath(id: number) { return nodeById.value.get(id)?.path || ''; }
function enumValues(name: string): string[] { return (props.view?.enums || {})[name] || []; }
function hexOf(raw: any) { return color(raw, '#000000'); }

// ---------------------------------------------------------------- scripts
function scriptRow(id: number) { return rows<any>(props.view, 'scripts').find(s => s.id === id); }
function scriptSource(id: number): string { return scriptRow(id)?.source ?? ''; }
function scriptFile(id: number): string { return scriptRow(id)?.file ?? ''; }
const gutter = computed(() => {
    const text = drafts[doc.value] ?? scriptSource(doc.value);
    return Array.from({ length: Math.max(1, text.split('\n').length) }, (_v, i) => i + 1).join('\n');
});

async function saveScript(id: number) {
    const node = nodeById.value.get(id);
    const text = drafts[id];
    if (!node || text === undefined) return;
    const res = await run(['studio', 'edit', node.path], `Saved ${node.name}`, { '--b64': toBase64(text) });
    if (res.ok) delete drafts[id];
}

function closeScript(id: number) {
    openScripts.value = openScripts.value.filter(x => x !== id);
    if (doc.value === id) doc.value = 0;
}

function editorKey(event: KeyboardEvent) {
    const area = event.target as HTMLTextAreaElement;
    if (event.key === 'Tab') {
        event.preventDefault();
        const start = area.selectionStart, end = area.selectionEnd;
        const value = area.value;
        drafts[doc.value] = value.slice(0, start) + '    ' + value.slice(end);
        nextTick(() => { area.selectionStart = area.selectionEnd = start + 4; });
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveScript(doc.value);
    }
}

function globalKey(event: KeyboardEvent) {
    if (event.key === 'F5' && rootEl.value?.contains(document.activeElement)) { event.preventDefault(); play(); }
}

// ---------------------------------------------------------------- testing
const actionChips = computed(() => {
    const out: string[] = [];
    for (const n of nodes.value) {
        if (isPart(n.class) && n.path.startsWith('Workspace.') && n.name !== 'Baseplate') out.push('touch:' + n.name);
        if (n.class === 'TextButton' || n.class === 'ImageButton') out.push('gui:' + n.name);
    }
    for (const p of rows<any>(props.view, 'products')) out.push((p.kind === 'pass' ? 'owns:' : 'buy:') + p.name);
    out.push('wait:3', 'redeliver', 'rejoin');
    return Array.from(new Set(out)).slice(0, 24);
});
function addAction(chip: string) { actions.value = (actions.value.trim() + ' ' + chip).trim(); }

function splitActions(text: string): string[] {
    const out: string[] = [];
    const re = /(\S*?"[^"]*"\S*|\S*?\[[^\]]*\]\S*|\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push(m[1].replace(/:"([^"]*)"/, ':$1'));
    return out;
}

async function play() {
    const res = await props.api.exec(cli(['studio', 'play', ...splitActions(actions.value)]), { quiet: true });
    bottom.value = 'output';
    if (!res.ok && !(res.output || '').includes('Play test')) {
        props.api.notify('error', 'Play test failed', String(res.error || ''));
    } else if (!res.ok) {
        props.api.notify('warning', 'The play test finished with errors - see Output');
    } else {
        props.api.notify('success', 'Play test finished');
    }
}

async function runTool(words: string[], panel: string) {
    await run(words);
    bottom.value = panel;
}

const outputRows = computed(() => {
    const list: any[] = lastPlay.value?.output || [];
    if (outFilter.value === 'problems') return list.filter(r => r.kind === 'warn' || r.kind === 'error');
    if (outFilter.value === 'server' || outFilter.value === 'client') return list.filter(r => r.side === outFilter.value);
    return list;
});

// ---------------------------------------------------------------- experience
function toggleSetting(key: string, on: boolean) { return run(['studio', 'settings', key, on ? 'on' : 'off'], 'Settings saved'); }
function setExp(key: string, value: string) { return run(['studio', 'experience', 'set', key, value]); }
async function publish() { await props.api.exec(cli(['studio', 'publish']), { success: 'Published', failure: 'Publish failed' }); }
async function addProduct() {
    const res = await run(['studio', newProduct.kind === 'pass' ? 'pass' : 'product', 'add', newProduct.name,
        Number(newProduct.price)], `Created ${newProduct.name}`);
    if (res.ok) newProduct.name = '';
}

// ---------------------------------------------------------------- viewport
const parts = computed(() => nodes.value.filter(n => isPart(n.class) && n.path.startsWith('Workspace')
    && !(n.name === 'Baseplate' && vec(n.raw.Size, [0, 0, 0])[0] > 100)));
const viewScale = computed(() => {
    let extent = 30;
    for (const p of parts.value) {
        const [x, y, z] = vec(p.raw.Position, [0, 0, 0]);
        const [w, , d] = vec(p.raw.Size, [4, 1, 2]);
        extent = Math.max(extent, Math.abs(x) + w, Math.abs(z) + d, Math.abs(y) * 1.5);
    }
    return (Math.min(VW, VH * 1.6) / (extent * 2.6)) * zoom.value;
});
const faces = computed(() => project(parts.value, yaw.value, viewScale.value, VW / 2, VH * 0.58, selectedId.value));
const groundPoints = computed(() => {
    const s = viewScale.value, r = 60, a = (yaw.value * Math.PI) / 180;
    const pts = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, z]) => {
        const xr = x * Math.cos(a) - z * Math.sin(a), zr = x * Math.sin(a) + z * Math.cos(a);
        return `${(VW / 2 + (xr - zr) * 0.866 * s).toFixed(1)},${(VH * 0.58 + (xr + zr) * 0.5 * s).toFixed(1)}`;
    });
    return pts.join(' ');
});

const DEVICES: Record<string, [number, number]> = { desktop: [1920, 1080], tablet: [1024, 768], phone: [844, 390] };
const uiFrameStyle = computed(() => {
    const [w, h] = DEVICES[device.value];
    return { aspectRatio: `${w} / ${h}` };
});
const uiBoxes = computed<UiBox[]>(() => {
    const [w, h] = DEVICES[device.value];
    const out: UiBox[] = [];
    for (const n of nodes.value) {
        if (n.class === 'ScreenGui' && n.path.startsWith('StarterGui') && n.raw.Enabled !== false) {
            out.push(...layoutGui(nodeById.value, n, w, h, true));
        }
    }
    return out;
});
function uiStyle(b: UiBox) {
    const [w, h] = DEVICES[device.value];
    const n = b.node;
    const transparency = typeof n.raw.BackgroundTransparency === 'number' ? n.raw.BackgroundTransparency : 0;
    const corner = nodes.value.find(c => c.parent === n.id && c.class === 'UICorner');
    const radius = corner ? vec(corner.raw.CornerRadius, [0, 8]) : null;
    return {
        left: (b.x / w) * 100 + '%', top: (b.y / h) * 100 + '%', width: (b.w / w) * 100 + '%', height: (b.h / h) * 100 + '%',
        background: transparency >= 1 ? 'transparent' : color(n.raw.BackgroundColor3, '#ffffff'),
        opacity: n.raw.Visible === false ? 0.35 : 1 - Math.min(0.9, transparency * 0.6),
        color: color(n.raw.TextColor3, '#000000'),
        borderRadius: radius ? `${radius[0] * 50 + radius[1] / 4}%` : '0',
        fontSize: `clamp(8px, ${(Number(n.raw.TextSize ?? 14) / h) * 100}cqh, 28px)`,
    } as Record<string, string | number>;
}
function uiText(n: RsNode) {
    if (!['TextLabel', 'TextButton', 'TextBox'].includes(n.class)) return '';
    const text = n.raw.Text;
    return typeof text === 'string' ? text : (n.class === 'TextButton' ? 'Button' : n.class === 'TextLabel' ? 'Label' : '');
}
void GUI_CLASSES;
</script>

<style scoped>
.rs { --bg: #2b2d31; --panel: #232428; --panel2: #2e3035; --line: #3c3f45; --text: #e3e5e8; --muted: #9aa0a6;
  --blue: #0d99ff; --blue2: #0b7fd6; --ok: #3ccb7f; --warn: #f5a623; --err: #ff5b5b;
  display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; height: 100%; min-height: 620px;
  background: var(--bg); color: var(--text); font: 12px/1.4 'Builder Sans', 'Segoe UI', system-ui, sans-serif; position: relative;
  container-type: inline-size; }
.rs button, .rs input, .rs select, .rs textarea { font: inherit; color: var(--text); }
.rs-top { display: flex; align-items: center; gap: 12px; padding: 4px 10px; background: #1e1f22; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.rs-brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.rs-logo { width: 18px; height: 18px; fill: #e3e5e8; }
.rs-place { color: var(--muted); font-weight: 400; }
.rs-tabs { display: flex; gap: 2px; }
.rs-tabs button { background: none; border: 0; padding: 6px 12px; border-radius: 4px; cursor: pointer; letter-spacing: .04em; font-weight: 600; color: var(--muted); }
.rs-tabs button.on { color: var(--text); background: var(--panel2); box-shadow: inset 0 -2px 0 var(--blue); }
.rs-playctl { margin-left: auto; }
.rs-play { display: inline-flex; align-items: center; gap: 6px; background: var(--blue); border: 0; color: #fff; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-weight: 600; }
.rs-play svg { width: 12px; height: 12px; fill: #fff; }
.rs-play:disabled { opacity: .5; cursor: progress; }
.rs-ribbon { display: flex; gap: 6px; padding: 6px 8px; background: var(--panel2); border-bottom: 1px solid var(--line); overflow-x: auto; }
.rs-group { display: flex; flex-direction: column; gap: 4px; padding: 0 10px; border-right: 1px solid var(--line); min-width: max-content; }
.rs-group--grow { flex: 1; min-width: 260px; }
.rs-group__row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.rs-group__label { color: var(--muted); font-size: 11px; text-align: center; }
.rs-tool { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 1px solid transparent; padding: 5px 8px; border-radius: 4px; cursor: pointer; min-height: 30px; }
.rs-tool:hover:not(:disabled) { background: #3a3d43; border-color: var(--line); }
.rs-tool:disabled, .rs-tool.dis { opacity: .45; cursor: not-allowed; }
.rs-tool--small { padding: 4px 7px; font-family: ui-monospace, monospace; }
.rs-tool--danger:hover:not(:disabled) { color: #fff; background: #7f1d1d; }
.rs-tool--input input[type=color] { width: 22px; height: 18px; border: 0; padding: 0; background: none; }
.rs-tool--input select { background: var(--panel); border: 1px solid var(--line); border-radius: 3px; padding: 2px 4px; }
.ic { width: 14px; height: 14px; display: inline-block; border-radius: 3px; background: currentColor; opacity: .85;
  -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.ic-part, .ic-spawn, .ic-model, .ic-folder, .ic-gui, .ic-copy, .ic-device { --m: linear-gradient(#000, #000); border-radius: 2px; }
.ic-script, .ic-local, .ic-module, .ic-remote, .ic-check, .ic-perf, .ic-rename, .ic-plus, .ic-delete, .ic-anchor,
.ic-color, .ic-material, .ic-gear, .ic-robux, .ic-publish, .ic-play { --m: radial-gradient(circle, #000 60%, transparent 62%); }
.ic-part { color: #9ca3af; } .ic-spawn { color: #cbd5e1; } .ic-model { color: #e2e8f0; } .ic-folder { color: #f59e0b; }
.ic-script { color: #38bdf8; } .ic-local { color: #4ade80; } .ic-module { color: #c084fc; } .ic-remote { color: #f472b6; }
.ic-delete { color: #f87171; } .ic-play { color: var(--blue); } .ic-robux { color: #22c55e; } .ic-publish { color: var(--blue); }
.rs-actions { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 220px; color: var(--muted); }
.rs-actions input { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 5px 8px; font-family: ui-monospace, monospace; }
.rs-chips { display: flex; gap: 4px; flex-wrap: wrap; max-width: 640px; }
.rs-chip { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 1px 8px; cursor: pointer; font-family: ui-monospace, monospace; font-size: 11px; }
.rs-chip:hover { border-color: var(--blue); }
.rs-flash { position: absolute; top: 88px; right: 12px; z-index: 5; display: flex; flex-direction: column; gap: 6px; max-width: min(420px, 90%); }
.rs-flash__item { display: flex; gap: 8px; align-items: flex-start; background: #1e1f22; border: 1px solid var(--line); border-left: 4px solid var(--blue); padding: 8px 10px; border-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.4); }
.rs-flash__item.is-success { border-left-color: var(--ok); } .rs-flash__item.is-error { border-left-color: var(--err); } .rs-flash__item.is-warning { border-left-color: var(--warn); }
.rs-flash__item span { color: var(--muted); white-space: pre-wrap; word-break: break-word; }
.rs-flash__item button { margin-left: auto; background: none; border: 0; cursor: pointer; font-size: 16px; line-height: 1; }
.rs-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 320px); min-height: 0; }
.rs-center { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; border-right: 1px solid var(--line); }
.rs-doctabs { display: flex; gap: 1px; background: #1e1f22; overflow-x: auto; }
.rs-doctabs > button, .rs-doctab button { background: var(--panel); border: 0; padding: 6px 12px; cursor: pointer; color: var(--muted); white-space: nowrap; }
.rs-doctabs > button.on, .rs-doctab.on button { background: var(--bg); color: var(--text); box-shadow: inset 0 2px 0 var(--blue); }
.rs-doctab { display: inline-flex; }
.rs-doctab__x { padding: 6px 8px !important; }
.rs-viewport { position: relative; min-height: 260px; overflow: hidden; }
.rs-scene { width: 100%; height: 100%; display: block; }
.rs-scene__empty { fill: #1e293b; font-size: 16px; }
.rs-vp-tools { position: absolute; top: 8px; left: 8px; z-index: 2; display: flex; gap: 4px; }
.rs-vp-tools button, .rs-vp-tools select { background: rgba(30,31,34,.85); border: 1px solid var(--line); border-radius: 4px; padding: 3px 8px; cursor: pointer; }
.rs-vp-tools button.on { border-color: var(--blue); color: #fff; }
.rs-ui { position: absolute; inset: 40px 8px 8px; margin: auto; max-height: calc(100% - 48px); max-width: 100%; border: 1px dashed rgba(255,255,255,.6); background: rgba(0,0,0,.18); container-type: size; }
.rs-ui__el { position: absolute; display: flex; align-items: center; justify-content: center; overflow: hidden; text-align: center; cursor: pointer; outline: 1px solid rgba(0,0,0,.25); }
.rs-ui__el.sel { outline: 2px solid var(--blue); z-index: 2; }
.rs-ui__el.hidden { outline-style: dashed; }
.rs-ui__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: #fff; }
.rs-editor { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; background: #1e1f22; }
.rs-editor__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.rs-editor__bar em { color: var(--muted); font-style: normal; margin-left: 6px; }
.rs-editor__body { display: grid; grid-template-columns: auto minmax(0, 1fr); min-height: 260px; overflow: auto; }
.rs-gutter { margin: 0; padding: 8px 6px; text-align: right; color: #6b7280; font: 12.5px/1.5 ui-monospace, 'Cascadia Code', Consolas, monospace; background: #1a1b1e; user-select: none; }
.rs-code { resize: none; border: 0; outline: 0; padding: 8px 10px; background: transparent; font: 12.5px/1.5 ui-monospace, 'Cascadia Code', Consolas, monospace; white-space: pre; overflow: auto; min-height: 260px; tab-size: 4; color: #e5e7eb; }
.rs-side { display: grid; grid-template-rows: minmax(160px, 1fr) minmax(160px, 1fr); min-height: 0; }
.rs-panel { display: flex; flex-direction: column; min-height: 0; border-bottom: 1px solid var(--line); background: var(--panel); }
.rs-panel__head { display: flex; align-items: center; gap: 8px; padding: 5px 8px; font-weight: 600; background: var(--panel2); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.rs-panel__head span { font-weight: 400; color: var(--muted); }
.rs-panel__head input { flex: 1; min-width: 100px; background: var(--panel); border: 1px solid var(--line); border-radius: 3px; padding: 3px 6px; font-weight: 400; }
.rs-tree { list-style: none; margin: 0; padding: 2px 0; overflow: auto; flex: 1; min-height: 0; }
.rs-tree li { display: flex; align-items: center; gap: 4px; padding: 1px 4px; cursor: default; white-space: nowrap; min-height: 22px; }
.rs-tree li:hover { background: #303237; }
.rs-tree li.sel { background: #1a4a73; }
.rs-tree li.drop { outline: 1px solid var(--blue); }
.rs-twist { width: 14px; flex: 0 0 14px; background: none; border: 0; padding: 0; cursor: pointer; color: var(--muted); }
.cls { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 3px; font-size: 10px; font-style: normal; color: #0b0c0e; font-weight: 700; flex: 0 0 16px; }
.rs-tree__name { overflow: hidden; text-overflow: ellipsis; }
.rs-tree__add { margin-left: auto; opacity: 0; background: none; border: 0; cursor: pointer; font-size: 15px; padding: 0 4px; }
.rs-tree li:hover .rs-tree__add, .rs-tree li.sel .rs-tree__add, .rs-tree__add:focus { opacity: 1; }
.rs-rename { background: var(--bg); border: 1px solid var(--blue); padding: 0 4px; min-width: 0; flex: 1; }
.rs-props { overflow: auto; }
.rs-props__empty { padding: 12px; color: var(--muted); }
.rs-proptable { width: 100%; border-collapse: collapse; table-layout: fixed; }
.rs-proptable th { width: 44%; text-align: left; font-weight: 400; padding: 2px 6px; color: #cfd3d8; border-bottom: 1px solid #2b2d31; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-proptable td { padding: 1px 4px; border-bottom: 1px solid #2b2d31; }
.rs-proptable td.ro { color: var(--muted); padding: 3px 6px; }
.rs-proptable input:not([type=checkbox]):not([type=color]), .rs-proptable select { width: 100%; min-width: 0; background: transparent; border: 1px solid transparent; padding: 2px 4px; border-radius: 2px; }
.rs-proptable input:focus, .rs-proptable select:focus { border-color: var(--blue); background: var(--bg); outline: 0; }
.rs-proptable select option { background: var(--panel); }
.rs-proptable tr.attr th { color: #93c5fd; }
.rs-colorcell { display: flex; gap: 4px; align-items: center; }
.rs-colorcell input[type=color] { width: 22px; height: 18px; border: 0; padding: 0; background: none; flex: 0 0 22px; }
.rs-bottom { border-top: 1px solid var(--line); background: var(--panel); display: grid; grid-template-rows: auto minmax(0, 1fr); height: clamp(150px, 26vh, 260px); min-height: 0; }
.rs-bottom__tabs { display: flex; align-items: center; gap: 2px; background: var(--panel2); padding: 0 6px; overflow-x: auto; }
.rs-bottom__tabs button { background: none; border: 0; padding: 6px 10px; cursor: pointer; color: var(--muted); white-space: nowrap; display: inline-flex; gap: 6px; align-items: center; }
.rs-bottom__tabs button.on { color: var(--text); box-shadow: inset 0 -2px 0 var(--blue); }
.rs-bottom__tabs select { background: var(--panel); border: 1px solid var(--line); border-radius: 3px; padding: 2px 4px; }
.rs-spacer { flex: 1; }
.rs-badge { background: #14532d; color: #bbf7d0; border-radius: 8px; padding: 0 6px; font-size: 10px; }
.rs-badge.bad { background: #7f1d1d; color: #fecaca; }
.rs-bottom__body { overflow: auto; padding: 4px 8px; min-height: 0; }
.rs-output { list-style: none; margin: 0; padding: 0; font: 12px/1.45 ui-monospace, Consolas, monospace; }
.rs-output li { display: grid; grid-template-columns: 4.5em minmax(0, 1fr) auto; gap: 10px; padding: 1px 0; border-bottom: 1px solid #2b2d31; }
.rs-output .t { color: #6b7280; }
.rs-output .m { white-space: pre-wrap; word-break: break-word; }
.rs-output .w { color: var(--muted); white-space: nowrap; }
.rs-output .k-warn .m { color: var(--warn); } .rs-output .k-error .m { color: var(--err); } .rs-output .k-info .m { color: #7cc4ff; }
.rs-muted { color: var(--muted); } .rs-ok { color: var(--ok); } .rs-warn { color: var(--warn); }
.rs-list { margin: 0; padding-left: 18px; } .rs-list li.error { color: var(--err); } .rs-list li.warning { color: var(--warn); }
.rs-grid { width: 100%; border-collapse: collapse; }
.rs-grid th, .rs-grid td { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--line); }
.rs-grid tr.bad td { color: var(--err); }
.mono { font-family: ui-monospace, monospace; word-break: break-all; }
.rs-modal { position: absolute; inset: 0; z-index: 10; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 16px; overflow: auto; }
.rs-modal__card { background: var(--panel2); border: 1px solid var(--line); border-radius: 8px; width: min(620px, 100%); max-height: 100%; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.rs-modal__card header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--line); }
.rs-modal__card h3 { margin: 0; font-size: 15px; }
.rs-modal__card h4 { margin: 12px 0 6px; font-size: 13px; }
.rs-x { background: none; border: 0; font-size: 20px; cursor: pointer; }
.rs-insert, .rs-form { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.rs-insert input, .rs-form input:not([type=checkbox]), .rs-form select, .rs-form textarea { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 6px 8px; width: 100%; box-sizing: border-box; }
.rs-form label { display: flex; flex-direction: column; gap: 3px; color: var(--muted); flex: 1; min-width: 140px; }
.rs-form label.rs-switch { flex-direction: row; align-items: center; gap: 8px; color: var(--text); }
.rs-inline { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.rs-insert__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(170px, 100%), 1fr)); gap: 4px; max-height: 50vh; overflow: auto; }
.rs-insert__list button { width: 100%; display: flex; gap: 8px; align-items: center; background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 6px 8px; cursor: pointer; text-align: left; }
.rs-insert__list button:hover { border-color: var(--blue); }
.rs-checklist { list-style: none; margin: 0; padding: 0; } .rs-checklist li { color: var(--muted); } .rs-checklist li.ok { color: var(--ok); }
.rs-btn { border: 1px solid var(--line); background: var(--panel); padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.rs-btn--primary { background: var(--blue); border-color: var(--blue2); color: #fff; align-self: flex-start; }
.rs-btn:disabled { opacity: .5; cursor: not-allowed; }
.rs button:focus-visible, .rs input:focus-visible, .rs select:focus-visible, .rs textarea:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
/* Narrow (a phone, or a narrow lab pane): the panels stack and the WINDOW
   scrolls, rather than squeezing four panels into a fixed height. */
.rs--narrow { display: block; height: 100%; min-height: 0; overflow-y: auto; }
.rs--narrow .rs-main { display: block; }
.rs--narrow .rs-center { display: block; border-right: 0; }
.rs--narrow .rs-viewport { height: 280px; }
.rs--narrow .rs-editor__body { min-height: 320px; }
.rs--narrow .rs-side { display: block; }
.rs--narrow .rs-explorer .rs-tree { max-height: 240px; }
.rs--narrow .rs-props { max-height: 340px; }
.rs--narrow .rs-bottom { height: 280px; }
.rs--narrow .rs-modal { position: fixed; }
</style>
