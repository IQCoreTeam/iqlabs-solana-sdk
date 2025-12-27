import { TypeNode } from '@codama/nodes';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getTypeEncoderFragment(scope: Pick<RenderScope, 'nameApi'> & {
    docs?: string[];
    manifest: Pick<TypeManifest, 'encoder'>;
    name: string;
    node: TypeNode;
    size: number | null;
}): Fragment;
//# sourceMappingURL=typeEncoder.d.ts.map