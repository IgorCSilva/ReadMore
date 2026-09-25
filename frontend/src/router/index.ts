import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import LibraryPage from '../pages/LibraryPage.vue'
import PartFlowPage from '../pages/PartFlowPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/library', name: 'library', component: LibraryPage },
    // A focused, full-screen lesson flow — App.vue reads hideGlobalBottomBar
    // to swap the global nav bar out for this page's own Next-button bar.
    { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage, meta: { hideGlobalBottomBar: true } },
  ],
})

export default router
