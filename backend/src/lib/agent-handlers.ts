/**
 * Action Handler Registry for Graduated Trust
 *
 * Handlers execute in-process and NEVER inside a database transaction.
 */

import {
  A2_BUDGET_ACTION_TYPE,
  A2_BUDGET_MODEL_VERSION,
} from "./agent-a2-budget.js"

export interface ActionHandlerContext {
  actionId: string
  actionType: string
  agentId?: string | null
  agentName: string
  tier: number
  inputPayload?: unknown
}

export interface ActionHandlerResult {
  outputPayload?: unknown
  error?: string
}

export type ActionHandler = (
  ctx: ActionHandlerContext
) => Promise<ActionHandlerResult> | ActionHandlerResult

/**
 * Default stub handler returning { stubExecuted: true, timestamp }.
 * Used as fallback for unknown action types or when no custom handler is registered.
 */
export const defaultStubHandler: ActionHandler = async (ctx) => {
  return {
    outputPayload: {
      stubExecuted: true,
      timestamp: new Date().toISOString(),
      actionType: ctx.actionType,
    },
  }
}

/**
 * A2 budget threshold handler — records Agent Log notification evidence only.
 * Does not send email/SMS/push.
 */
export const budgetThresholdAlertHandler: ActionHandler = (ctx) => {
  const input =
    ctx.inputPayload && typeof ctx.inputPayload === "object" && !Array.isArray(ctx.inputPayload)
      ? (ctx.inputPayload as Record<string, unknown>)
      : {}
  const evaluation =
    input.evaluation && typeof input.evaluation === "object" && !Array.isArray(input.evaluation)
      ? (input.evaluation as Record<string, unknown>)
      : {}

  const metricName = typeof evaluation.metricName === "string" ? evaluation.metricName : "unknown"
  const metricValue = evaluation.metricValue
  const threshold = evaluation.threshold
  const periodKey = typeof evaluation.periodKey === "string" ? evaluation.periodKey : "unspecified"

  return {
    outputPayload: {
      stubExecuted: false,
      handler: "budgetThresholdAlertHandler",
      modelVersion: A2_BUDGET_MODEL_VERSION,
      notificationChannel: "agent_log",
      notificationDelivered: true,
      emailSent: false,
      smsSent: false,
      pushSent: false,
      message:
        `Budget threshold alert recorded in Agent Log: ${metricName} ` +
        `${String(metricValue)} >= ${String(threshold)} (period=${periodKey}). ` +
        `No email/SMS/push was sent (A2 v1).`,
      metricName,
      metricValue,
      threshold,
      periodKey,
      source: evaluation.source ?? null,
      branchId: evaluation.branchId ?? null,
      dedupeKey: typeof input.dedupeKey === "string" ? input.dedupeKey : null,
      comparedAt: evaluation.comparedAt ?? null,
      actionId: ctx.actionId,
      recordedAt: new Date().toISOString(),
    },
  }
}

const handlerRegistry: Map<string, ActionHandler> = new Map()

/**
 * Registers an action handler for a specific action type.
 */
export function registerActionHandler(
  actionType: string,
  handler: ActionHandler
): void {
  handlerRegistry.set(actionType, handler)
}

/**
 * Retrieves the registered action handler, or the default stub handler if unknown.
 */
export function getActionHandler(actionType: string): ActionHandler {
  return handlerRegistry.get(actionType) ?? defaultStubHandler
}

/**
 * Clears custom handlers (useful for testing).
 */
export function clearActionHandlers(): void {
  handlerRegistry.clear()
}

/**
 * Registers built-in production handlers. Safe to call once at process start.
 */
export function registerDefaultAgentHandlers(): void {
  registerActionHandler(A2_BUDGET_ACTION_TYPE, budgetThresholdAlertHandler)
}

/**
 * True when a non-stub handler is registered for the action type.
 */
export function hasRegisteredActionHandler(actionType: string): boolean {
  return handlerRegistry.has(actionType)
}

/**
 * Executes an action handler in-process with guarded error handling.
 * Guarantees execution NEVER throws and returns short error messages (max 500 chars).
 */
export async function executeActionHandler(
  ctx: ActionHandlerContext,
  overrideHandler?: ActionHandler
): Promise<{ success: boolean; outputPayload?: unknown; error?: string }> {
  const handler = overrideHandler ?? getActionHandler(ctx.actionType)
  try {
    const result = await handler(ctx)
    if (result.error) {
      return {
        success: false,
        error: String(result.error).slice(0, 500),
      }
    }
    return {
      success: true,
      outputPayload: result.outputPayload,
    }
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: rawMessage.slice(0, 500),
    }
  }
}
