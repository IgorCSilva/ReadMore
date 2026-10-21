import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import LearningPage from '../pages/LearningPage.vue'
import LearningTopicPage from '../pages/LearningTopicPage.vue'
import LibraryPage from '../pages/LibraryPage.vue'
import ListenIdentifyPage from '../pages/ListenIdentifyPage.vue'
import NotificationsPage from '../pages/NotificationsPage.vue'
import PartFlowPage from '../pages/PartFlowPage.vue'
import PresentationPage from '../pages/PresentationPage.vue'
import ReadUnderstandPage from '../pages/ReadUnderstandPage.vue'
import ReviewWordsPage from '../pages/ReviewWordsPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import ShadowingPage from '../pages/ShadowingPage.vue'
import SignInPage from '../pages/SignInPage.vue'
import StoriesPage from '../pages/StoriesPage.vue'
import StoryReaderPage from '../pages/StoryReaderPage.vue'
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
    { path: '/notifications', name: 'notifications', component: NotificationsPage, meta: { requiresAuth: true } },
    { path: '/review-words', name: 'review-words', component: ReviewWordsPage, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsPage, meta: { requiresAuth: true } },
    { path: '/shadowing', name: 'shadowing', component: ShadowingPage, meta: { requiresAuth: true } },
    { path: '/stories', name: 'stories', component: StoriesPage, meta: { requiresAuth: true } },
    // Full-screen reader, same hideGlobalBottomBar treatment as
    // ReadUnderstandPage/PartFlowPage below — it owns its own exit topbar
    // and playback-control bottombar instead.
    { path: '/stories/:level/:storyId', name: 'story-reader', component: StoryReaderPage, meta: { hideGlobalBottomBar: true, requiresAuth: true } },
    { path: '/learning', name: 'learning', component: LearningPage, meta: { requiresAuth: true } },
    // Same full-screen reader treatment as /stories/:level/:storyId above —
    // own exit topbar and playback-control bottombar, no Study button.
    { path: '/learning/:theme/:topicId', name: 'learning-topic', component: LearningTopicPage, meta: { hideGlobalBottomBar: true, requiresAuth: true } },
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
