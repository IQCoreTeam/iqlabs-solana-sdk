import { RegisteredTypeNode } from '@codama/nodes';
import { LinkableDictionary } from './LinkableDictionary';
import { NodeStack } from './NodeStack';
import { Visitor } from './visitor';
export type ByteSizeVisitorKeys = RegisteredTypeNode['kind'] | 'accountNode' | 'constantValueNode' | 'definedTypeLinkNode' | 'definedTypeNode' | 'instructionArgumentNode' | 'instructionNode';
export declare function getByteSizeVisitor(linkables: LinkableDictionary, options?: {
    stack?: NodeStack;
}): Visitor<number | null, ByteSizeVisitorKeys>;
//# sourceMappingURL=getByteSizeVisitor.d.ts.map