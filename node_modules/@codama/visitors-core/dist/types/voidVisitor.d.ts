import type { NodeKind } from '@codama/nodes';
import { Visitor } from './visitor';
export declare function voidVisitor<TNodeKind extends NodeKind = NodeKind>(options?: {
    keys?: TNodeKind[];
}): Visitor<void, TNodeKind>;
//# sourceMappingURL=voidVisitor.d.ts.map