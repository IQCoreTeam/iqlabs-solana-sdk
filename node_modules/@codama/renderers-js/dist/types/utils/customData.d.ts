import { AccountNode, CamelCaseString, DefinedTypeLinkNode, DefinedTypeNode, InstructionNode } from '@codama/nodes';
export type CustomDataOptions = string | {
    extract?: boolean;
    extractAs?: string;
    importAs?: string;
    importFrom?: string;
    name: string;
};
export type ParsedCustomDataOptions = Map<CamelCaseString, {
    extract: boolean;
    extractAs: CamelCaseString;
    importAs: CamelCaseString;
    importFrom: string;
    linkNode: DefinedTypeLinkNode;
}>;
export declare const parseCustomDataOptions: (customDataOptions: CustomDataOptions[], defaultSuffix: string) => ParsedCustomDataOptions;
export declare const getDefinedTypeNodesToExtract: (nodes: AccountNode[] | InstructionNode[], parsedCustomDataOptions: ParsedCustomDataOptions) => DefinedTypeNode[];
//# sourceMappingURL=customData.d.ts.map