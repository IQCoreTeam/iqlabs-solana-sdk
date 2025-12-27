import { EnumStructVariantTypeNode, StructTypeNode } from '@codama/nodes';
import type { IdlV01DefinedFieldsNamed, IdlV01EnumVariant } from '../idl';
import type { GenericsV01 } from '../unwrapGenerics';
export declare function enumStructVariantTypeNodeFromAnchorV01(idl: IdlV01EnumVariant & {
    fields: IdlV01DefinedFieldsNamed;
}, generics: GenericsV01): EnumStructVariantTypeNode<StructTypeNode>;
//# sourceMappingURL=EnumStructVariantTypeNode.d.ts.map