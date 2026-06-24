const auditRoutes = [
  {
    path: '/audit',
    meta: { requiresAuth: true, requiresAuditApp: true },
    redirect: '/audit/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'audit-dashboard',
        component: () => import('@/views/audit/AuditDashboard.vue'),
        meta: { requiresAuth: true, requiresAuditApp: true }
      },
      {
        path: 'schedule',
        name: 'audit-schedule',
        component: () => import('@/views/audit/AuditScheduleSurface.vue'),
        meta: { requiresAuth: true, requiresAuditApp: true }
      },
      {
        path: 'audits',
        name: 'audit-list',
        component: () => import('@/views/audit/AuditList.vue'),
        meta: { requiresAuth: true, requiresAuditApp: true }
      },
      {
        path: 'audits/:eventId',
        name: 'audit-detail',
        component: () => import('@/views/audit/AuditDetail.vue'),
        meta: { requiresAuth: true, requiresAuditApp: true }
      },
      {
        path: 'findings',
        name: 'audit-findings',
        component: () => import('@/views/GenericModule.vue'),
        meta: {
          requiresAuth: true,
          requiresAuditApp: true,
          moduleKey: 'cases',
          appKey: 'AUDIT',
          routeType: 'list'
        }
      },
      {
        path: 'responses',
        name: 'audit-responses',
        component: () => import('@/views/Responses.vue'),
        meta: {
          requiresAuth: true,
          requiresAuditApp: true,
          appKey: 'AUDIT'
        }
      },
      {
        path: 'forms/:id/responses/:responseId',
        name: 'audit-form-response-detail',
        component: () => import('@/pages/ModuleRecordPage.vue'),
        meta: {
          requiresAuth: true,
          requiresAuditApp: true,
          moduleKey: 'responses',
          appKey: 'AUDIT'
        }
      },
      {
        path: 'settings/notifications',
        name: 'audit-notification-preferences',
        component: () => import('@/views/settings/NotificationPreferences.vue'),
        meta: { requiresAuth: true, requiresAuditApp: true }
      }
    ]
  }
];

export default auditRoutes;
