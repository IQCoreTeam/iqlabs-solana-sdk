import { NodeKind } from '@codama/nodes';
import { Visitor } from './visitor';
export declare function mapVisitor<TReturnFrom, TReturnTo, TNodeKind extends NodeKind>(visitor: Visitor<TReturnFrom, TNodeKind>, map: (from: TReturnFrom) => TReturnTo): Visitor<TReturnTo, TNodeKind>;
//# sourceMappingURL=mapVisitor.d.ts.map