import { GetNodeFromKind, NodeKind } from '@codama/nodes';
import { Visitor } from './visitor';
export declare function tapVisitor<TReturn, TNodeKey extends NodeKind, TVisitor extends Visitor<TReturn, TNodeKey>>(visitor: TVisitor, key: TNodeKey, tap: (node: GetNodeFromKind<TNodeKey>) => void): TVisitor;
//# sourceMappingURL=tapVisitor.d.ts.map