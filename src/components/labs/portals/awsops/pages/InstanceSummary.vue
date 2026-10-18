<template>
  <dl class="cs-kv">
    <div><dt>Instance ID</dt><dd class="cs-mono">{{ inst.id }}</dd></div>
    <div><dt>Public IPv4 address</dt><dd>{{ inst.public_ip || '-' }}</dd></div>
    <div><dt>Private IPv4 addresses</dt><dd>{{ inst.ip }}</dd></div>
    <div><dt>Instance state</dt><dd><CsStatus :state="inst.state" /></dd></div>
    <div><dt>Instance type</dt><dd>{{ inst.type }}</dd></div>
    <div><dt>VPC ID</dt><dd>{{ inst.vpc || '-' }}</dd></div>
    <div><dt>Subnet ID</dt><dd>{{ inst.subnet || '-' }}</dd></div>
    <div><dt>IAM Role</dt><dd>{{ inst.profile || '-' }}</dd></div>
    <div><dt>Auto Scaling Group name</dt><dd>{{ inst.asg || '-' }}</dd></div>
    <div><dt>Managed (Systems Manager)</dt><dd>{{ inst.ssm }}</dd></div>
    <div><dt>Platform</dt><dd>{{ inst.os }}</dd></div>
    <div><dt>Region</dt><dd>{{ inst.region }}</dd></div>
  </dl>
</template>

<script setup lang="ts">
import CsStatus from '../../aws/CsStatus.vue';

defineProps<{ inst: Record<string, any> }>();
</script>
