/**
 * NML Parser
 * Ports nml_parse.py's build_ast, _expand_components_pass,
 * _inject_slot, and related helpers to TypeScript.
 *
 * Every ASTNode carries loc: { line, column } sourced from the lexer.
 */

import { tokenize, NMLLexerError, type SourceLocation } from "./lexer.js";
/** Browser-compatible djb2 hash — replaces Node crypto for scope IDs. */
function shortHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).slice(0, 6).padStart(6, "0");
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SourceLocation2 extends SourceLocation {}

export interface ASTNode {
  element: string;
  attributes: Record<string, string | boolean | string[]>;
  content: string;
  children: ASTNode[];
  multiline_trigger: boolean;
  multiline_content: string[];
  loc: SourceLocation;
  /** Internal: node-level context override (props) */
  __context__?: Record<string, unknown>;
  /** Set by postProcessConditionalsPass on @if nodes: the else-branch children */
  elseBranch?: ASTNode[];
}

export type ComponentMap = Record<string, ASTNode[]>;
export type GlobalStyles = Record<string, string>;

export class NMLParserError extends Error {
  loc: SourceLocation;
  constructor(message: string, loc: SourceLocation = { line: 0, column: 0 }) {
    super(message);
    this.name = "NMLParserError";
    this.loc = loc;
  }
}

// ---------------------------------------------------------------------------
// Constants mirrored from nml_parse.py
// ---------------------------------------------------------------------------

const INDENT_WIDTH = 4;

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen", "async", "autofocus", "autoplay", "checked",
  "controls", "crossorigin", "default", "defer", "disabled",
  "formnovalidate", "hidden", "ismap", "loop", "multiple",
  "muted", "nomodule", "novalidate", "open", "readonly",
  "required", "reversed", "selected",
]);

const WHITELISTED_ATTRS = new Set([
  "id", "name", "type", "href", "src", "action", "method",
  "placeholder", "value", "for", "rel", "charset", "content",
  "lang", "dir", "tabindex", "role", "target", "download",
  "enctype", "accept", "autocomplete", "min", "max", "step",
  "pattern", "rows", "cols", "colspan", "rowspan", "scope",
  "headers", "width", "height", "alt", "title", "loading",
  "decoding", "fetchpriority", "integrity", "crossorigin",
  "nonce", "referrerpolicy", "sandbox", "srcdoc", "srclang",
  "poster", "preload", "autoplay", "loop", "muted", "controls", "playsinline",
]);

// ---------------------------------------------------------------------------
// Line parser  (equivalent to parse_line in Python)
// ---------------------------------------------------------------------------

export function parseLine(rawContent: string, loc: SourceLocation): ASTNode {
  const line = rawContent.trim();

  // Content pipe
  if (line.startsWith("|")) {
    return makeNode("__text__", {}, line.slice(1).trim(), [], loc);
  }

  // Comments (should not reach here normally, handled by lexer)
  if (line.startsWith("//")) {
    return makeNode("__comment__", {}, "", [], loc);
  }

  // Determine the element name (everything before the first unquoted dot)
  let element = "";
  let rest = "";

  if (line.startsWith("@")) {
    // Could be @define.Name, @slot, @slot.name, @style:, @ComponentName...
    const spaceIdx = line.indexOf(" ");
    const candidate = spaceIdx === -1 ? line : line.slice(0, spaceIdx);

    if (candidate.startsWith("@define.")) {
      element = "@define";
      const name = candidate.slice(8);
      return makeNode("@define", { class: name }, "", [], loc);
    }

    if (candidate === "@slot" || candidate.startsWith("@slot.")) {
      const slotName = candidate.startsWith("@slot.") ? candidate.slice(6) : undefined;
      const attrs: Record<string, string | boolean | string[]> = {};
      if (slotName) attrs["name"] = slotName;
      return makeNode("@slot", attrs, "", [], loc);
    }

    if (candidate === "@style:" || candidate === "@style") {
      const node = makeNode("@style", {}, "", [], loc);
      node.multiline_trigger = candidate.endsWith(":");
      return node;
    }

    if (candidate === "@include" || candidate.startsWith("@include(")) {
      // @include("path/to/file.nml")
      // @include("path/to/file.nml", { key: "value" })
      const afterAt = line.slice(line.indexOf("("));
      return parseIncludeDirective(afterAt, loc);
    }

    // @each(items as item)
    if (candidate === "@each" || candidate.startsWith("@each(")) {
      const parenContent = extractParenContent(line);
      const asMatch = parenContent?.match(/^([\w.]+)\s+as\s+([\w]+)$/);
      if (!asMatch) {
        throw new NMLParserError(
          `@each syntax error: expected '@each(items as item)', got '${line}'`,
          loc
        );
      }
      return makeNode("@each", { items: asMatch[1], as: asMatch[2] }, "", [], loc);
    }

    if (candidate === "@endeach") {
      return makeNode("@endeach", {}, "", [], loc);
    }

    // @if(condition)
    if (candidate === "@if" || candidate.startsWith("@if(")) {
      const condition = extractParenContent(line) ?? "";
      return makeNode("@if", { condition }, "", [], loc);
    }

    if (candidate === "@else") {
      return makeNode("@else", {}, "", [], loc);
    }

    if (candidate === "@endif") {
      return makeNode("@endif", {}, "", [], loc);
    }

    // @ComponentName possibly with attributes
    const dotIdx = findFirstUnquotedDot(candidate);
    if (dotIdx === -1) {
      element = candidate;
      rest = spaceIdx !== -1 ? line.slice(spaceIdx + 1) : "";
    } else {
      element = candidate.slice(0, dotIdx);
      rest = candidate.slice(dotIdx) + (spaceIdx !== -1 ? line.slice(spaceIdx) : "");
    }
  } else {
    // Normal element: leading dot means "div" (or strip leading dot)
    let workLine = line.startsWith(".") ? "div" + line : line;

    // Strip trailing ':' from multiline trigger lines when parsing
    if (workLine.trimEnd().endsWith(":")) {
      workLine = workLine.trimEnd().slice(0, -1).trimEnd();
    }

    const dotIdx = findFirstUnquotedDot(workLine);
    if (dotIdx === -1) {
      element = workLine;
      rest = "";
    } else {
      element = workLine.slice(0, dotIdx);
      rest = workLine.slice(dotIdx);
    }
  }

  // Parse attribute chain from `rest`
  const { attributes, content } = parseAttributeChain(rest, loc);

  const node = makeNode(element, attributes, content, [], loc);
  // Set multiline_trigger if the original line ended with ':'
  if (!line.startsWith("@") && line.trimEnd().endsWith(":")) {
    node.multiline_trigger = true;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Attribute chain parser
// ---------------------------------------------------------------------------

function parseAttributeChain(
  chain: string,
  loc: SourceLocation
): { attributes: Record<string, string | boolean | string[]>; content: string } {
  const attributes: Record<string, string | boolean | string[]> = {};
  let content = "";
  let i = 0;

  while (i < chain.length) {
    if (chain[i] !== ".") {
      i++;
      continue;
    }
    i++; // skip dot

    // Read the attribute name (up to '(' or next unquoted '.' )
    let attrName = "";
    while (i < chain.length && chain[i] !== "(" && chain[i] !== ".") {
      attrName += chain[i];
      i++;
    }

    if (!attrName) continue;

    // Handle on:* events -> translate to native event handler name
    if (attrName.startsWith("on:")) {
      attrName = "on" + attrName.slice(3);
    }

    // Normalize hx:* → hx-* and x:* → x-* (HTMX/Alpine colon sugar)
    // LLMs frequently emit colons instead of dashes; the compiler absorbs both forms.
    if (attrName.startsWith("hx:")) {
      attrName = "hx-" + attrName.slice(3);
    } else if (/^x:[a-z]/.test(attrName)) {
      attrName = "x-" + attrName.slice(2);
    }

    if (i < chain.length && chain[i] === "(") {
      // Read the parenthesised value(s)
      i++; // skip '('
      const args = readParenArgs(chain, i);
      i = args.end + 1; // skip ')'

      if (attrName === "class") {
        // .class("val") replaces class entirely
        // Last arg may be content if multiple args
        if (args.values.length === 1) {
          attributes["class"] = args.values[0];
        } else if (args.values.length >= 2) {
          attributes["class"] = args.values[0];
          content = args.values[args.values.length - 1];
        }
      } else {
        // General attribute  — last value is content if multiple
        if (args.values.length === 1) {
          // Single arg: it IS the attribute value
          // UNLESS attrName matches element name (h1("text") shorthand)
          attributes[attrName] = args.values[0];
        } else if (args.values.length === 0) {
          attributes[attrName] = "";
        } else {
          // Multiple args: first is attr value, last is content
          attributes[attrName] = args.values[0];
          content = args.values[args.values.length - 1];
        }
      }
    } else {
      // Boolean or bare class shorthand (e.g., .text-xl, .disabled, .!text-2xl)
      if (BOOLEAN_ATTRIBUTES.has(attrName)) {
        attributes[attrName] = true;
      } else if (!attrName.includes(":") && !WHITELISTED_ATTRS.has(attrName) && !attrName.startsWith("data-") && !attrName.startsWith("aria-") && !attrName.startsWith("hx-") && !attrName.startsWith("x-")) {
        // Bare word that's not a known HTML attr: treat as additional class
        const existing = attributes["class"];
        if (existing === undefined) {
          attributes["class"] = [attrName];
        } else if (Array.isArray(existing)) {
          existing.push(attrName);
        } else {
          attributes["class"] = existing + " " + attrName;
        }
      } else {
        // Could be data-*, aria-*, hx-*, x-* etc
        attributes[attrName] = true;
      }
    }
  }

  return { attributes, content };
}

// ---------------------------------------------------------------------------
// Helpers for element-level content shorthand  e.g. h1("Hello")
// ---------------------------------------------------------------------------

/**
 * The Python parser supports `h1("Hello")` as shorthand for content.
 * In NML the element line is like `h1.class("blue", "Hello")` or `h1("Hello")`.
 * We need to detect when the "attribute name" equals the element name
 * and treat the value as content instead.
 */
export function parseLineRaw(rawLine: string, loc: SourceLocation): ASTNode {
  // Handle the content shorthand BEFORE the attribute chain parser
  // by checking whether the FIRST parenthesised group uses the element name.
  const line = rawLine.trim();

  if (line.startsWith("|")) {
    return makeNode("__text__", {}, line.slice(1).trim(), [], loc);
  }
  if (line.startsWith("//")) {
    return makeNode("__comment__", {}, "", [], loc);
  }

  // Detect multiline trigger before stripping
  const isMultiline = !line.startsWith("@") && line.trimEnd().endsWith(":");

  // Strip multiline trigger colon from the end for attribute parsing
  const workLine = isMultiline
    ? line.trimEnd().slice(0, -1).trimEnd()
    : line;

  // Find element name
  let element = "";
  let chainStart = 0;

  if (workLine.startsWith("@") || line.startsWith("@")) {
    // Pass the original line so parseLine can detect '@style:'
    return parseLine(line, loc);
  }

  // Split pipe content before element/chain parsing
  // e.g. `h1 | Hello` → element line `h1`, inline content `Hello`
  // e.g. `div.class("x") | Hello` → chain `div.class("x")`, content `Hello`
  let pipeContent = "";
  let workLineNoPipe = workLine;
  const pipeIdx = workLine.indexOf(" | ");
  if (pipeIdx !== -1) {
    workLineNoPipe = workLine.slice(0, pipeIdx);
    pipeContent = workLine.slice(pipeIdx + 3).trim();
  }

  const adjusted = workLineNoPipe.startsWith(".") ? "div" + workLineNoPipe : workLineNoPipe;
  const firstParen = adjusted.indexOf("(");
  const firstDot = findFirstUnquotedDot(adjusted);

  if (firstParen !== -1 && (firstDot === -1 || firstParen < firstDot)) {
    // Content shorthand: `h1("Hello")` or `h1.class("x", "Hello")`
    element = adjusted.slice(0, firstParen);
    const rest = adjusted.slice(firstParen);
    // Read the content from the first parens
    const args = readParenArgs(rest, 1);
    const afterFirst = rest.slice(args.end + 1);
    let content = args.values[args.values.length - 1] ?? "";

    // Parse remaining attribute chain after the first paren group
    const { attributes } = parseAttributeChain(afterFirst, loc);

    // If multiple values in first group, first is attr of same name? No —
    // shorthand is: element("content") or element.attr("v", "content")
    // When the first group immediately follows the element (no dot), it's content.
    if (args.values.length > 1) {
      content = args.values[args.values.length - 1];
    }

    const node = makeNode(element, attributes, content, [], loc);
    if (isMultiline) node.multiline_trigger = true;
    return node;
  }

  if (firstDot === -1) {
    element = adjusted;
    chainStart = adjusted.length;
  } else {
    element = adjusted.slice(0, firstDot);
    chainStart = firstDot;
  }

  const chain = adjusted.slice(chainStart);
  const { attributes, content: chainContent } = parseAttributeChain(chain, loc);
  const content = pipeContent || chainContent;
  const node = makeNode(element, attributes, content, [], loc);
  if (isMultiline) node.multiline_trigger = true;
  return node;
}

// ---------------------------------------------------------------------------
// Build AST  (equivalent to build_ast in Python)
// ---------------------------------------------------------------------------

export function buildAst(
  source: string,
  options: {
    components?: ComponentMap;
    globalStyles?: GlobalStyles;
  } = {}
): ASTNode[] {
  const components = options.components ?? {};
  const globalStyles = options.globalStyles ?? {};

  const lines = source.split("\n");
  const root: ASTNode = makeNode("__root__", {}, "", [], { line: 0, column: 0 });
  const stack: Array<[ASTNode, number]> = [[root, -1]];

  let lineIdx = 0;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const lineNum = lineIdx + 1;
    lineIdx++;

    const stripped = rawLine.trimEnd();

    // Skip blank lines
    if (stripped.trim() === "") continue;

    // Skip comments
    if (stripped.trimStart().startsWith("//")) continue;

    // Validate indentation
    if (stripped.startsWith("\t")) {
      throw new NMLParserError(
        `Indentation error on line ${lineNum}: Please use 4 spaces for indentation, not tabs.`,
        { line: lineNum, column: 0 }
      );
    }

    const leadingSpaces = stripped.length - stripped.trimStart().length;
    if (leadingSpaces % INDENT_WIDTH !== 0) {
      throw new NMLParserError(
        `Indentation error on line ${lineNum}: Non-standard indentation. Use 4 spaces per level.`,
        { line: lineNum, column: 0 }
      );
    }

    const level = leadingSpaces / INDENT_WIDTH;
    const content = stripped.trimStart();
    const loc: SourceLocation = { line: lineNum, column: leadingSpaces };

    // Parse the line into an AST node
    const newNode = parseLineRaw(content, loc);

    // Skip comment nodes
    if (newNode.element === "__comment__") continue;

    // Validate indentation depth
    const currentLevel = stack[stack.length - 1][1];
    if (level > currentLevel + 1) {
      throw new NMLParserError(
        `Indentation error on line ${lineNum}: Incorrect indentation level (too deep).`,
        { line: lineNum, column: leadingSpaces }
      );
    }

    // Pop stack to find correct parent
    while (level <= stack[stack.length - 1][1]) {
      stack.pop();
    }

    const parentNode = stack[stack.length - 1][0];

    // Handle content pipe nodes
    if (newNode.element === "__text__") {
      const parentLevel = stack[stack.length - 1][1];
      if (level !== parentLevel + 1 || parentLevel === -1) {
        throw new NMLParserError(
          `Indentation error on line ${lineNum}: Content pipe '|' must be indented one level deeper than its parent element.`,
          { line: lineNum, column: leadingSpaces }
        );
      }
      parentNode.children.push(newNode);
      continue;
    }

    // Handle multiline blocks (element ends with ':')
    if (isMultilineTrigger(content)) {
      newNode.multiline_trigger = true;
      const blockStartSpaces = (level + 1) * INDENT_WIDTH;

      while (lineIdx < lines.length) {
        const mlRaw = lines[lineIdx];
        const mlLine = lineIdx + 1;
        const mlStripped = mlRaw.trimEnd();

        if (mlStripped.trim() === "") {
          newNode.multiline_content.push("");
          lineIdx++;
          continue;
        }

        const mlSpaces = mlStripped.length - mlStripped.trimStart().length;

        if (mlSpaces < blockStartSpaces) break;

        if (mlSpaces % INDENT_WIDTH !== 0) {
          throw new NMLParserError(
            `Indentation error on line ${mlLine}: Non-standard indentation. Use 4 spaces per level.`,
            { line: mlLine, column: 0 }
          );
        }

        const relativeIndent = " ".repeat(mlSpaces - blockStartSpaces);
        newNode.multiline_content.push(relativeIndent + mlStripped.trimStart());
        lineIdx++;
      }

      parentNode.children.push(newNode);
      // Multiline nodes can't have children in the tree — don't push to stack
      continue;
    }

    parentNode.children.push(newNode);
    stack.push([newNode, level]);
  }

  // Component expansion pass
  root.children = expandComponentsPass(root.children, components, globalStyles);
  // Conditionals post-process pass: group @if/@else/@endif siblings
  return postProcessConditionalsPass(root.children);
}

// ---------------------------------------------------------------------------
// Component expansion pass
// ---------------------------------------------------------------------------

function expandComponentsPass(
  nodes: ASTNode[],
  components: ComponentMap,
  globalStyles: GlobalStyles
): ASTNode[] {
  const expanded: ASTNode[] = [];

  for (const node of nodes) {
    const element = node.element;

    // Process @define blocks
    if (element === "@define") {
      const componentName = node.attributes["class"] as string;
      if (componentName) {
        // Extract @style block
        let styleRaw = "";
        for (const child of node.children) {
          if (child.element === "@style") {
            styleRaw = child.multiline_content.join("\n");
            break;
          }
        }

        const toHash = `${componentName}|${styleRaw}`;
        const digest = shortHash(toHash);
        const scopeId = `nml-c-${digest}`;

        const { componentAst, scopedCss } = extractScopedStyle(node.children, scopeId);

        if (scopedCss) {
          globalStyles[scopeId] = scopedCss;
          const rootNode = findComponentRootNode(componentAst);
          if (rootNode) {
            rootNode.attributes[scopeId] = true;
          }
        }

        components[componentName] = componentAst;
      }
      continue; // @define never added to output AST
    }

    // Process @ComponentName calls
    if (element.startsWith("@") && element !== "@define" && element !== "@slot" && element !== "@style" && element !== "@include" && element !== "@each" && element !== "@endeach" && element !== "@if" && element !== "@else" && element !== "@endif") {
      const componentName = element.slice(1);

      if (!(componentName in components)) {
        throw new NMLParserError(
          `Undefined component: '@${componentName}' not found.`,
          node.loc
        );
      }

      const templateAst = deepClone(components[componentName]);

      // Collect slot content from call site
      const defaultChildren: ASTNode[] = [];
      const namedSlots: Record<string, ASTNode[]> = {};

      for (const child of node.children) {
        if (child.element === "@slot") {
          const slotName = child.attributes["name"] as string | undefined;
          const expandedChildren = expandComponentsPass(child.children, components, globalStyles);
          if (slotName) {
            if (namedSlots[slotName]) {
              namedSlots[slotName].push(...expandedChildren);
            } else {
              namedSlots[slotName] = expandedChildren;
            }
          }
          // Named slot children go to named slots only
        } else {
          // Default slot
          const expandedList = expandComponentsPass([child], components, globalStyles);
          defaultChildren.push(...expandedList);
        }
      }

      const slots: Record<string | symbol, ASTNode[]> = {
        [Symbol.for("default")]: defaultChildren,
        ...namedSlots,
      };

      const injected = injectSlot(templateAst, slots);
      let resolvedAst = injected;
      if (resolvedAst.length > 0) {
        resolvedAst = expandComponentsPass(resolvedAst, components, globalStyles);
      }

      if (resolvedAst.length > 0) {
        const baseNode = resolvedAst[0];
        const callAttrs = node.attributes;

        // Merge call-site attributes
        const mergeAttrs: Record<string, string | boolean | string[]> = {};
        const propsAttrs: Record<string, string | boolean | string[]> = {};

        for (const [k, v] of Object.entries(callAttrs)) {
          if (isMergeableAttr(k)) {
            mergeAttrs[k] = v;
          } else {
            propsAttrs[k] = v;
          }
        }

        baseNode.attributes = mergeAttributes(baseNode.attributes, mergeAttrs);

        if (Object.keys(propsAttrs).length > 0) {
          const propDict: Record<string, string> = {};
          for (const [k, v] of Object.entries(propsAttrs)) {
            propDict[k] = String(v);
          }
          baseNode.__context__ = { prop: propDict };
        }
      }

      expanded.push(...resolvedAst);
      continue;
    }

    // Regular node — recurse into children
    if (node.children.length > 0) {
      node.children = expandComponentsPass(node.children, components, globalStyles);
    }
    expanded.push(node);
  }

  return expanded;
}

// ---------------------------------------------------------------------------
// Slot injection
// ---------------------------------------------------------------------------

function injectSlot(
  templateAst: ASTNode[],
  slots: Record<string | symbol, ASTNode[]>
): ASTNode[] {
  const result: ASTNode[] = [];

  for (const node of templateAst) {
    if (node.element === "@slot") {
      const slotName = node.attributes["name"] as string | undefined;
      const key = slotName ?? Symbol.for("default");
      const provided = slots[key as string] ?? (typeof key === "symbol" ? slots[Symbol.for("default")] : undefined);

      if (provided && provided.length > 0) {
        result.push(...provided);
      } else if (node.children.length > 0) {
        // Fallback content
        result.push(...node.children);
      }
      continue;
    }

    if (node.children.length > 0) {
      node.children = injectSlot(node.children, slots);
    }
    result.push(node);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Scoped style extraction
// ---------------------------------------------------------------------------

function extractScopedStyle(
  children: ASTNode[],
  scopeId: string
): { componentAst: ASTNode[]; scopedCss: string } {
  const componentAst: ASTNode[] = [];
  let scopedCss = "";

  for (const child of children) {
    if (child.element === "@style") {
      const raw = child.multiline_content.join("\n");
      scopedCss = scopeStyleBlock(raw, scopeId);
    } else {
      componentAst.push(child);
    }
  }

  return { componentAst, scopedCss };
}

function scopeStyleBlock(css: string, scopeId: string): string {
  // Add [scopeId] attribute selector to each CSS rule selector
  return css.replace(/\.([\w-]+)(\s*(?::[\w-]+)*)\s*\{/g, (match, className, pseudo) => {
    return `.${className}[${scopeId}]${pseudo} {`;
  });
}

export function findComponentRootNode(ast: ASTNode[]): ASTNode | null {
  for (const node of ast) {
    if (node.element !== "@define" && node.element !== "@slot" && node.element !== "@style" && !node.element.startsWith("//")) {
      return node;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

function isMergeableAttr(key: string): boolean {
  if (key === "class") return true;
  if (BOOLEAN_ATTRIBUTES.has(key)) return true;
  if (WHITELISTED_ATTRS.has(key)) return true;
  if (key.startsWith("data-")) return true;
  if (key.startsWith("aria-")) return true;
  if (key.startsWith("on")) return true; // onclick, etc.
  return false;
}

function mergeAttributes(
  base: Record<string, string | boolean | string[]>,
  overrides: Record<string, string | boolean | string[]>
): Record<string, string | boolean | string[]> {
  const result = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (key === "class") {
      const baseClass = result["class"];
      if (Array.isArray(value)) {
        // Dot-chain classes: append
        const baseStr = Array.isArray(baseClass) ? baseClass.join(" ") : (baseClass as string) ?? "";
        result["class"] = (baseStr + " " + value.join(" ")).trim();
      } else if (typeof value === "string") {
        // .class("val"): replace
        result["class"] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Variable rendering (equivalent to _render_variables in Python)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// isTruthy — Pythonic UI-optimized truthiness
// ---------------------------------------------------------------------------

export function isTruthy(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (val === 0 || val === "") return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val as object).length > 0;
  return Boolean(val);
}

// ---------------------------------------------------------------------------
// Built-in filters
// ---------------------------------------------------------------------------

type FilterFn = (val: unknown, arg?: string) => string;

const BUILTIN_FILTERS: Record<string, FilterFn> = {
  uppercase: (val) => String(val ?? "").toUpperCase(),
  lowercase: (val) => String(val ?? "").toLowerCase(),
  trim: (val) => String(val ?? "").trim(),
  json: (val) => JSON.stringify(val),
  default: (val, arg) => (isTruthy(val) ? String(val) : (arg ?? "")),
};

function applyFilter(filterName: string, filterArg: string | undefined, val: unknown, context: Record<string, unknown>): string | null {
  // 1. Check built-ins
  const builtin = BUILTIN_FILTERS[filterName];
  if (builtin) return builtin(val, filterArg);
  // 2. Check user-defined fn in context
  const userFn = context[filterName];
  if (typeof userFn === "function") return String((userFn as (v: unknown, a?: string) => unknown)(val, filterArg));
  // 3. Unknown → empty string
  return "";
}

// ---------------------------------------------------------------------------
// Variable rendering (equivalent to _render_variables in Python)
// ---------------------------------------------------------------------------

export function renderVariables(
  template: string,
  context: Record<string, unknown>
): string {
  // Matches: {{ varPath }}, {{ varPath|raw }}, {{ varPath|filter }}, {{ varPath|filter("arg") }}
  return template.replace(/\{\{\s*([\w.]+?)(?:\|(raw|[\w]+(?:\([^)]*\))?))?\s*\}\}/g, (match, key, filterExpr) => {
    const value = resolvePath(key, context);

    // No filter — existing behaviour
    if (!filterExpr) {
      if (value === undefined) return match;
      return escapeHtml(String(value));
    }

    // |raw bypass
    if (filterExpr === "raw") {
      if (value === undefined) return match;
      return String(value);
    }

    // Filter expression: filterName or filterName("arg")
    const filterMatch = filterExpr.match(/^([\w]+)(?:\(([^)]*)\))?$/);
    if (!filterMatch) {
      if (value === undefined) return match;
      return escapeHtml(String(value));
    }

    const filterName = filterMatch[1];
    const rawArg = filterMatch[2]; // may be undefined or '"N/A"' etc.
    const filterArg = rawArg !== undefined
      ? rawArg.trim().replace(/^["']|["']$/g, "")
      : undefined;

    const result = applyFilter(filterName, filterArg, value, context);
    // json filter: raw output (not HTML-escaped)
    if (filterName === "json") return result ?? "";
    return escapeHtml(result ?? "");
  });
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function makeNode(
  element: string,
  attributes: Record<string, string | boolean | string[]>,
  content: string,
  children: ASTNode[],
  loc: SourceLocation
): ASTNode {
  return {
    element,
    attributes,
    content,
    children,
    multiline_trigger: false,
    multiline_content: [],
    loc,
  };
}

// ---------------------------------------------------------------------------
// @include directive parser
// ---------------------------------------------------------------------------

/**
 * Parse @include("path") or @include("path", { key: "value" })
 * Stores:
 *   attributes.file  — the relative path string
 *   attributes.overrides — JSON-encoded override object (if provided)
 */
function parseIncludeDirective(afterAt: string, loc: SourceLocation): ASTNode {
  // afterAt looks like: ("path/to/file.nml") or ("path", { k: "v" })
  const openParen = afterAt.indexOf("(");
  if (openParen === -1) {
    throw new NMLParserError("@include requires a file path argument: @include(\"path.nml\")", loc);
  }

  // Extract everything inside the outer parens
  const args = readParenArgs(afterAt, openParen + 1);

  if (args.values.length === 0) {
    throw new NMLParserError("@include requires a file path argument", loc);
  }

  const file = args.values[0];
  if (!file) {
    throw new NMLParserError("@include file path cannot be empty", loc);
  }
  if (file.startsWith("/")) {
    throw new NMLParserError("@include paths must be relative, not absolute", loc);
  }

  // Second arg (if any) is a JSON-like override object string
  // We store it raw as a string and parse it at render time
  const overridesRaw = args.values.length >= 2 ? args.values[1] : "";

  return makeNode("@include", { file, overrides: overridesRaw }, "", [], loc);
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Extract the content between the outermost parentheses of a directive line.
 * e.g. "@each(items as item)" → "items as item"
 *      "@if(user.isAdmin)"    → "user.isAdmin"
 */
function extractParenContent(line: string): string | undefined {
  const open = line.indexOf("(");
  if (open === -1) return undefined;
  const close = line.lastIndexOf(")");
  if (close === -1 || close <= open) return undefined;
  return line.slice(open + 1, close).trim();
}

// ---------------------------------------------------------------------------
// Post-process pass: group @if/@else/@endif and strip @endeach markers
// ---------------------------------------------------------------------------

/**
 * Because NML is indentation-based, @else / @endif appear as SIBLINGS of @if
 * in the parent array (not as children). This pass:
 *   - Finds @if nodes at index i
 *   - Looks ahead for @else at i+1 → moves its children into node.elseBranch
 *   - Removes the @else and @endif siblings
 *   - Removes @endeach siblings (children already captured by indentation)
 *   - Recurses into every node's children array
 */
export function postProcessConditionalsPass(nodes: ASTNode[]): ASTNode[] {
  const result: ASTNode[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];

    if (node.element === "@if") {
      // Recurse into then-branch children first
      node.children = postProcessConditionalsPass(node.children);

      let j = i + 1;

      // Consume optional @else sibling
      if (j < nodes.length && nodes[j].element === "@else") {
        node.elseBranch = postProcessConditionalsPass(nodes[j].children);
        j++;
      }

      // Consume required @endif sibling — throw if missing
      if (j < nodes.length && nodes[j].element === "@endif") {
        j++;
      } else {
        throw new NMLParserError(
          `Missing @endif for @if on line ${node.loc.line}.`,
          node.loc
        );
      }

      result.push(node);
      i = j;
      continue;
    }

    if (node.element === "@each") {
      // Recurse into loop body children
      node.children = postProcessConditionalsPass(node.children);

      let j = i + 1;
      // Consume @endeach sibling — throw if missing
      if (j < nodes.length && nodes[j].element === "@endeach") {
        j++;
      } else {
        throw new NMLParserError(
          `Missing @endeach for @each on line ${node.loc.line}.`,
          node.loc
        );
      }

      result.push(node);
      i = j;
      continue;
    }

    // For all other nodes, recurse into children
    if (node.children.length > 0) {
      node.children = postProcessConditionalsPass(node.children);
    }
    if (node.elseBranch && node.elseBranch.length > 0) {
      node.elseBranch = postProcessConditionalsPass(node.elseBranch);
    }

    result.push(node);
    i++;
  }

  return result;
}

function isMultilineTrigger(content: string): boolean {
  const trimmed = content.trimEnd();
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      }
    }
  }
  return !inQuote && trimmed.endsWith(":");
}

function findFirstUnquotedDot(s: string): number {
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === ".") {
        return i;
      }
    }
  }
  return -1;
}

interface ParenResult {
  values: string[];
  end: number;
}

function readParenArgs(s: string, startIdx: number): ParenResult {
  // s[startIdx-1] is '(' — read comma-separated quoted strings until ')'
  const values: string[] = [];
  let i = startIdx;
  let depth = 1;
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  while (i < s.length && depth > 0) {
    const ch = s[i];

    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
        // Don't add the closing quote
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
        // Opening quote: don't add to current
      } else if (ch === "(") {
        depth++;
        current += ch;
      } else if (ch === ")") {
        depth--;
        if (depth === 0) {
          if (current.trim() !== "" || values.length > 0) {
            values.push(current.trim());
          }
          break;
        } else {
          current += ch;
        }
      } else if (ch === "," && depth === 1) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    i++;
  }

  return { values, end: i };
}
