const portalRoutes = [
  {
    path: '/portal',
    meta: { requiresAuth: true, requiresPortalApp: true },
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
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'events', action: 'read' } }
      },
      {
        path: 'audits/:eventId',
        name: 'portal-audit-detail',
        component: () => import('@/views/portal/PortalAuditDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'events', action: 'read' } }
      },
      {
        path: 'actions',
        name: 'portal-actions',
        component: () => import('@/views/portal/PortalActions.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'events', action: 'read' } }
      },
      {
        path: 'cases',
        name: 'portal-case-list',
        component: () => import('@/views/portal/PortalCaseList.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'cases', action: 'read' } }
      },
      {
        path: 'cases/:id',
        name: 'portal-case-detail',
        component: () => import('@/views/portal/PortalCaseDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'cases', action: 'read' } }
      },
      {
        path: 'knowledge',
        name: 'portal-knowledge',
        component: () => import('@/views/portal/PortalKnowledge.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'documents', action: 'read' } }
      },
      {
        path: 'knowledge/:id',
        name: 'portal-knowledge-article',
        component: () => import('@/views/portal/PortalKnowledgeArticle.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'documents', action: 'read' } }
      },
      {
        path: 'documents',
        name: 'portal-documents',
        component: () => import('@/views/portal/PortalDocuments.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'documents', action: 'read' } }
      },
      {
        path: 'documents/:id',
        name: 'portal-document-detail',
        component: () => import('@/views/portal/PortalDocumentDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'documents', action: 'read' } }
      },
      {
        path: 'invoices',
        name: 'portal-invoices',
        component: () => import('@/views/portal/PortalInvoices.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'invoices', action: 'read' } }
      },
      {
        path: 'invoices/return',
        name: 'portal-invoice-pay-return',
        component: () => import('@/views/portal/PortalInvoicePayReturn.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'invoices', action: 'read' } }
      },
      {
        path: 'organization',
        name: 'portal-organization',
        component: () => import('@/views/portal/PortalOrganization.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'organizations', action: 'read' } }
      },
      {
        path: 'people',
        name: 'portal-people',
        component: () => import('@/views/portal/PortalPeople.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'people', action: 'read' } }
      },
      {
        path: 'deals',
        name: 'portal-deal-list',
        component: () => import('@/views/portal/PortalDealList.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'deals', action: 'read' } }
      },
      {
        path: 'deals/:id',
        name: 'portal-deal-detail',
        component: () => import('@/views/portal/PortalDealDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'deals', action: 'read' } }
      },
      {
        path: 'forms',
        name: 'portal-form-list',
        component: () => import('@/views/portal/PortalFormList.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'forms', action: 'read' } }
      },
      {
        path: 'forms/:id/fill',
        name: 'portal-form-fill',
        component: () => import('@/views/FormFill.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'forms', action: 'create' } }
      },
      {
        path: 'responses',
        name: 'portal-response-list',
        component: () => import('@/views/portal/PortalResponseList.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'responses', action: 'read' } }
      },
      {
        path: 'responses/:id',
        name: 'portal-response-detail',
        component: () => import('@/views/portal/PortalResponseDetail.vue'),
        meta: { requiresAuth: true, requiresPortalApp: true, requiresPermission: { module: 'responses', action: 'read' } }
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
