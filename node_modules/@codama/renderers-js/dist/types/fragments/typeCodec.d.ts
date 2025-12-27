import type { TypeNode } from '@codama/nodes';
import { Fragment, RenderScope, TypeManifest } from '../utils';
export declare function getTypeCodecFragment(scope: Pick<RenderScope, 'nameApi'> & {
    codecDocs?: string[];
    decoderDocs?: string[];
    encoderDocs?: string[];
    manifest: Pick<TypeManifest, 'decoder' | 'encoder'>;
    name: string;
    node: TypeNode;
    size: number | null;
}): Fragment;
//# sourceMappingURL=typeCodec.d.ts.map