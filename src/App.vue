<script setup lang="ts">
import { NNotificationProvider } from 'naive-ui'
import Dog from './components/Dog.vue'
</script>

<template>
  <NNotificationProvider>
    <Dog />
  </NNotificationProvider>
</template>

<style scoped>

</style>
