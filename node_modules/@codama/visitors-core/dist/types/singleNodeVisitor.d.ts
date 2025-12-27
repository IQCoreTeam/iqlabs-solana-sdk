import { GetNodeFromKind, NodeKind, RootNode } from '@codama/nodes';
import { Visitor } from './visitor';
export declare function singleNodeVisitor<TReturn, TNodeKey extends NodeKind = NodeKind>(key: TNodeKey, fn: (node: GetNodeFromKind<TNodeKey>) => TReturn): Visitor<TReturn, TNodeKey>;
export declare function rootNodeVisitor<TReturn = RootNode>(fn: (node: RootNode) => TReturn): Visitor<TReturn, "rootNode">;
//# sourceMappingURL=singleNodeVisitor.d.ts.map