import { AccountLinkNode, DefinedTypeLinkNode, InstructionLinkNode, PdaLinkNode, ProgramLinkNode, ResolverValueNode } from '@codama/nodes';
import { ParsedCustomDataOptions } from './customData';
export type LinkOverrides = {
    accounts?: Record<string, string>;
    definedTypes?: Record<string, string>;
    instructions?: Record<string, string>;
    pdas?: Record<string, string>;
    programs?: Record<string, string>;
    resolvers?: Record<string, string>;
};
type OverridableNodes = AccountLinkNode | DefinedTypeLinkNode | InstructionLinkNode | PdaLinkNode | ProgramLinkNode | ResolverValueNode;
export type GetImportFromFunction = (node: OverridableNodes, fallback?: string) => string;
export declare function getImportFromFactory(overrides: LinkOverrides, customAccountData: ParsedCustomDataOptions, customInstructionData: ParsedCustomDataOptions): GetImportFromFunction;
export {};
//# sourceMappingURL=linkOverrides.d.ts.map