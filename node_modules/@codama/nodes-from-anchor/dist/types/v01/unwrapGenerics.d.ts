import { TypeNode } from '@codama/nodes';
import { IdlV01GenericArgConst, IdlV01GenericArgType, IdlV01TypeDef, IdlV01TypeDefGenericConst, IdlV01TypeDefGenericType, IdlV01TypeDefined } from './idl';
export type GenericsV01 = {
    constArgs: Record<string, IdlV01GenericArgConst & IdlV01TypeDefGenericConst>;
    typeArgs: Record<string, IdlV01GenericArgType & IdlV01TypeDefGenericType>;
    types: Record<string, IdlV01TypeDef & Required<Pick<IdlV01TypeDef, 'generics'>>>;
};
export declare function extractGenerics(types: IdlV01TypeDef[]): [IdlV01TypeDef[], GenericsV01];
export declare function unwrapGenericTypeFromAnchorV01(type: IdlV01TypeDefined, generics: GenericsV01): TypeNode;
//# sourceMappingURL=unwrapGenerics.d.ts.map