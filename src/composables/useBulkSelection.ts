/**
 * A selection over a list of records, for "select several and delete them".
 *
 * `visibleIds` is what is on screen right now (after any filter), and "Select
 * all" means exactly that: ticking it under a filter must not quietly select
 * rows the reader cannot see. The selection is pruned whenever the list
 * changes, so a record that has gone (deleted, filtered away) can never be
 * counted or sent.
 */
import { computed, ref, watch, type Ref } from 'vue';

export function useBulkSelection(visibleIds: Ref<string[]>) {
    const selected = ref<Set<string>>(new Set());

    watch(visibleIds, ids => {
        const keep = new Set(ids);
        const next = new Set([...selected.value].filter(id => keep.has(id)));
        if (next.size !== selected.value.size) selected.value = next;
    });

    const count = computed(() => selected.value.size);
    const allSelected = computed(() =>
        visibleIds.value.length > 0 && visibleIds.value.every(id => selected.value.has(id)));
    const someSelected = computed(() => count.value > 0 && !allSelected.value);

    function isSelected(id: string): boolean { return selected.value.has(id); }

    function toggle(id: string): void {
        const next = new Set(selected.value);
        if (next.has(id)) next.delete(id); else next.add(id);
        selected.value = next;
    }

    function toggleAll(): void {
        selected.value = allSelected.value ? new Set() : new Set(visibleIds.value);
    }

    function clear(): void { selected.value = new Set(); }

    const ids = computed(() => [...selected.value]);

    return { selected, ids, count, allSelected, someSelected, isSelected, toggle, toggleAll, clear };
}
