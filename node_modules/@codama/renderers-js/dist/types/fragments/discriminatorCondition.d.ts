import { type DiscriminatorNode, type ProgramNode, type StructTypeNode } from '@codama/nodes';
import { Fragment, RenderScope } from '../utils';
/**
 * ```
 * if (data.length === 72) {
 *   return splTokenAccounts.TOKEN;
 * }
 *
 * if (containsBytes(data, getU32Encoder().encode(42), offset)) {
 *   return splTokenAccounts.TOKEN;
 * }
 *
 * if (containsBytes(data, new Uint8Array([1, 2, 3]), offset)) {
 *   return splTokenAccounts.TOKEN;
 * }
 * ```
 */
export declare function getDiscriminatorConditionFragment(scope: Pick<RenderScope, 'nameApi' | 'typeManifestVisitor'> & {
    dataName: string;
    discriminators: DiscriminatorNode[];
    ifTrue: string;
    programNode: ProgramNode;
    struct: StructTypeNode;
}): Fragment;
//# sourceMappingURL=discriminatorCondition.d.ts.map