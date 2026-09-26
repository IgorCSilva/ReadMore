import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import LibraryPage from '../pages/LibraryPage.vue'
import ListenIdentifyPage from '../pages/ListenIdentifyPage.vue'
import PartFlowPage from '../pages/PartFlowPage.vue'
import PresentationPage from '../pages/PresentationPage.vue'
import ReadUnderstandPage from '../pages/ReadUnderstandPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import SignInPage from '../pages/SignInPage.vue'
import { getCurrentUser } from '../shared/currentUser'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The public landing page — always shown at "/", regardless of whether
    // an email is already saved in this browser (no auto-redirect to Home).
    // It owns its own fixed top bar, so it hides the global one same as the
    // other full-screen pages below.
    { path: '/', name: 'presentation', component: PresentationPage, meta: { hideGlobalBottomBar: true } },
    { path: '/signin', name: 'sign-in', component: SignInPage, meta: { hideGlobalBottomBar: true } },
    { path: '/home', name: 'home', component: HomePage, meta: { requiresAuth: true } },
    { path: '/library', name: 'library', component: LibraryPage, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsPage, meta: { requiresAuth: true } },
    // A focused, full-screen lesson flow — App.vue reads hideGlobalBottomBar
    // to swap the global nav bar out for this page's own Next-button bar.
    { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage, meta: { hideGlobalBottomBar: true, requiresAuth: true } },
    { path: '/read/:topicId', name: 'read-understand', component: ReadUnderstandPage, meta: { hideGlobalBottomBar: true, requiresAuth: true } },
    { path: '/listen/:topicId', name: 'listen-identify', component: ListenIdentifyPage, meta: { hideGlobalBottomBar: true, requiresAuth: true } },
    // Catches any unmatched path (typos, dead links, old bookmarks). Redirect
    // targets are resolved before navigation guards run, against the target
    // route's own meta — so this just needs to point at Home; Home's
    // requiresAuth is what sends signed-out visitors on to sign-in instead.
    { path: '/:pathMatch(.*)*', name: 'not-found', redirect: '/home' },
  ],
})

// Pages under requiresAuth call ensureUserEmail() themselves, but that falls
// back to a blocking window.prompt() when no email is signed in — jarring
// when reached by navigating straight to a protected URL (typed in, an old
// bookmark, or the browser back button after logging out). Redirecting to
// the sign-in page here means those pages only ever mount once an email is
// already known, so their own ensureUserEmail() call never has to prompt.
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getCurrentUser().email) {
    return { name: 'sign-in' }
  }
})

export default router
