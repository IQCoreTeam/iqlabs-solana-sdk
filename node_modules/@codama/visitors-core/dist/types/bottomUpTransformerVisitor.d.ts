import { Node, NodeKind } from '@codama/nodes';
import { NodeSelector } from './NodeSelector';
import { NodeStack } from './NodeStack';
import { Visitor } from './visitor';
export type BottomUpNodeTransformer = (node: Node, stack: NodeStack) => Node | null;
export type BottomUpNodeTransformerWithSelector = {
    select: NodeSelector | NodeSelector[];
    transform: BottomUpNodeTransformer;
};
export declare function bottomUpTransformerVisitor<TNodeKind extends NodeKind = NodeKind>(transformers: (BottomUpNodeTransformer | BottomUpNodeTransformerWithSelector)[], options?: {
    keys?: TNodeKind[];
    stack?: NodeStack;
}): Visitor<Node | null, TNodeKind>;
//# sourceMappingURL=bottomUpTransformerVisitor.d.ts.map