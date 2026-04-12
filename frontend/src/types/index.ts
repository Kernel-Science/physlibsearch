export type LeanName = string[];

export type DeclarationKind =
  | "abbrev"
  | "axiom"
  | "classInductive"
  | "definition"
  | "example"
  | "inductive"
  | "instance"
  | "opaque"
  | "structure"
  | "theorem"
  | "proofWanted";

export interface SearchRecord {
  module_name: LeanName;
  kind: DeclarationKind;
  name: LeanName;
  signature: string;
  type: string;
  value: string | null;
  docstring: string | null;
  informal_name: string;
  informal_description: string;
}

export interface QueryResult {
  result: SearchRecord;
  distance: number;
}

export interface ModuleInfo {
  name: LeanName;
  count: number;
}
