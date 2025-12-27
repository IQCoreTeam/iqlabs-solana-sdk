import { TypeNode } from '@codama/nodes';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getTypeDecoderFragment(scope: Pick<RenderScope, 'nameApi'> & {
    docs?: string[];
    manifest: Pick<TypeManifest, 'decoder'>;
    name: string;
    node: TypeNode;
    size: number | null;
}): Fragment;
//# sourceMappingURL=typeDecoder.d.ts.map