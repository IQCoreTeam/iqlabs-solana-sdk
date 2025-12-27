import { InstructionNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope } from '../utils';
export declare function getInstructionRemainingAccountsFragment(scope: Pick<RenderScope, 'asyncResolvers' | 'getImportFrom' | 'nameApi'> & {
    instructionPath: NodePath<InstructionNode>;
    useAsync: boolean;
}): Fragment | undefined;
//# sourceMappingURL=instructionRemainingAccounts.d.ts.map