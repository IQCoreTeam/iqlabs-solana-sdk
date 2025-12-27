import { InstructionNode } from '@codama/nodes';
import { NodePath, ResolvedInstructionInput } from '@codama/visitors-core';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getInstructionInputTypeFragment(scope: Pick<RenderScope, 'asyncResolvers' | 'customInstructionData' | 'nameApi'> & {
    dataArgsManifest: TypeManifest;
    instructionPath: NodePath<InstructionNode>;
    renamedArgs: Map<string, string>;
    resolvedInputs: ResolvedInstructionInput[];
    useAsync: boolean;
}): Fragment;
//# sourceMappingURL=instructionInputType.d.ts.map