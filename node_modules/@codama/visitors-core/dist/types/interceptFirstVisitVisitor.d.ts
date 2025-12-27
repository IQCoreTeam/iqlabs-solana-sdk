import type { NodeKind } from '@codama/nodes';
import { VisitorInterceptor } from './interceptVisitor';
import { Visitor } from './visitor';
export declare function interceptFirstVisitVisitor<TReturn, TNodeKind extends NodeKind>(visitor: Visitor<TReturn, TNodeKind>, interceptor: VisitorInterceptor<TReturn>): Visitor<TReturn, TNodeKind>;
//# sourceMappingURL=interceptFirstVisitVisitor.d.ts.map