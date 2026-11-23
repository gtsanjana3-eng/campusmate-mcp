import { McpServer } from '@modelcontextprotocol/server';
import type { ToolDeps } from './defineTool.ts';

export const SERVER_INFO = { name: 'campusmate', version: '0.1.0' } as const;

/**
 * Builds the MCP server for one request (the HTTP handler is stateless).
 * Tools are registered here with `defineTool` from Phase 9 onwards.
 */
export function createMcpServer(_deps: ToolDeps): McpServer {
  return new McpServer(SERVER_INFO, {
    instructions:
      'CampusMate gives access to one student’s college life: timetable, deadlines, attendance and notices. ' +
      'Actions that change anything only create a pending request; the student approves it in the CampusMate dashboard.',
  });
}
