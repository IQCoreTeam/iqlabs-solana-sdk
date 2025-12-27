import { type NodeKind } from '@codama/nodes';
import { LinkableDictionary } from './LinkableDictionary';
import { Visitor } from './visitor';
export declare function getRecordLinkablesVisitor<TNodeKind extends NodeKind>(linkables: LinkableDictionary): Visitor<void, TNodeKind>;
export declare function recordLinkablesOnFirstVisitVisitor<TReturn, TNodeKind extends NodeKind>(visitor: Visitor<TReturn, TNodeKind>, linkables: LinkableDictionary): Visitor<TReturn, TNodeKind>;
//# sourceMappingURL=recordLinkablesVisitor.d.ts.map