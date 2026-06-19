import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * Composable untuk navigasi menu pada halaman Settings.
 *
 * Mengikuti struktur sub-menu dari `app/layouts/default.vue`
 * dengan sinkronisasi status aktif berdasarkan route saat ini.
 */
export function useSettingsNav() {
  const route = useRoute()

  const links = computed<NavigationMenuItem[]>(() => [{
    label: 'Profile',
    icon: 'i-lucide-user',
    to: '/settings/profile',
    active: route.path === '/settings/profile'
  }, {
    label: 'Security',
    icon: 'i-lucide-shield',
    to: '/settings/security',
    active: route.path === '/settings/security'
  }, {
    label: 'Notifications',
    icon: 'i-lucide-bell',
    to: '/settings/notifications',
    active: route.path === '/settings/notifications'
  }, {
    label: 'Members',
    icon: 'i-lucide-users',
    to: '/settings/members',
    active: route.path === '/settings/members'
  }, {
    label: 'Claims',
    icon: 'i-lucide-file-warning',
    to: '/settings/claims',
    active: route.path === '/settings/claims'
  }, {
    label: 'Samples',
    icon: 'i-lucide-package',
    to: '/settings/samples',
    active: route.path === '/settings/samples'
  }, {
    label: 'PQA',
    icon: 'i-lucide-clipboard-check',
    to: '/settings/pqa',
    active: route.path === '/settings/pqa'
  }, {
    label: 'Reports',
    icon: 'i-lucide-file-text',
    to: '/settings/reports',
    active: route.path === '/settings/reports'
  }, {
    label: 'Master Data',
    icon: 'i-lucide-database',
    to: '/settings/master',
    active: route.path === '/settings/master'
  }])

  return { links }
}
