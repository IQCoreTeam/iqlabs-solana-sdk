import { AccountValueNode, ArgumentValueNode, InstructionAccountNode, InstructionArgumentNode, InstructionNode } from '@codama/nodes';
import { Visitor } from './visitor';
export type ResolvedInstructionInput = ResolvedInstructionAccount | ResolvedInstructionArgument;
export type ResolvedInstructionAccount = InstructionAccountNode & {
    dependsOn: InstructionDependency[];
    isPda: boolean;
    resolvedIsOptional: boolean;
    resolvedIsSigner: boolean | 'either';
};
export type ResolvedInstructionArgument = InstructionArgumentNode & {
    dependsOn: InstructionDependency[];
};
type InstructionInput = InstructionAccountNode | InstructionArgumentNode;
type InstructionDependency = AccountValueNode | ArgumentValueNode;
export declare function getResolvedInstructionInputsVisitor(options?: {
    includeDataArgumentValueNodes?: boolean;
}): Visitor<ResolvedInstructionInput[], 'instructionNode'>;
export declare function deduplicateInstructionDependencies(dependencies: InstructionDependency[]): InstructionDependency[];
export declare function getInstructionDependencies(input: InstructionInput | InstructionNode): InstructionDependency[];
export {};
//# sourceMappingURL=getResolvedInstructionInputsVisitor.d.ts.map