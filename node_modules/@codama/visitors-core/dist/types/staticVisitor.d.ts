import { Node, NodeKind } from '@codama/nodes';
import { Visitor } from './visitor';
export declare function staticVisitor<TReturn, TNodeKind extends NodeKind = NodeKind>(fn: (node: Node) => TReturn, options?: {
    keys?: TNodeKind[];
}): Visitor<TReturn, TNodeKind>;
//# sourceMappingURL=staticVisitor.d.ts.map