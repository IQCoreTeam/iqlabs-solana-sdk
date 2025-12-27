import { AccountNode } from '@codama/nodes';
import { NodePath } from '@codama/visitors-core';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getAccountFetchHelpersFragment(scope: Pick<RenderScope, 'customAccountData' | 'nameApi'> & {
    accountPath: NodePath<AccountNode>;
    typeManifest: TypeManifest;
}): Fragment;
//# sourceMappingURL=accountFetchHelpers.d.ts.map