<template>
  <div class="fx-grid">
    <div v-if="!grid" class="fx-grid__empty">{{ empty || 'No results' }}</div>
    <template v-else>
      <div class="fx-grid__scroll">
        <table class="fx-grid__table">
          <thead>
            <tr>
              <th class="fx-grid__rownum" aria-label="Row" />
              <th v-for="(col, ci) in grid.columns" :key="ci">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in grid.rows" :key="ri">
              <td class="fx-grid__rownum">{{ ri + 1 }}</td>
              <td v-for="(cell, ci) in row" :key="ci" :class="{ 'is-null': cell === null }"
                  :title="cell === null ? 'NULL' : String(cell)">
                {{ cell === null ? 'NULL' : cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="fx-grid__status">
        {{ grid.rows.length }} row{{ grid.rows.length === 1 ? '' : 's' }}
        <template v-if="grid.total > grid.rows.length"> shown of {{ grid.total }}</template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/** A result grid (SQL editor, notebook output, table preview, DAX query view). */
export interface Grid { columns: string[]; rows: unknown[][]; total: number }
defineProps<{ grid: Grid | null; empty?: string }>();
</script>
