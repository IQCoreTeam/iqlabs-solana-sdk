import { InstructionNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getInstructionParseFunctionFragment(scope: Pick<RenderScope, 'customInstructionData' | 'nameApi'> & {
    dataArgsManifest: TypeManifest;
    instructionPath: NodePath<InstructionNode>;
}): Fragment;
//# sourceMappingURL=instructionParseFunction.d.ts.map