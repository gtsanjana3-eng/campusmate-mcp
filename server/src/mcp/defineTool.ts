import type {
  CallToolResult,
  McpServer,
  StandardSchemaWithJSON,
  ToolCallback,
} from '@modelcontextprotocol/server';
import type * as z from 'zod';
import type { ActivityKind, ToolName } from '../../../shared/types/index.ts';
import type { Store } from '../data/store.ts';
import { requireAbility } from '../domain/abilities.ts';
import { logActivity } from '../domain/activity.ts';
import { AppError } from '../domain/errors.ts';
import { log } from '../lib/logger.ts';

export type ToolDeps = { store: Store };

/** What a tool handler returns: a reply for the AI, a sentence for the activity log, typed data. */
export type ToolOutcome<Out> = {
  text: string;
  activity: string;
  structured: Out;
  /** Pending action created by an act tool (Phase 9). */
  actionId?: string;
};

type ToolSpec<
  In extends z.ZodObject & StandardSchemaWithJSON,
  Out extends z.ZodObject & StandardSchemaWithJSON,
> = {
  name: ToolName;
  /** 'read' tools run immediately; 'act' tools may only create a pending action. */
  kind: 'read' | 'act';
  title: string;
  description: string;
  inputSchema: In;
  /** Required: every CampusMate tool returns typed, validated structured content. */
  outputSchema: Out;
};

const textResult = (text: string, isError = false) => ({
  content: [{ type: 'text' as const, text }],
  ...(isError ? { isError: true } : {}),
});

/**
 * Registers a tool with the rules every CampusMate tool must follow:
 * 1. the student's ability switch is checked first,
 * 2. every call (allowed, refused or failed) is written to the activity log,
 * 3. expected errors become a plain explanation; unexpected ones are logged and hidden.
 */
export function defineTool<
  In extends z.ZodObject & StandardSchemaWithJSON,
  Out extends z.ZodObject & StandardSchemaWithJSON,
>(
  server: McpServer,
  deps: ToolDeps,
  spec: ToolSpec<In, Out>,
  handler: (input: z.infer<In>) => ToolOutcome<z.infer<Out>>,
): void {
  const record = (kind: ActivityKind, summary: string, actionId?: string) =>
    logActivity(deps.store, { kind, tool: spec.name, summary, ...(actionId ? { actionId } : {}) });

  const callback = async (input: z.infer<In>): Promise<CallToolResult> => {
    try {
      requireAbility(deps.store, spec.name);
      // The SDK has already validated `input` against spec.inputSchema.
      const outcome = handler(input);
      record(spec.kind === 'read' ? 'read' : 'proposed', outcome.activity, outcome.actionId);
      // Out is a z.object schema, so its output is always a plain object.
      const structuredContent = outcome.structured as Record<string, unknown>;
      return { ...textResult(outcome.text), structuredContent };
    } catch (error) {
      if (error instanceof AppError) {
        const kind = error.code === 'ability_disabled' ? 'blocked' : 'failed';
        record(kind, `${spec.title}: ${error.message}`);
        return textResult(error.message, true);
      }
      log.error('mcp.tool_failed', error, { tool: spec.name });
      record('failed', `${spec.title} failed unexpectedly.`);
      return textResult('Something went wrong in CampusMate. Please try again.', true);
    }
  };

  server.registerTool<Out, In>(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      outputSchema: spec.outputSchema,
    },
    // ToolCallback<In> is a conditional type TypeScript cannot resolve while In is generic;
    // `callback` is typed against the same schema, so this cast only bridges that gap.
    callback as ToolCallback<In>,
  );
}
