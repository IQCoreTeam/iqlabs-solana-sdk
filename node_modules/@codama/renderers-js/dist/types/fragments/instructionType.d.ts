import { InstructionNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope } from '../utils';
export declare function getInstructionTypeFragment(scope: Pick<RenderScope, 'customInstructionData' | 'linkables' | 'nameApi'> & {
    instructionPath: NodePath<InstructionNode>;
}): Fragment;
//# sourceMappingURL=instructionType.d.ts.map