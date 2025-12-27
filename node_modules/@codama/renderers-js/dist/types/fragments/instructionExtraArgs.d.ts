import { InstructionNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getInstructionExtraArgsFragment(scope: Pick<RenderScope, 'nameApi'> & {
    extraArgsManifest: TypeManifest;
    instructionPath: NodePath<InstructionNode>;
}): Fragment | undefined;
//# sourceMappingURL=instructionExtraArgs.d.ts.map