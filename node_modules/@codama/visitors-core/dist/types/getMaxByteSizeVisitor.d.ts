import { ByteSizeVisitorKeys } from './getByteSizeVisitor';
import { LinkableDictionary } from './LinkableDictionary';
import { NodeStack } from './NodeStack';
import { Visitor } from './visitor';
export declare function getMaxByteSizeVisitor(linkables: LinkableDictionary, options?: {
    stack?: NodeStack;
}): Visitor<number | null, ByteSizeVisitorKeys>;
//# sourceMappingURL=getMaxByteSizeVisitor.d.ts.map