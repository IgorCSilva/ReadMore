import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import LibraryPage from '../pages/LibraryPage.vue'
import ListenIdentifyPage from '../pages/ListenIdentifyPage.vue'
import PartFlowPage from '../pages/PartFlowPage.vue'
import ReadUnderstandPage from '../pages/ReadUnderstandPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/library', name: 'library', component: LibraryPage },
    { path: '/settings', name: 'settings', component: SettingsPage },
    // A focused, full-screen lesson flow — App.vue reads hideGlobalBottomBar
    // to swap the global nav bar out for this page's own Next-button bar.
    { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage, meta: { hideGlobalBottomBar: true } },
    { path: '/read/:topicId', name: 'read-understand', component: ReadUnderstandPage, meta: { hideGlobalBottomBar: true } },
    { path: '/listen/:topicId', name: 'listen-identify', component: ListenIdentifyPage, meta: { hideGlobalBottomBar: true } },
  ],
})

export default router
