import { type GetNodeFromKind, type Node, type NodeKind } from '@codama/nodes';
export type Visitor<TReturn, TNodeKind extends NodeKind = NodeKind> = {
    [K in TNodeKind as GetVisitorFunctionName<K>]: (node: GetNodeFromKind<K>) => TReturn;
};
export type GetVisitorFunctionName<T extends Node['kind']> = T extends `${infer TWithoutNode}Node` ? `visit${Capitalize<TWithoutNode>}` : never;
export declare function visit<TReturn, TNode extends Node>(node: TNode, visitor: Visitor<TReturn, TNode['kind']>): TReturn;
export declare function visitOrElse<TReturn, TNode extends Node, TNodeKind extends NodeKind>(node: TNode, visitor: Visitor<TReturn, TNodeKind>, fallback: (node: TNode) => TReturn): TReturn;
export declare function getVisitFunctionName<TNodeKind extends NodeKind>(nodeKind: TNodeKind): GetVisitorFunctionName<TNodeKind>;
//# sourceMappingURL=visitor.d.ts.map