import { NodeKind } from '@codama/nodes';
import { NodeStack } from './NodeStack';
import { Visitor } from './visitor';
export declare function recordNodeStackVisitor<TReturn, TNodeKind extends NodeKind>(visitor: Visitor<TReturn, TNodeKind>, stack: NodeStack): Visitor<TReturn, TNodeKind>;
//# sourceMappingURL=recordNodeStackVisitor.d.ts.map