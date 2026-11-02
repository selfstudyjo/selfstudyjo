<template>
  <component :is="glyph" class="sfs-pg-icon" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * The glyph for a playground or one of its tools.
 *
 * App 11 names its tool icons (`aws`, `kubernetes`, `hdfs`, ...) and this is
 * the one place they become drawings, in lucide - Font Awesome is not loaded
 * on this platform, and a name with no glyph falls back to a terminal rather
 * than to a blank square (working rule 51).
 */
import { computed } from 'vue';
import {
  Activity, BarChart3, Blocks, Boxes, Briefcase, Car, ChefHat, Cloud, Code2,
  Cog, Container, Database, FileCode, Gauge, GitBranch, Globe, HardDrive,
  Layers, Network, Package, Puzzle, Server, Shield, Ship, Smartphone,
  Sparkles, Terminal, Workflow, Wrench, Zap,
} from 'lucide-vue-next';

const props = defineProps<{ name?: string }>();

const GLYPHS: Record<string, unknown> = {
  aws: Cloud, azure: Cloud, terraform: Blocks, briefcase: Briefcase,
  database: Database, layers: Layers, activity: Activity, gauge: Gauge,
  hdfs: HardDrive, terminal: Terminal, git: GitBranch, docker: Container,
  kubernetes: Ship, jenkins: Workflow, ansible: Wrench, puppet: Puzzle,
  chef: ChefHat, python: FileCode, code: Code2, server: Server,
  smartphone: Smartphone, globe: Globe, sparkles: Sparkles, netsim: Network,
  car: Car, spark: Zap, package: Package, file: FileCode, chart: BarChart3,
  shield: Shield, boxes: Boxes, cog: Cog,
};

const glyph = computed(() => GLYPHS[props.name || ''] || Terminal);
</script>
