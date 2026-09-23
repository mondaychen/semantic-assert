<script setup lang="ts">
import { computed, ref } from "vue";
import { useData, withBase } from "vitepress";

const props = defineProps<{
  src: string;
  alt: string;
  /** Shown under the thumbnail. */
  caption?: string;
}>();

const { lang } = useData();
const labels = computed(() =>
  lang.value.startsWith("zh")
    ? { expand: "放大查看：", hint: "点击放大", close: "关闭" }
    : { expand: "Expand: ", hint: "Click to enlarge", close: "Close" },
);

const dialog = ref<HTMLDialogElement | null>(null);

function open() {
  dialog.value?.showModal();
}

function close() {
  dialog.value?.close();
}

// Clicks on the backdrop land on the dialog element itself, not its children.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close();
}
</script>

<template>
  <figure class="expandable-image">
    <button
      type="button"
      class="expandable-image__thumb"
      @click="open"
      :aria-label="labels.expand + alt"
    >
      <img :src="withBase(props.src)" :alt="alt" loading="lazy" />
      <span class="expandable-image__hint">{{ labels.hint }}</span>
    </button>
    <figcaption v-if="caption">{{ caption }}</figcaption>
    <dialog ref="dialog" class="expandable-image__dialog" @click="onDialogClick">
      <button
        type="button"
        class="expandable-image__close"
        @click="close"
        :aria-label="labels.close"
      >
        ×
      </button>
      <img :src="withBase(props.src)" :alt="alt" />
    </dialog>
  </figure>
</template>

<style scoped>
.expandable-image {
  margin: 24px 0;
}

.expandable-image__thumb {
  display: block;
  position: relative;
  width: min(100%, 520px);
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  background: #fff;
  cursor: zoom-in;
}

.expandable-image__thumb img {
  display: block;
  width: 100%;
  height: auto;
}

.expandable-image__hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}

.expandable-image__thumb:hover .expandable-image__hint {
  color: var(--vp-c-brand-1);
}

.expandable-image figcaption {
  margin-top: 8px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.expandable-image__dialog {
  width: min(96vw, 1200px);
  max-width: none;
  max-height: 96vh;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  background: #fff;
  cursor: zoom-out;
}

.expandable-image__dialog::backdrop {
  background: rgba(32, 43, 41, 0.75);
}

.expandable-image__dialog img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 96vh;
  object-fit: contain;
  cursor: default;
}

.expandable-image__close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 36px;
  font-size: 24px;
  line-height: 1;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  cursor: pointer;
}
</style>
