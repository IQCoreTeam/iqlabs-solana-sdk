import { GetNodeFromKind, Node, NodeKind } from '@codama/nodes';
import { GetVisitorFunctionName, Visitor } from './visitor';
type DontInfer<T> = T extends any ? T : never;
export type VisitorOverrideFunction<TReturn, TNodeKind extends NodeKind, TNode extends Node> = (node: TNode, scope: {
    next: (node: TNode) => TReturn;
    self: Visitor<TReturn, TNodeKind>;
}) => TReturn;
export type VisitorOverrides<TReturn, TNodeKind extends NodeKind> = {
    [K in TNodeKind as GetVisitorFunctionName<K>]?: VisitorOverrideFunction<TReturn, TNodeKind, GetNodeFromKind<K>>;
};
export declare function extendVisitor<TReturn, TNodeKind extends NodeKind>(visitor: Visitor<TReturn, TNodeKind>, overrides: DontInfer<VisitorOverrides<TReturn, TNodeKind>>): Visitor<TReturn, TNodeKind>;
export {};
//# sourceMappingURL=extendVisitor.d.ts.map