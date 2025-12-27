import { Node, NodeKind } from '@codama/nodes';
import { Visitor } from './visitor';
export type VisitorInterceptor<TReturn> = <TNode extends Node>(node: TNode, next: (node: TNode) => TReturn) => TReturn;
export declare function interceptVisitor<TReturn, TNodeKind extends NodeKind>(visitor: Visitor<TReturn, TNodeKind>, interceptor: VisitorInterceptor<TReturn>): Visitor<TReturn, TNodeKind>;
//# sourceMappingURL=interceptVisitor.d.ts.map