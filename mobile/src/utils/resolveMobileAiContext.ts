import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { getMobileModule } from '@/config/mobileModules'

export type MobileAiContext = {
  kind: 'record' | 'list' | 'home'
  moduleKey?: string
  recordId?: string
  recordName?: string
  appKey?: string
}

export function resolveMobileAiContext(route: RouteLocationNormalizedLoaded): MobileAiContext {
  if (route.name === 'task-detail' && route.params.taskId) {
    return { kind: 'record', moduleKey: 'tasks', recordId: String(route.params.taskId) }
  }
  if (route.name === 'tasks') {
    return { kind: 'list', moduleKey: 'tasks', appKey: 'SALES' }
  }
  if (route.name === 'module-detail' && route.params.moduleKey && route.params.recordId) {
    const moduleKey = String(route.params.moduleKey)
    const mod = getMobileModule(moduleKey)
    return {
      kind: 'record',
      moduleKey,
      recordId: String(route.params.recordId),
      appKey: mod?.appKey
    }
  }
  if (route.name === 'module-list' && route.params.moduleKey) {
    const moduleKey = String(route.params.moduleKey)
    const mod = getMobileModule(moduleKey)
    return { kind: 'list', moduleKey, appKey: mod?.appKey }
  }
  if (route.name === 'inbox-thread' && route.params.threadId) {
    return { kind: 'record', moduleKey: 'inbox', recordId: String(route.params.threadId) }
  }
  if (route.name === 'inbox') {
    return { kind: 'list', moduleKey: 'inbox' }
  }
  return { kind: 'home' }
}

export function nbaSurfaceForContext(ctx: MobileAiContext): string {
  if (ctx.kind === 'record') return 'record'
  if (ctx.kind === 'list' && ctx.moduleKey) return ctx.moduleKey
  return 'home'
}

export function contextPillLabel(ctx: MobileAiContext, recordName?: string): string {
  if (ctx.kind === 'home') return ''
  const name = recordName || ctx.recordName
  if (name) return name
  const mod = ctx.moduleKey ? getMobileModule(ctx.moduleKey) : null
  if (mod) return ctx.kind === 'record' ? mod.label : mod.label
  if (ctx.moduleKey === 'inbox') return ctx.kind === 'record' ? 'Inbox thread' : 'Inbox'
  if (ctx.moduleKey === 'tasks') return ctx.kind === 'record' ? 'Task' : 'Tasks'
  return ctx.moduleKey || 'Workspace'
}

export function mergeAiContext(
  routeCtx: MobileAiContext,
  override?: {
    moduleKey?: string
    recordId?: string
    recordName?: string
  } | null
): MobileAiContext {
  if (!override?.moduleKey && !override?.recordId) return routeCtx
  const moduleKey = override.moduleKey || routeCtx.moduleKey
  const recordId = override.recordId || routeCtx.recordId
  const mod = moduleKey ? getMobileModule(moduleKey) : null
  return {
    kind: recordId ? 'record' : moduleKey ? 'list' : routeCtx.kind,
    moduleKey,
    recordId,
    recordName: override.recordName || routeCtx.recordName,
    appKey: mod?.appKey || routeCtx.appKey
  }
}
