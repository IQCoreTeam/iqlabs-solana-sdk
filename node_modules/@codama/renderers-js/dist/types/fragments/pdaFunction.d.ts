import { PdaNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope } from '../utils';
export declare function getPdaFunctionFragment(scope: Pick<RenderScope, 'nameApi' | 'typeManifestVisitor'> & {
    pdaPath: NodePath<PdaNode>;
}): Fragment;
//# sourceMappingURL=pdaFunction.d.ts.map