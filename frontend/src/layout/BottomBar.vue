<template>
  <nav class="bottom-bar">
    <RouterLink to="/home" class="bottom-bar-item" active-class="active" exact-active-class="active">
      <span class="bottom-bar-icon icon-home"></span>
    </RouterLink>
    <RouterLink to="/notifications" class="bottom-bar-item" active-class="active" exact-active-class="active" aria-label="Notifications">
      <span class="bottom-bar-icon-wrap">
        <span class="bottom-bar-icon icon-notifications"></span>
        <span class="bottom-bar-badge" v-if="hasUnread"></span>
      </span>
    </RouterLink>
    <RouterLink to="/settings" class="bottom-bar-item" active-class="active" exact-active-class="active" aria-label="Settings">
      <span class="bottom-bar-icon icon-settings"></span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { hasUnread } from '../shared/notifications'
</script>

<style scoped>
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  background: var(--card);
  border-top: 1px solid var(--border);
  z-index: 100;
}
.bottom-bar-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 100%;
  color: var(--muted);
  text-decoration: none;
}
.bottom-bar-item.active {
  color: var(--accent);
}
/* The SVGs' own fill/stroke colors are irrelevant here: mask-image only
   uses their alpha channel as a stencil, and background-color: currentColor
   paints through it — so each icon automatically follows .bottom-bar-item's
   color (muted, or --accent once active) with no per-icon color markup. */
.bottom-bar-icon {
  display: inline-block;
  width: 22px;
  height: 22px;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
.icon-home {
  -webkit-mask-image: url('/images/icons/home.svg');
  mask-image: url('/images/icons/home.svg');
}
.icon-notifications {
  -webkit-mask-image: url('/images/icons/notifications.svg');
  mask-image: url('/images/icons/notifications.svg');
}
.icon-settings {
  -webkit-mask-image: url('/images/icons/settings.svg');
  mask-image: url('/images/icons/settings.svg');
}
.bottom-bar-icon-wrap {
  position: relative;
  display: inline-flex;
}
.bottom-bar-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #e0453a;
  border: 1.5px solid var(--card);
}
</style>
