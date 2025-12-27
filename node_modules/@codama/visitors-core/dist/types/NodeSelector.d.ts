import { Node } from '@codama/nodes';
import { NodePath } from './NodePath';
export type NodeSelector = NodeSelectorFunction | NodeSelectorPath;
/**
 * A string that can be used to select a node in a Codama tree.
 * - `*` matches any node.
 * - `someText` matches the name of a node, if any.
 * - `[someNode]` matches a node of the given kind.
 * - `[someNode|someOtherNode]` matches a node with any of the given kind.
 * - `[someNode]someText` matches both the kind and the name of a node.
 * - `a.b.c` matches a node `c` such that its ancestors contains `a` and `b` in order (but not necessarily subsequent).
 */
export type NodeSelectorPath = string;
export type NodeSelectorFunction = (path: NodePath<Node>) => boolean;
export declare const getNodeSelectorFunction: (selector: NodeSelector) => NodeSelectorFunction;
export declare const getConjunctiveNodeSelectorFunction: (selector: NodeSelector | NodeSelector[]) => NodeSelectorFunction;
//# sourceMappingURL=NodeSelector.d.ts.map