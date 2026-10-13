/**
 * Action Handler Registry for Graduated Trust
 *
 * Handlers execute in-process and NEVER inside a database transaction.
 */

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
