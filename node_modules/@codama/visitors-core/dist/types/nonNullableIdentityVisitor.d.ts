import { Node, NodeKind } from '@codama/nodes';
import { Visitor } from './visitor';
export declare function nonNullableIdentityVisitor<TNodeKind extends NodeKind = NodeKind>(options?: {
    keys?: TNodeKind[];
}): Visitor<Node, TNodeKind>;
//# sourceMappingURL=nonNullableIdentityVisitor.d.ts.map