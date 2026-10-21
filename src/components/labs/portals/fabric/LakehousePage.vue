<template>
  <div class="fx-page lh" @contextmenu="onPageContext">
    <ItemHeader :name="itemName" type="Lakehouse" :label="item?.label" :endorsement="item?.endorsement"
                :tabs="['Home']" model-value="Home" @settings="settings = 'about'" @share="settings = 'share'">
      <template #right>
        <select class="fx-select lh-switch" value="Lakehouse" aria-label="Switch experience"
                @change="switchTo(($event.target as HTMLSelectElement).value)">
          <option value="Lakehouse">Lakehouse</option>
          <option value="SQLEndpoint">SQL analytics endpoint</option>
        </select>
      </template>
    </ItemHeader>
    <div class="fx-cmdbar">
      <button type="button" class="fx-cmd" aria-haspopup="menu" @click.stop="openMenu($event, getDataMenu())">
        <FxIcon name="download" />Get data<FxIcon name="chevronDown" :size="12" /></button>
      <button type="button" class="fx-cmd" @click="newModel = true"><FxIcon name="SemanticModel" />New semantic model</button>
      <button type="button" class="fx-cmd" aria-haspopup="menu" @click.stop="openMenu($event, notebookMenu())">
        <FxIcon name="Notebook" />Open notebook<FxIcon name="chevronDown" :size="12" /></button>
      <span class="fx-cmdbar__sep" />
      <button type="button" class="fx-cmd" @click="refresh"><FxIcon name="refresh" />Refresh</button>
      <button type="button" class="fx-cmd" @click="propsOf = { kind: 'item', path: '', schema: '' }"><FxIcon name="info" />Properties</button>
    </div>
    <div class="fx-split">
      <aside class="fx-explorer" aria-label="Explorer">
        <div class="fx-explorer__head">Explorer
          <button type="button" class="fx-iconbtn" title="Refresh" aria-label="Refresh explorer" @click="refresh"><FxIcon name="refresh" :size="14" /></button>
        </div>
        <div class="fx-explorer__body" role="tree">
          <div class="fx-node lh-root"><FxIcon name="Lakehouse" /><span class="fx-node__label">{{ itemName }}</span></div>

          <!-- Tables -->
          <div class="fx-node lh-row" role="treeitem" :aria-expanded="open.tables" tabindex="0"
               @click="open.tables = !open.tables" @contextmenu.prevent.stop="openMenu($event, tablesRootMenu())">
            <span class="fx-node__caret"><FxIcon :name="open.tables ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
            <FxIcon name="Schema" /><span class="fx-node__label">Tables</span>
            <button type="button" class="fx-iconbtn lh-more" aria-label="More options for Tables" @click.stop="openMenu($event, tablesRootMenu())"><FxIcon name="more" :size="14" /></button>
          </div>
          <template v-if="open.tables">
            <template v-for="schema in schemas" :key="schema">
              <div class="fx-node lh-row lh-l1" role="treeitem" tabindex="0" :aria-expanded="!closedSchemas.includes(schema)"
                   @click="toggleSchema(schema)">
                <span class="fx-node__caret"><FxIcon :name="closedSchemas.includes(schema) ? 'chevronRight' : 'chevronDown'" :size="12" /></span>
                <FxIcon name="Schema" /><span class="fx-node__label">{{ schema }}</span>
              </div>
              <template v-if="!closedSchemas.includes(schema)">
                <div v-for="t in tablesIn(schema)" :key="t.name" class="fx-node lh-row lh-l2" role="treeitem" tabindex="0"
                     :class="{ 'is-selected': sel.kind === 'table' && sel.schema === schema && sel.path === t.name }"
                     @click="selectTable(schema, t.name)" @keydown.enter="selectTable(schema, t.name)"
                     @contextmenu.prevent.stop="openMenu($event, tableMenu(schema, t.name))">
                  <FxIcon :name="t.shortcut ? 'Shortcut' : t.kind === 'View' ? 'View' : 'Table'" />
                  <span class="fx-node__label">{{ t.name }}</span>
                  <button type="button" class="fx-iconbtn lh-more" :aria-label="'More options for ' + t.name"
                          @click.stop="openMenu($event, tableMenu(schema, t.name))"><FxIcon name="more" :size="14" /></button>
                </div>
              </template>
            </template>
            <div v-if="!tables.length" class="fx-muted lh-empty">No tables yet</div>
          </template>

          <!-- Files -->
          <div class="fx-node lh-row" role="treeitem" tabindex="0" :aria-expanded="open.files"
               :class="{ 'is-selected': sel.kind === 'folder' && sel.path === 'Files' }"
               @click="selectFolder('Files')" @contextmenu.prevent.stop="openMenu($event, folderMenu('Files'))">
            <span class="fx-node__caret" @click.stop="open.files = !open.files"><FxIcon :name="open.files ? 'chevronDown' : 'chevronRight'" :size="12" /></span>
            <FxIcon name="Folder" /><span class="fx-node__label">Files</span>
            <button type="button" class="fx-iconbtn lh-more" aria-label="More options for Files" @click.stop="openMenu($event, folderMenu('Files'))"><FxIcon name="more" :size="14" /></button>
          </div>
          <template v-if="open.files">
            <div v-for="f in visibleFolders" :key="f" class="fx-node lh-row" role="treeitem" tabindex="0"
                 :style="{ paddingLeft: (10 + depth(f) * 14) + 'px' }"
                 :class="{ 'is-selected': (sel.kind === 'folder' || sel.kind === 'file') && (sel.path === f) }"
                 :aria-expanded="hasSub(f) ? !closedFolders.includes(f) : undefined"
                 @click="selectFolder(f)" @keydown.enter="selectFolder(f)"
                 @contextmenu.prevent.stop="openMenu($event, folderMenu(f))">
              <span class="fx-node__caret" @click.stop="toggleFolder(f)">
                <FxIcon v-if="hasSub(f)" :name="closedFolders.includes(f) ? 'chevronRight' : 'chevronDown'" :size="12" /></span>
              <FxIcon name="Folder" /><span class="fx-node__label">{{ leaf(f) }}</span>
              <button type="button" class="fx-iconbtn lh-more" :aria-label="'More options for ' + leaf(f)"
                      @click.stop="openMenu($event, folderMenu(f))"><FxIcon name="more" :size="14" /></button>
            </div>
            <div v-if="!folders.length" class="fx-muted lh-empty">No folders yet</div>
          </template>
        </div>
      </aside>

      <section class="fx-content">
        <!-- Nothing selected -->
        <div v-if="sel.kind === ''" class="fx-empty">
          <FxIcon name="Lakehouse" :size="48" />
          <h3>{{ tables.length ? 'Select a table, a folder or a file' : 'Get data in your lakehouse' }}</h3>
          <p>{{ tables.length }} table(s) and {{ files.length }} file(s) in {{ itemName }}.</p>
          <div class="lh-start">
            <button type="button" class="fx-btn" @click="openUpload('Files')"><FxIcon name="upload" />Upload files</button>
            <button type="button" class="fx-btn" @click="openShortcut"><FxIcon name="Shortcut" />New shortcut</button>
            <button type="button" class="fx-btn" @click="newPipeline"><FxIcon name="DataPipeline" />New data pipeline</button>
            <button type="button" class="fx-btn" @click="newNotebook()"><FxIcon name="Notebook" />New notebook</button>
          </div>
        </div>

        <!-- A table -->
        <template v-else-if="sel.kind === 'table'">
          <div class="lh-tablebar">
            <FxIcon :name="currentTable?.shortcut ? 'Shortcut' : 'Table'" />
            <b>{{ sel.schema }}.{{ sel.path }}</b>
            <span v-if="currentTable" class="fx-muted">{{ currentTable.rows }} rows · {{ currentTable.columns.length }} columns</span>
            <span v-if="currentTable?.shortcut" class="fx-pill fx-pill--info">Shortcut → {{ currentTable.shortcut }}</span>
            <span class="fx-cmdbar__grow" />
            <div class="fx-tabs lh-viewtabs">
              <button v-for="v in ['Data', 'Schema', 'History']" :key="v" type="button" class="fx-tab"
                      :class="{ 'is-active': tableView === v }" @click="setTableView(v)">{{ v }}</button>
            </div>
            <button type="button" class="fx-iconbtn" :aria-label="'More options for ' + sel.path"
                    @click.stop="openMenu($event, tableMenu(sel.schema, sel.path))"><FxIcon name="more" /></button>
          </div>
          <div v-if="previewError" class="fx-msgbar fx-msgbar--error lh-msg"><FxIcon name="error" />{{ previewError }}</div>
          <div v-if="tableView === 'Schema'" class="fx-tablewrap lh-schema">
            <table class="fx-table">
              <thead><tr><th>#</th><th>Column name</th><th>Data type</th></tr></thead>
              <tbody><tr v-for="(c, i) in ((currentTable?.columns || []) as any[])" :key="c[0]"><td class="fx-muted">{{ Number(i) + 1 }}</td><td>{{ c[0] }}</td><td class="fx-mono">{{ c[1] || 'string' }}</td></tr></tbody>
            </table>
          </div>
          <FxGrid v-else :grid="grid" :empty="loading ? 'Loading…' : 'No rows'" />
        </template>

        <!-- A file -->
        <template v-else-if="sel.kind === 'file'">
          <div class="lh-tablebar">
            <FxIcon name="File" /><b>{{ leaf(sel.path) }}</b>
            <span v-if="currentFile" class="fx-muted">{{ currentFile.format }} · {{ currentFile.rows }} rows · {{ currentFile.written }}</span>
            <span class="fx-cmdbar__grow" />
            <button type="button" class="fx-btn fx-btn--sm" @click="openLoad(sel.path)">Load to Tables</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="openDownload(sel.path)"><FxIcon name="download" :size="12" />Download</button>
            <button type="button" class="fx-iconbtn" :aria-label="'More options for ' + leaf(sel.path)"
                    @click.stop="openMenu($event, fileMenu(sel.path))"><FxIcon name="more" /></button>
          </div>
          <div class="lh-crumbs"><template v-for="(c, i) in crumbs(sel.path)" :key="c.path">
            <span v-if="i" class="fx-muted">›</span>
            <button type="button" class="fx-link" @click="selectFolder(c.path)">{{ c.name }}</button></template></div>
          <div v-if="previewError" class="fx-msgbar fx-msgbar--error lh-msg"><FxIcon name="error" />{{ previewError }}</div>
          <FxGrid :grid="grid" :empty="loading ? 'Loading…' : 'This file is empty'" />
        </template>

        <!-- A folder -->
        <template v-else>
          <div class="lh-tablebar">
            <FxIcon name="Folder" /><b>{{ leaf(sel.path) }}</b>
            <span class="fx-muted">{{ subFolders.length }} folder(s) · {{ folderFiles.length }} file(s)</span>
            <span class="fx-cmdbar__grow" />
            <button type="button" class="fx-btn fx-btn--sm" @click="openUpload(sel.path)"><FxIcon name="upload" :size="12" />Upload</button>
            <button type="button" class="fx-btn fx-btn--sm" @click="openNewFolder(sel.path)"><FxIcon name="folderAdd" :size="12" />New subfolder</button>
            <button type="button" class="fx-btn fx-btn--sm" :disabled="!allFilesUnder(sel.path).length" @click="openLoad(sel.path)">Load to Tables</button>
            <button type="button" class="fx-iconbtn" :aria-label="'More options for ' + leaf(sel.path)"
                    @click.stop="openMenu($event, folderMenu(sel.path))"><FxIcon name="more" /></button>
          </div>
          <div class="lh-crumbs"><template v-for="(c, i) in crumbs(sel.path)" :key="c.path">
            <span v-if="i" class="fx-muted">›</span>
            <button type="button" class="fx-link" @click="selectFolder(c.path)">{{ c.name }}</button></template></div>
          <div class="fx-tablewrap lh-schema">
            <table class="fx-table">
              <thead><tr><th>Name</th><th>Date modified</th><th>Type</th><th>Rows</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                <tr v-for="f in subFolders" :key="'d' + f" @dblclick="selectFolder(f)" @contextmenu.prevent.stop="openMenu($event, folderMenu(f))">
                  <td><span class="fx-cellname"><FxIcon name="Folder" /><button type="button" @click="selectFolder(f)">{{ leaf(f) }}</button></span></td>
                  <td class="fx-muted">{{ folderModified(f) }}</td><td>Folder</td><td class="fx-muted">{{ allFilesUnder(f).length }} file(s)</td>
                  <td class="lh-actcell"><button type="button" class="fx-iconbtn" :aria-label="'More options for ' + leaf(f)" @click.stop="openMenu($event, folderMenu(f))"><FxIcon name="more" :size="14" /></button></td>
                </tr>
                <tr v-for="f in folderFiles" :key="f.path" @dblclick="selectFile(f.path)" @contextmenu.prevent.stop="openMenu($event, fileMenu(f.path))">
                  <td><span class="fx-cellname"><FxIcon name="File" /><button type="button" @click="selectFile(f.path)">{{ leaf(f.path) }}</button></span></td>
                  <td class="fx-muted">{{ f.written }}</td><td>{{ fileType(f.path) }}</td><td>{{ f.rows }}</td>
                  <td class="lh-actcell"><button type="button" class="fx-iconbtn" :aria-label="'More options for ' + leaf(f.path)" @click.stop="openMenu($event, fileMenu(f.path))"><FxIcon name="more" :size="14" /></button></td>
                </tr>
                <tr v-if="!subFolders.length && !folderFiles.length">
                  <td colspan="5" class="lh-drop">
                    <FxIcon name="upload" :size="28" />
                    <div>This folder is empty</div>
                    <button type="button" class="fx-btn fx-btn--sm" @click="openUpload(sel.path)">Upload files</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </div>

    <FxMenu v-if="menu" :at="menu.at" :items="menu.items" @close="menu = null" />

    <!-- Load to Tables -->
    <FxModal v-if="load" title="Load to Tables" @close="load = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <div class="fx-field">
        <span class="fx-field__label">Source</span>
        <select v-model="loadSource" class="fx-select" aria-label="Source file or folder">
          <optgroup label="Folders"><option v-for="f in loadableFolders" :key="f" :value="f">{{ f }}/</option></optgroup>
          <optgroup label="Files"><option v-for="f in files" :key="f.path" :value="f.path">{{ f.path }}</option></optgroup>
        </select>
      </div>
      <label class="fx-check"><input v-model="loadExisting" type="radio" :value="false" />New table</label>
      <label class="fx-check"><input v-model="loadExisting" type="radio" :value="true" :disabled="!tables.length" />Existing table</label>
      <div class="fx-field">
        <label for="lh-tname">Table name<span class="fx-field__req">*</span></label>
        <select v-if="loadExisting" id="lh-tname" v-model="loadTable" class="fx-select">
          <option v-for="t in tables" :key="t.schema + t.name" :value="t.name">{{ t.schema }}.{{ t.name }}</option>
        </select>
        <input v-else id="lh-tname" v-model="loadTable" class="fx-input" />
        <span class="fx-field__help">Lowercase letters, numbers and underscores.</span>
      </div>
      <div v-if="loadExisting" class="fx-field">
        <span class="fx-field__label">Load mode</span>
        <label class="fx-check"><input v-model="loadMode" type="radio" value="append" />Append</label>
        <label class="fx-check"><input v-model="loadMode" type="radio" value="overwrite" />Overwrite</label>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!loadTable.trim() || !loadSource" @click="doLoad">Load</button>
        <button type="button" class="fx-btn" @click="load = false">Cancel</button>
      </template>
    </FxModal>

    <!-- Upload files -->
    <FxPanel v-if="upload" title="Upload files" width="440px" @close="upload = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span class="lh-pre">{{ dlgError }}</span></div>
      <p class="lh-p">Files are uploaded from this lab's file system - create or edit them in the <b>Files</b> tool. CSV, TSV, JSON and text files are supported.</p>
      <div class="fx-field">
        <span class="fx-field__label">Destination folder</span>
        <select v-model="upDest" class="fx-select" aria-label="Destination folder">
          <option value="Files">Files/</option>
          <option v-for="f in folders" :key="f" :value="f">{{ f }}/</option>
        </select>
      </div>
      <div class="fx-field">
        <span class="fx-field__label">Files<span class="fx-field__req">*</span></span>
        <div class="lh-picker" role="group" aria-label="Lab files">
          <label v-for="f in localFiles" :key="f.path" class="fx-check lh-pick">
            <input v-model="upPick" type="checkbox" :value="f.path" />
            <FxIcon name="File" :size="14" /><span class="lh-pick__name">{{ f.path }}</span>
            <span class="fx-muted">{{ bytes(f.size) }}</span>
          </label>
          <p v-if="!localFiles.length" class="fx-muted lh-p">The lab has no files yet. Create a CSV or JSON file in the Files tool, then come back.</p>
        </div>
      </div>
      <label class="fx-check"><input v-model="upOverwrite" type="checkbox" />Overwrite if files already exist</label>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!upPick.length || upBusy" @click="doUpload">Upload</button>
        <button type="button" class="fx-btn" @click="upload = false">Cancel</button>
      </template>
    </FxPanel>

    <!-- Download -->
    <FxModal v-if="download" title="Download file" @close="download = ''">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">Downloads <b>{{ download }}</b> to this lab's file system, where the Files tool and the terminal can open it.</p>
      <div class="fx-field">
        <label for="lh-dl">Save as<span class="fx-field__req">*</span></label>
        <input id="lh-dl" v-model="dlPath" class="fx-input" />
      </div>
      <label class="fx-check"><input v-model="dlOverwrite" type="checkbox" />Replace the file if it exists</label>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!dlPath.trim()" @click="doDownload">Download</button>
        <button type="button" class="fx-btn" @click="download = ''">Cancel</button>
      </template>
    </FxModal>

    <!-- New subfolder -->
    <FxModal v-if="newFolderIn" title="New subfolder" @close="newFolderIn = ''">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">In <b>{{ newFolderIn }}/</b></p>
      <div class="fx-field">
        <label for="lh-nf">Folder name<span class="fx-field__req">*</span></label>
        <input id="lh-nf" v-model="newFolderName" class="fx-input" @keydown.enter="doNewFolder" />
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!newFolderName.trim()" @click="doNewFolder">Create</button>
        <button type="button" class="fx-btn" @click="newFolderIn = ''">Cancel</button>
      </template>
    </FxModal>

    <!-- Rename -->
    <FxModal v-if="rename" :title="'Rename ' + rename.what" @close="rename = null">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <div class="fx-field">
        <label for="lh-rn">New name<span class="fx-field__req">*</span></label>
        <input id="lh-rn" v-model="renameTo" class="fx-input" @keydown.enter="doRename" />
        <span v-if="rename.kind === 'table'" class="fx-field__help">Letters, numbers and underscores; start with a letter.</span>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!renameTo.trim() || renameTo.trim() === rename.name" @click="doRename">Rename</button>
        <button type="button" class="fx-btn" @click="rename = null">Cancel</button>
      </template>
    </FxModal>

    <!-- New shortcut -->
    <FxModal v-if="shortcut" title="New shortcut" width="520px" @close="shortcut = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">Internal source: <b>Microsoft OneLake</b>. A shortcut points at a table in another lakehouse or warehouse - no data is copied.</p>
      <div class="fx-field">
        <span class="fx-field__label">Source table<span class="fx-field__req">*</span></span>
        <select v-model="scTarget" class="fx-select" aria-label="Source table">
          <option v-for="o in otherTables" :key="o.key" :value="o.key">{{ o.workspace }} / {{ o.item }} / {{ o.schema }}.{{ o.name }}</option>
        </select>
      </div>
      <div class="fx-field">
        <label for="lh-scname">Shortcut name<span class="fx-field__req">*</span></label>
        <input id="lh-scname" v-model="scName" class="fx-input" />
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!scTarget || !scName.trim()" @click="doShortcut">Create</button>
        <button type="button" class="fx-btn" @click="shortcut = false">Cancel</button>
      </template>
    </FxModal>

    <!-- Maintenance -->
    <FxModal v-if="maint" title="Run maintenance commands" width="520px" @close="maint = false">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">Table: <b>{{ maintTarget.schema }}.{{ maintTarget.name }}</b></p>
      <label class="fx-check"><input v-model="mOptimize" type="checkbox" />Run OPTIMIZE command</label>
      <label class="fx-check lh-indent"><input v-model="mVorder" type="checkbox" :disabled="!mOptimize" />Apply V-Order to maximize reading speeds</label>
      <div class="fx-field lh-indent">
        <label for="lh-z">Z-order by column (optional)</label>
        <select id="lh-z" v-model="mZorder" class="fx-select" :disabled="!mOptimize">
          <option value="">None</option>
          <option v-for="c in maintColumns" :key="c[0]" :value="c[0]">{{ c[0] }}</option>
        </select>
      </div>
      <label class="fx-check"><input v-model="mVacuum" type="checkbox" />Run VACUUM command using retention threshold</label>
      <div class="fx-field lh-indent">
        <label for="lh-ret">Retention threshold (hours)</label>
        <input id="lh-ret" v-model.number="mHours" class="fx-input" type="number" min="0" :disabled="!mVacuum" />
        <span class="fx-field__help">The default is 7 days (168 hours). Files older than the threshold are deleted and time travel to them stops working.</span>
      </div>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!mOptimize && !mVacuum" @click="doMaintenance">Run now</button>
        <button type="button" class="fx-btn" @click="maint = false">Cancel</button>
      </template>
    </FxModal>

    <!-- Delete (tables, files, folders) -->
    <FxModal v-if="del" :title="'Delete ' + del.what + '?'" @close="del = null">
      <div v-if="dlgError" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" />{{ dlgError }}</div>
      <p class="lh-p">{{ del.text }}</p>
      <template #footer>
        <button type="button" class="fx-btn fx-btn--danger" @click="doDelete">Delete</button>
        <button type="button" class="fx-btn" @click="del = null">Cancel</button>
      </template>
    </FxModal>

    <!-- Properties -->
    <FxPanel v-if="propsOf" title="Properties" width="420px" @close="propsOf = null">
      <dl class="lh-props">
        <template v-for="row in propRows" :key="row[0]">
          <dt>{{ row[0] }}</dt>
          <dd><span class="lh-propval" :class="{ 'fx-mono': row[2] }">{{ row[1] }}</span>
            <button v-if="row[2]" type="button" class="fx-iconbtn" :aria-label="'Copy ' + row[0]" @click="copyText(api, String(row[1]), row[0])"><FxIcon name="copy" :size="14" /></button></dd>
        </template>
      </dl>
    </FxPanel>

    <NewItemDialog v-if="newModel" :ws="wsName" initial-type="SemanticModel" @close="newModel = false"
                   @created="v => { newModel = false; go({ page: 'item', ws: v.ws, item: v.name, type: v.type }) }" />
    <ItemSettingsPanel v-if="settings && item" :item="item" :tab="settings" @close="settings = ''" />
  </div>
</template>

<script setup lang="ts">
/**
 * The lakehouse explorer. Every row has a "..." menu and a right-click menu with
 * the actions the real explorer offers; each action runs the `fab` line a
 * student could type (fab mkdir / mv / rm / cp / get / table load / ln), so the
 * equivalent-CLI drawer shows exactly what happened.
 */
import { computed, reactive, ref, watch } from 'vue';
import FxIcon from './FxIcon.vue';
import FxModal from './FxModal.vue';
import FxPanel from './FxPanel.vue';
import FxGrid from './FxGrid.vue';
import FxMenu from './FxMenu.vue';
import ItemHeader from './ItemHeader.vue';
import NewItemDialog from './NewItemDialog.vue';
import ItemSettingsPanel from './ItemSettingsPanel.vue';
import { cli, errorText, gridsOf, itemPath, rows, tablePath, useFabric, type Grid } from './fabric';
import { abfsPath, bytes, copyText, fileType, menuAt, oneLakeUrl, tableName, type MenuAt, type MenuEntry } from './menu';

type SelKind = '' | 'table' | 'folder' | 'file';
interface Sel { kind: SelKind; path: string; schema: string }

const { portal, route, go, run, api } = useFabric();
const wsName = computed(() => String(route.value.ws || ''));
const itemName = computed(() => String(route.value.item || ''));
const base = computed(() => itemPath(wsName.value, itemName.value, 'Lakehouse'));
const item = computed(() => rows(portal.value, 'items').find(i => i.workspace === wsName.value
  && i.name === itemName.value && i.type === 'Lakehouse'));
const tables = computed(() => rows(portal.value, 'objects').filter(o => o.item === itemName.value
  && o.workspace === wsName.value));
const schemas = computed(() => [...new Set(tables.value.map(t => String(t.schema)))].sort());
const files = computed(() => rows(portal.value, 'files').filter(f => f.item === itemName.value));
const localFiles = computed(() => rows(portal.value, 'local_files'));
const folders = computed<string[]>(() => {
  const set = new Set<string>((item.value?.file_folders as string[] | undefined) || []);
  for (const f of files.value) {
    const parts = String(f.path).split('/');
    for (let i = 2; i < parts.length; i++) set.add(parts.slice(0, i).join('/'));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
});

const open = reactive({ tables: true, files: true });
const closedSchemas = ref<string[]>([]);
const closedFolders = ref<string[]>([]);
const sel = ref<Sel>({ kind: '', path: '', schema: '' });
const tableView = ref('Data');
const grid = ref<Grid | null>(null);
const loading = ref(false);
const previewError = ref('');
const settings = ref('');
const newModel = ref(false);
const dlgError = ref('');
const menu = ref<{ at: MenuAt; items: MenuEntry[] } | null>(null);

const currentTable = computed(() => tables.value.find(t => t.schema === sel.value.schema && t.name === sel.value.path));
const currentFile = computed(() => files.value.find(f => f.path === sel.value.path));

function leaf(path: string) { return path.split('/').pop() || path; }
function parent(path: string) { return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''; }
function depth(path: string) { return path.split('/').length - 1; }
function tablesIn(schema: string) { return tables.value.filter(t => t.schema === schema); }
function hasSub(path: string) { return folders.value.some(f => parent(f) === path); }
function allFilesUnder(path: string) { return files.value.filter(f => String(f.path).startsWith(path + '/')); }
const visibleFolders = computed(() => folders.value.filter(f => {
  let p = parent(f);
  while (p && p !== 'Files') {
    if (closedFolders.value.includes(p)) return false;
    p = parent(p);
  }
  return true;
}));
const subFolders = computed(() => folders.value.filter(f => parent(f) === sel.value.path));
const folderFiles = computed(() => files.value.filter(f => parent(String(f.path)) === sel.value.path));
const loadableFolders = computed(() => folders.value.filter(f => allFilesUnder(f).length));
function folderModified(path: string) {
  const list = allFilesUnder(path);
  return list.length ? String(list[list.length - 1].written) : '';
}
function crumbs(path: string) {
  const parts = path.split('/');
  const out: { name: string; path: string }[] = [];
  const last = sel.value.kind === 'file' ? parts.length - 1 : parts.length;
  for (let i = 1; i <= last; i++) out.push({ name: parts[i - 1], path: parts.slice(0, i).join('/') });
  return out;
}
function toggleSchema(schema: string) {
  closedSchemas.value = closedSchemas.value.includes(schema)
    ? closedSchemas.value.filter(s => s !== schema) : [...closedSchemas.value, schema];
}
function toggleFolder(path: string) {
  if (!hasSub(path)) return;
  closedFolders.value = closedFolders.value.includes(path)
    ? closedFolders.value.filter(s => s !== path) : [...closedFolders.value, path];
}

function openMenu(event: MouseEvent, items: MenuEntry[]) {
  menu.value = { at: menuAt(event, 260, Math.min(420, items.length * 34 + 12)), items };
}
function onPageContext(event: MouseEvent) {
  // Right-clicking empty space inside the page should not show the browser menu over a product menu.
  if ((event.target as HTMLElement).closest('input, textarea')) return;
  if (menu.value) event.preventDefault();
}

// ---------------------------------------------------------------- previews
async function loadPreview() {
  if (sel.value.kind !== 'table' && sel.value.kind !== 'file') return;
  loading.value = true;
  previewError.value = '';
  grid.value = null;
  let result;
  if (sel.value.kind === 'file') {
    result = await api.exec(cli(['fab', 'get', `${base.value}/${sel.value.path}`]), { quiet: true, unlogged: true });
  } else if (tableView.value === 'History') {
    result = await api.exec(cli(['fab', 'table', 'history', tablePath(wsName.value, itemName.value, 'Lakehouse',
      sel.value.schema, sel.value.path)]), { quiet: true, unlogged: true });
  } else {
    // The preview reads through the SQL analytics endpoint, as the explorer does.
    result = await api.exec(`SELECT TOP 100 * FROM [${itemName.value}].[${sel.value.schema}].[${sel.value.path}]`,
      { surface: 'fabric_sql', quiet: true, unlogged: true });
  }
  loading.value = false;
  if (!result.ok) { previewError.value = errorText(result); return; }
  grid.value = gridsOf(result).pop() || null;
}
function selectTable(schema: string, name: string) {
  sel.value = { kind: 'table', schema, path: name };
  if (tableView.value === 'Schema') tableView.value = 'Data';
  loadPreview();
}
function selectFolder(path: string) {
  sel.value = { kind: 'folder', schema: '', path };
  if (path !== 'Files') {
    // Opening a folder opens the path to it in the tree.
    let p = parent(path);
    while (p && p !== 'Files') { closedFolders.value = closedFolders.value.filter(c => c !== p); p = parent(p); }
  }
}
function selectFile(path: string) {
  sel.value = { kind: 'file', schema: '', path };
  loadPreview();
}
function setTableView(v: string) {
  tableView.value = v;
  if (v !== 'Schema') loadPreview();
}
watch([tables, files, folders], () => {
  const s = sel.value;
  if (s.kind === 'table' && !tables.value.some(t => t.schema === s.schema && t.name === s.path)) sel.value = { kind: '', path: '', schema: '' };
  if (s.kind === 'file' && !files.value.some(f => f.path === s.path)) sel.value = { kind: '', path: '', schema: '' };
  if (s.kind === 'folder' && s.path !== 'Files' && !folders.value.includes(s.path)) sel.value = { kind: 'folder', path: 'Files', schema: '' };
});

function refresh() { api.exec(cli(['fab', 'ls']), { quiet: true, unlogged: true }).then(() => loadPreview()); }
function switchTo(type: string) {
  if (type === 'SQLEndpoint') go({ page: 'item', ws: wsName.value, item: itemName.value, type: 'SQLEndpoint' });
}

// ---------------------------------------------------------------- menus
function pathsMenu(relative: string): MenuEntry[] {
  return [
    { label: 'Copy ABFS path', icon: 'link', action: () => copyText(api, abfsPath(wsName.value, itemName.value, 'Lakehouse', relative), 'ABFS path') },
    { label: 'Copy relative path for Spark', icon: 'copy', action: () => copyText(api, relative, 'Relative path') },
    { label: 'Copy URL', icon: 'link', action: () => copyText(api, oneLakeUrl(wsName.value, itemName.value, 'Lakehouse', relative), 'URL') },
  ];
}
function getDataMenu(): MenuEntry[] {
  return [
    { label: 'Upload files', icon: 'upload', action: () => openUpload(sel.value.kind === 'folder' ? sel.value.path : 'Files') },
    { label: 'New shortcut', icon: 'Shortcut', action: openShortcut },
    { label: 'New data pipeline', icon: 'DataPipeline', action: newPipeline },
    { label: 'New notebook', icon: 'Notebook', action: () => newNotebook() },
    { sep: true },
    { label: 'Load to Tables', icon: 'Table', disabled: !files.value.length, action: () => openLoad('') },
  ];
}
function notebookMenu(): MenuEntry[] {
  const attached = rows(portal.value, 'items').filter(i => i.type === 'Notebook' && i.workspace === wsName.value
    && i.lakehouse === itemName.value);
  return [
    { label: 'New notebook', icon: 'plus', action: () => newNotebook() },
    ...(attached.length ? [{ sep: true }, { heading: true, label: 'Existing notebooks' }] as MenuEntry[] : []),
    ...attached.map(nb => ({ label: String(nb.name), icon: 'Notebook',
      action: () => go({ page: 'item', ws: wsName.value, item: nb.name, type: 'Notebook' }) })),
  ];
}
function tablesRootMenu(): MenuEntry[] {
  return [
    { label: 'Refresh', icon: 'refresh', action: refresh },
    { label: 'Load to Tables', icon: 'upload', disabled: !files.value.length, action: () => openLoad('') },
    { label: 'New shortcut', icon: 'Shortcut', action: openShortcut },
    { sep: true },
    ...pathsMenu('Tables'),
  ];
}
function tableMenu(schema: string, name: string): MenuEntry[] {
  const t = tables.value.find(x => x.schema === schema && x.name === name);
  return [
    { label: 'Open', icon: 'open', action: () => selectTable(schema, name) },
    { label: 'Open in notebook', icon: 'Notebook', action: () => newNotebook(`df = spark.read.table("${schema}.${name}")\ndisplay(df.limit(1000))`) },
    { label: 'Query with SQL', icon: 'SQLEndpoint', action: () => go({ page: 'item', ws: wsName.value, item: itemName.value, type: 'SQLEndpoint' }) },
    { label: 'New semantic model', icon: 'SemanticModel', action: () => { newModel.value = true; } },
    { sep: true },
    { label: 'Maintenance', icon: 'settings', disabled: !!t?.shortcut, title: t?.shortcut ? 'Run maintenance on the source table' : '', action: () => openMaint(schema, name) },
    { label: 'Rename', icon: 'edit', action: () => openRename({ kind: 'table', name, schema, what: 'table' }) },
    { label: t?.shortcut ? 'Delete shortcut' : 'Delete', icon: 'delete', danger: true, action: () => askDelete({ kind: 'table', path: name, schema,
      what: t?.shortcut ? 'shortcut ' + name : 'table ' + name,
      text: t?.shortcut ? `The shortcut ${schema}.${name} will be removed. The source table ${t.shortcut} is not affected.`
        : `The table ${schema}.${name} and its data will be permanently deleted.` }) },
    { sep: true },
    ...pathsMenu(`Tables/${schema}/${name}`),
    { label: 'Properties', icon: 'info', action: () => { propsOf.value = { kind: 'table', path: name, schema }; } },
  ];
}
function folderMenu(path: string): MenuEntry[] {
  const root = path === 'Files';
  const count = allFilesUnder(path).length;
  return [
    ...(root ? [] : [{ label: 'Open', icon: 'open', action: () => selectFolder(path) }] as MenuEntry[]),
    { label: 'New subfolder', icon: 'folderAdd', action: () => openNewFolder(path) },
    { label: 'Upload files', icon: 'upload', action: () => openUpload(path) },
    { label: 'Load to Tables', icon: 'Table', disabled: !count, action: () => openLoad(path) },
    ...(root ? [] : [
      { sep: true },
      { label: 'Rename', icon: 'edit', action: () => openRename({ kind: 'folder', name: leaf(path), schema: path, what: 'folder' }) },
      { label: 'Delete', icon: 'delete', danger: true, action: () => askDelete({ kind: 'folder', path, schema: '', what: leaf(path),
        text: count ? `The folder ${path} and the ${count} file(s) in it will be permanently deleted.` : `The empty folder ${path} will be deleted.` }) },
    ] as MenuEntry[]),
    { sep: true },
    ...pathsMenu(path),
    { label: 'Properties', icon: 'info', action: () => { propsOf.value = { kind: 'folder', path, schema: '' }; } },
  ];
}
function fileMenu(path: string): MenuEntry[] {
  return [
    { label: 'Preview', icon: 'open', action: () => selectFile(path) },
    { label: 'Load to Tables', icon: 'Table', action: () => openLoad(path) },
    { label: 'Open in notebook', icon: 'Notebook', action: () => newNotebook(sparkRead(path)) },
    { label: 'Download', icon: 'download', action: () => openDownload(path) },
    { sep: true },
    { label: 'Rename', icon: 'edit', action: () => openRename({ kind: 'file', name: leaf(path), schema: path, what: 'file' }) },
    { label: 'Delete', icon: 'delete', danger: true, action: () => askDelete({ kind: 'file', path, schema: '', what: leaf(path),
      text: `The file ${path} will be permanently deleted.` }) },
    { sep: true },
    ...pathsMenu(path),
    { label: 'Properties', icon: 'info', action: () => { propsOf.value = { kind: 'file', path, schema: '' }; } },
  ];
}
function sparkRead(path: string) {
  const f = files.value.find(x => x.path === path);
  const fmt = f?.format === 'csv' ? 'csv' : f?.format === 'text' ? 'text' : 'json';
  const opt = fmt === 'csv' ? '.option("header", "true")' : '';
  return `df = spark.read.format("${fmt}")${opt}.load("${path}")\ndisplay(df)`;
}

// ---------------------------------------------------------------- creating items
function freeName(prefix: string, type: string) {
  const taken = new Set(rows(portal.value, 'items').filter(i => i.type === type && i.workspace === wsName.value).map(i => i.name));
  let n = 1;
  while (taken.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}
async function newNotebook(firstCell = '') {
  const name = freeName('Notebook', 'Notebook');
  const result = await run(cli(['fab', 'mkdir', itemPath(wsName.value, name, 'Notebook')], { '-P': `lakehouse=${itemName.value}` }),
    `Created ${name}`);
  if (!result.ok) return;
  if (firstCell) {
    await run(cli(['fab', 'set', itemPath(wsName.value, name, 'Notebook')], { '-q': 'cells[0]', '-i': firstCell }), '', { quiet: true });
  }
  go({ page: 'item', ws: wsName.value, item: name, type: 'Notebook' });
}
async function newPipeline() {
  const name = freeName('Pipeline', 'DataPipeline');
  const result = await run(cli(['fab', 'mkdir', itemPath(wsName.value, name, 'DataPipeline')]), `Created ${name}`);
  if (result.ok) go({ page: 'item', ws: wsName.value, item: name, type: 'DataPipeline' });
}

// ---------------------------------------------------------------- Load to Tables
const load = ref(false);
const loadSource = ref('');
const loadExisting = ref(false);
const loadTable = ref('');
const loadMode = ref('append');
function openLoad(source: string) {
  dlgError.value = '';
  loadSource.value = source && source !== 'Files' ? source
    : (loadableFolders.value[loadableFolders.value.length - 1] || String(files.value[0]?.path || ''));
  loadTable.value = tableName(leaf(loadSource.value) || 'new_table');
  loadExisting.value = false;
  load.value = true;
}
watch(loadExisting, existing => {
  if (existing) loadTable.value = String(tables.value[0]?.name || '');
  else loadTable.value = tableName(leaf(loadSource.value) || 'new_table');
});
watch(loadSource, src => { if (!loadExisting.value) loadTable.value = tableName(leaf(src) || 'new_table'); });
async function doLoad() {
  const name = loadTable.value.trim();
  const target = tables.value.find(t => t.name === name);
  const schema = String(target?.schema || 'dbo');
  const result = await run(cli(['fab', 'table', 'load', tablePath(wsName.value, itemName.value, 'Lakehouse', schema, name)],
    { '--file': loadSource.value, '--mode': loadExisting.value ? loadMode.value : 'overwrite' }),
  `Loaded ${loadSource.value} to table ${name}`, { quiet: true });
  if (!result.ok) { dlgError.value = errorText(result); return; }
  load.value = false;
  selectTable(schema, name);
}

// ---------------------------------------------------------------- Upload / download / folders
const upload = ref(false);
const upDest = ref('Files');
const upPick = ref<string[]>([]);
const upOverwrite = ref(false);
const upBusy = ref(false);
function openUpload(folder: string) {
  dlgError.value = '';
  upDest.value = folder || 'Files';
  upPick.value = [];
  upload.value = true;
}
async function doUpload() {
  upBusy.value = true;
  dlgError.value = '';
  const failed: string[] = [];
  for (const path of upPick.value) {
    const r = await run(cli(['fab', 'cp', path, `${base.value}/${upDest.value}/`], { '-f': upOverwrite.value }),
      '', { quiet: true });
    if (!r.ok) failed.push(`${path}: ${errorText(r)}`);
  }
  upBusy.value = false;
  const done = upPick.value.length - failed.length;
  if (done) api.notify('success', `Uploaded ${done} file(s) to ${upDest.value}`);
  if (failed.length) { dlgError.value = failed.join('\n'); upPick.value = upPick.value.filter(p => failed.some(f => f.startsWith(p + ':'))); return; }
  upload.value = false;
  selectFolder(upDest.value);
}

const download = ref('');
const dlPath = ref('');
const dlOverwrite = ref(false);
function openDownload(path: string) {
  dlgError.value = '';
  download.value = path;
  dlPath.value = `downloads/${leaf(path)}`;
  dlOverwrite.value = false;
}
async function doDownload() {
  const r = await run(cli(['fab', 'cp', `${base.value}/${download.value}`, dlPath.value.trim()], { '-f': dlOverwrite.value }),
    `Downloaded ${leaf(download.value)} to ${dlPath.value.trim()}`, { quiet: true });
  if (!r.ok) { dlgError.value = errorText(r); return; }
  download.value = '';
}

const newFolderIn = ref('');
const newFolderName = ref('');
function openNewFolder(path: string) {
  dlgError.value = '';
  newFolderIn.value = path;
  newFolderName.value = '';
}
async function doNewFolder() {
  const name = newFolderName.value.trim();
  if (!name) return;
  const path = `${newFolderIn.value}/${name}`;
  const r = await run(cli(['fab', 'mkdir', `${base.value}/${path}`]), `Created folder ${name}`, { quiet: true });
  if (!r.ok) { dlgError.value = errorText(r); return; }
  newFolderIn.value = '';
  selectFolder(path);
}

// ---------------------------------------------------------------- Rename
const rename = ref<{ kind: 'table' | 'folder' | 'file'; name: string; schema: string; what: string } | null>(null);
const renameTo = ref('');
function openRename(target: { kind: 'table' | 'folder' | 'file'; name: string; schema: string; what: string }) {
  dlgError.value = '';
  rename.value = target;
  renameTo.value = target.name;
}
async function doRename() {
  const t = rename.value;
  const name = renameTo.value.trim();
  if (!t || !name) return;
  let src: string;
  let dst: string;
  if (t.kind === 'table') {
    src = tablePath(wsName.value, itemName.value, 'Lakehouse', t.schema, t.name);
    dst = tablePath(wsName.value, itemName.value, 'Lakehouse', t.schema, name);
  } else {
    // For files and folders `schema` carries the full path.
    src = `${base.value}/${t.schema}`;
    dst = `${base.value}/${parent(t.schema)}/${name}`;
  }
  const r = await run(cli(['fab', 'mv', src, dst]), `Renamed ${t.name} to ${name}`, { quiet: true });
  if (!r.ok) { dlgError.value = errorText(r); return; }
  rename.value = null;
  if (t.kind === 'table') selectTable(t.schema, name);
  else if (t.kind === 'folder') selectFolder(`${parent(t.schema)}/${name}`);
  else selectFile(`${parent(t.schema)}/${name}`);
}

// ---------------------------------------------------------------- Shortcut
const shortcut = ref(false);
const scTarget = ref('');
const scName = ref('');
const otherTables = computed(() => rows(portal.value, 'objects').filter(o => o.item !== itemName.value && o.kind === 'Table')
  .map(o => ({ ...o, key: [o.workspace, o.item, o.schema, o.name].join('|') }) as Record<string, any>));
function openShortcut() {
  dlgError.value = '';
  scTarget.value = otherTables.value[0]?.key || '';
  shortcut.value = true;
}
watch(scTarget, key => { scName.value = key ? key.split('|')[3] : ''; });
async function doShortcut() {
  const [ws, lh, schema, table] = scTarget.value.split('|');
  const ownerType = rows(portal.value, 'items').find(i => i.name === lh && i.workspace === ws && i.type === 'Warehouse') ? 'Warehouse' : 'Lakehouse';
  const result = await run(cli(['fab', 'ln', `${base.value}/Tables/dbo/${scName.value.trim()}.Shortcut`],
    { '--type': 'oneLake', '--target': tablePath(ws, lh, ownerType, schema, table) }),
  `Shortcut ${scName.value.trim()} created`, { quiet: true });
  if (!result.ok) { dlgError.value = errorText(result); return; }
  shortcut.value = false;
  selectTable('dbo', scName.value.trim());
}

// ---------------------------------------------------------------- Maintenance
const maint = ref(false);
const maintTarget = ref({ schema: 'dbo', name: '' });
const maintColumns = computed(() => (tables.value.find(t => t.schema === maintTarget.value.schema
  && t.name === maintTarget.value.name)?.columns || []) as any[]);
const mOptimize = ref(true);
const mVorder = ref(true);
const mZorder = ref('');
const mVacuum = ref(false);
const mHours = ref(168);
function openMaint(schema: string, name: string) {
  dlgError.value = '';
  maintTarget.value = { schema, name };
  mZorder.value = '';
  maint.value = true;
}
async function doMaintenance() {
  dlgError.value = '';
  const { schema, name } = maintTarget.value;
  const path = tablePath(wsName.value, itemName.value, 'Lakehouse', schema, name);
  if (mOptimize.value) {
    const r = await run(cli(['fab', 'table', 'optimize', path], { '--vorder': mVorder.value, '--zorder': mZorder.value }),
      `OPTIMIZE completed on ${name}`, { quiet: true });
    if (!r.ok) { dlgError.value = errorText(r); return; }
  }
  if (mVacuum.value) {
    const r = await run(cli(['fab', 'table', 'vacuum', path], { '--retain_n_hours': String(mHours.value) }),
      `VACUUM completed on ${name}`, { quiet: true });
    if (!r.ok) { dlgError.value = errorText(r); return; }
  }
  maint.value = false;
  loadPreview();
}

// ---------------------------------------------------------------- Delete
const del = ref<{ kind: 'table' | 'folder' | 'file'; path: string; schema: string; what: string; text: string } | null>(null);
function askDelete(target: { kind: 'table' | 'folder' | 'file'; path: string; schema: string; what: string; text: string }) {
  dlgError.value = '';
  del.value = target;
}
async function doDelete() {
  const d = del.value;
  if (!d) return;
  const target = d.kind === 'table' ? tablePath(wsName.value, itemName.value, 'Lakehouse', d.schema, d.path) : `${base.value}/${d.path}`;
  const r = await run(cli(['fab', 'rm', target, '-f']), `Deleted ${d.what}`, { quiet: true });
  if (!r.ok) { dlgError.value = errorText(r); return; }
  del.value = null;
}

// ---------------------------------------------------------------- Properties
const propsOf = ref<{ kind: 'item' | 'table' | 'folder' | 'file'; path: string; schema: string } | null>(null);
const propRows = computed<[string, string | number, boolean][]>(() => {
  const p = propsOf.value;
  if (!p) return [];
  const ws = wsName.value;
  const lh = itemName.value;
  if (p.kind === 'item') {
    return [['Name', lh, false], ['Type', 'Lakehouse', false], ['Workspace', ws, false],
      ['Owner', String(item.value?.owner || ''), false], ['Created', String(item.value?.created || ''), false],
      ['Tables', tables.value.length, false], ['Files', files.value.length, false],
      ['Schemas enabled', item.value?.schemas === false ? 'No' : 'Yes', false],
      ['ABFS path', abfsPath(ws, lh, 'Lakehouse', ''), true], ['URL', oneLakeUrl(ws, lh, 'Lakehouse', ''), true]];
  }
  if (p.kind === 'table') {
    const t = tables.value.find(x => x.schema === p.schema && x.name === p.path);
    const rel = `Tables/${p.schema}/${p.path}`;
    return [['Name', p.path, false], ['Schema', p.schema, false], ['Type', t?.shortcut ? 'Shortcut (OneLake)' : 'Managed (Delta)', false],
      ...(t?.shortcut ? [['Target', String(t.shortcut), false]] as [string, string, boolean][] : []),
      ['Rows', Number(t?.rows || 0), false], ['Columns', (t?.columns || []).length, false],
      ['Relative path', rel, true], ['ABFS path', abfsPath(ws, lh, 'Lakehouse', rel), true], ['URL', oneLakeUrl(ws, lh, 'Lakehouse', rel), true]];
  }
  if (p.kind === 'folder') {
    const list = allFilesUnder(p.path);
    return [['Name', leaf(p.path), false], ['Type', 'Folder', false], ['Files', list.length, false],
      ['Rows', list.reduce((n, f) => n + Number(f.rows || 0), 0), false], ['Last modified', folderModified(p.path) || '-', false],
      ['Relative path', p.path, true], ['ABFS path', abfsPath(ws, lh, 'Lakehouse', p.path), true], ['URL', oneLakeUrl(ws, lh, 'Lakehouse', p.path), true]];
  }
  const f = files.value.find(x => x.path === p.path);
  return [['Name', leaf(p.path), false], ['Type', `${fileType(p.path)} file`, false], ['Format', String(f?.format || ''), false],
    ['Rows', Number(f?.rows || 0), false], ['Columns', ((f?.columns as string[] | undefined) || []).join(', ') || '-', false],
    ['Last modified', String(f?.written || ''), false], ['Written by', String(f?.by || '') || '-', false],
    ['Relative path', p.path, true], ['ABFS path', abfsPath(ws, lh, 'Lakehouse', p.path), true], ['URL', oneLakeUrl(ws, lh, 'Lakehouse', p.path), true]];
});
</script>

<style scoped>
.lh-switch { width: 200px; }
@container sl-portal (max-width: 600px) { .lh-switch { width: 124px; flex: none; } }
.lh-root { font-weight: 600; cursor: default; }
.lh-row { position: relative; }
.lh-row .lh-more { visibility: hidden; flex: none; width: 24px; height: 24px; }
.lh-row:hover .lh-more, .lh-row:focus-within .lh-more, .lh-row.is-selected .lh-more { visibility: visible; }
.lh-l1 { padding-left: 16px; }
.lh-l2 { padding-left: 34px; }
.lh-empty { font-size: 12px; padding: 4px 0 4px 40px; }
.lh-start { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
.lh-tablebar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid #e0e0e0; flex-wrap: wrap; min-height: 44px; }
.lh-crumbs { display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; flex-wrap: wrap; border-bottom: 1px solid #f0f0f0; }
.lh-crumbs .fx-link { border: 0; background: none; padding: 0; cursor: pointer; font: inherit; color: #115ea3; }
.lh-viewtabs { border-bottom: 0; padding: 0; }
.lh-viewtabs .fx-tab { height: 32px; }
.lh-schema { flex: 1; }
.lh-actcell { width: 40px; text-align: right; }
.lh-drop { text-align: center; padding: 36px 12px !important; color: #616161; }
.lh-drop > * { margin: 4px auto; }
.lh-msg { margin: 8px 12px; }
.lh-p { margin: 0 0 12px; }
.lh-pre { white-space: pre-wrap; }
.lh-indent { margin-left: 24px; }
.lh-picker { max-height: 260px; overflow: auto; border: 1px solid #d1d1d1; border-radius: 4px; padding: 6px 8px; }
.lh-pick { margin-bottom: 6px; }
.lh-pick__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lh-props { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; font-size: 13px; }
.lh-props dt { color: #616161; }
.lh-props dd { margin: 0; display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.lh-propval { flex: 1; min-width: 0; word-break: break-all; }
</style>
