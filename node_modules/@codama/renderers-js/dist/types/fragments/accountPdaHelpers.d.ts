import { AccountNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getAccountPdaHelpersFragment(scope: Pick<RenderScope, 'customAccountData' | 'linkables' | 'nameApi'> & {
    accountPath: NodePath<AccountNode>;
    typeManifest: TypeManifest;
}): Fragment | undefined;
//# sourceMappingURL=accountPdaHelpers.d.ts.map