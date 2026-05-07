#!/usr/bin/env bun
/**
 * NML MCP Server — stdio transport
 *
 * Exposes three tools to AI coding assistants (Windsurf, Claude, Cursor, etc.):
 *   nml_compile       — compile NML source → HTML with optional context
 *   nml_lint          — validate NML source, return errors with line/col
 *   nml_list_components — parse a components.nml file, return @define metadata
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { compile, lint, listComponents } from "./tools.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "nml_compile",
    description:
      "Compile an NML source string to HTML. Returns the rendered HTML or a parse error with line/column.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "The NML source code to compile.",
        },
        context: {
          type: "object",
          description: "Optional template variable context (key → value map).",
          additionalProperties: true,
        },
      },
      required: ["source"],
    },
  },
  {
    name: "nml_lint",
    description:
      "Validate NML source syntax without producing HTML. Returns { valid: true } or a list of parse errors with line/column numbers.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "The NML source code to validate.",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "nml_list_components",
    description:
      "Parse a components.nml file and return all @define component names with metadata: slot presence, scoped styles, and referenced template props.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Absolute path to the components.nml file.",
        },
      },
      required: ["filePath"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "nml-mcp-server", version: "2.2.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS as unknown as typeof TOOLS[number][],
}));

// Dispatch tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const input = (args ?? {}) as Record<string, unknown>;

  switch (name) {
    case "nml_compile": {
      const source = String(input.source ?? "");
      const context = (input.context ?? {}) as Record<string, unknown>;
      const result = compile(source, context);

      if (result.ok) {
        return {
          content: [{ type: "text", text: result.html }],
        };
      } else {
        const loc = result.line != null ? ` (line ${result.line}, col ${result.column})` : "";
        return {
          content: [{ type: "text", text: `NML parse error${loc}: ${result.error}` }],
          isError: true,
        };
      }
    }

    case "nml_lint": {
      const source = String(input.source ?? "");
      const result = lint(source);

      return {
        content: [
          {
            type: "text",
            text: result.valid
              ? "NML source is valid."
              : result.errors
                  .map((e) => `Line ${e.line}:${e.column} — ${e.message}`)
                  .join("\n"),
          },
        ],
        isError: !result.valid,
      };
    }

    case "nml_list_components": {
      const filePath = String(input.filePath ?? "");
      const result = await listComponents(filePath, (p) => readFile(p, "utf-8"));

      if (result.ok) {
        if (result.components.length === 0) {
          return {
            content: [{ type: "text", text: "No @define components found." }],
          };
        }
        const text = result.components
          .map((c) => {
            const parts: string[] = [`@define.${c.name}`];
            if (c.props.length > 0) parts.push(`  props: ${c.props.join(", ")}`);
            if (c.hasSlot) parts.push("  has: @slot");
            if (c.hasStyle) parts.push("  has: @style");
            return parts.join("\n");
          })
          .join("\n\n");
        return { content: [{ type: "text", text }] };
      } else {
        const loc = result.line != null ? ` (line ${result.line}, col ${result.column})` : "";
        return {
          content: [{ type: "text", text: `Error${loc}: ${result.error}` }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
