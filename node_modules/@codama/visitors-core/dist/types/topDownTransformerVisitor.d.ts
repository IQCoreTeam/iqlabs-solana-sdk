import { Node, NodeKind } from '@codama/nodes';
import { NodeSelector } from './NodeSelector';
import { NodeStack } from './NodeStack';
import { Visitor } from './visitor';
export type TopDownNodeTransformer = <TNode extends Node>(node: TNode, stack: NodeStack) => TNode | null;
export type TopDownNodeTransformerWithSelector = {
    select: NodeSelector | NodeSelector[];
    transform: TopDownNodeTransformer;
};
export declare function topDownTransformerVisitor<TNodeKind extends NodeKind = NodeKind>(transformers: (TopDownNodeTransformer | TopDownNodeTransformerWithSelector)[], options?: {
    keys?: TNodeKind[];
    stack?: NodeStack;
}): Visitor<Node | null, TNodeKind>;
//# sourceMappingURL=topDownTransformerVisitor.d.ts.map