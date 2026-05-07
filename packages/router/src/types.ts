/**
 * Core types for @nml/router.
 */

export interface RouteEntry {
  /** URL pattern, e.g. "/users/:id" */
  pattern: string;
  /** Absolute path to the .nml file */
  file: string;
  /** Parsed segments for fast matching */
  segments: RouteSegment[];
  /** Specificity score — higher = matched first */
  score: number;
}

export type RouteSegment =
  | { kind: "static"; value: string }
  | { kind: "param"; name: string }
  | { kind: "wildcard" };

/** Ordered array of route entries, sorted highest-score first. */
export type RouteMap = RouteEntry[];

export interface MatchResult {
  /** The matched .nml file path */
  file: string;
  /** Extracted dynamic params, e.g. { id: "42" } */
  params: Record<string, string>;
}
