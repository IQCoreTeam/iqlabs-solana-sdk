import { Fragment } from './fragment';
export type TypeManifest = Readonly<{
    decoder: Fragment;
    encoder: Fragment;
    isEnum: boolean;
    looseType: Fragment;
    strictType: Fragment;
    value: Fragment;
}>;
export declare function typeManifest(input?: Partial<TypeManifest>): TypeManifest;
export declare function mergeTypeManifests(manifests: TypeManifest[], options?: {
    mergeCodecs?: (renders: string[]) => string;
    mergeTypes?: (renders: string[]) => string;
    mergeValues?: (renders: string[]) => string;
}): TypeManifest;
//# sourceMappingURL=typeManifest.d.ts.map