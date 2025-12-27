import { EnumTupleVariantTypeNode, TupleTypeNode } from '@codama/nodes';
import type { IdlV01DefinedFieldsTuple, IdlV01EnumVariant } from '../idl';
import type { GenericsV01 } from '../unwrapGenerics';
export declare function enumTupleVariantTypeNodeFromAnchorV01(idl: IdlV01EnumVariant & {
    fields: IdlV01DefinedFieldsTuple;
}, generics: GenericsV01): EnumTupleVariantTypeNode<TupleTypeNode>;
//# sourceMappingURL=EnumTupleVariantTypeNode.d.ts.map