const portalRoutes = [
  {
    path: '/portal',
    meta: { requiresAuth: true, requiresPortalApp: true }, // Use standard PlatformShell layout
    redirect: '/portal/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'portal-dashboard',
        component: () => import('@/views/portal/PortalDashboard.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'audits',
        name: 'portal-audit-list',
        component: () => import('@/views/portal/PortalAuditList.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'audits/:eventId',
        name: 'portal-audit-detail',
        component: () => import('@/views/portal/PortalAuditDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'actions',
        name: 'portal-actions',
        component: () => import('@/views/portal/PortalActions.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'cases',
        name: 'portal-case-list',
        component: () => import('@/views/portal/PortalCaseList.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'cases/:id',
        name: 'portal-case-detail',
        component: () => import('@/views/portal/PortalCaseDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'invoices',
        name: 'portal-invoices',
        component: () => import('@/views/portal/PortalInvoices.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'invoices/return',
        name: 'portal-invoice-pay-return',
        component: () => import('@/views/portal/PortalInvoicePayReturn.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'profile',
        name: 'portal-profile',
        component: () => import('@/views/portal/PortalProfile.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      },
      {
        path: 'settings/notifications',
        name: 'portal-notification-preferences',
        component: () => import('@/views/settings/NotificationPreferences.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true }
      }
    ]
  }
];

export default portalRoutes;

