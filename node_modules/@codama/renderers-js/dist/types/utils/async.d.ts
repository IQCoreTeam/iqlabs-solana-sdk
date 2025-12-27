import { AccountValueNode, ArgumentValueNode, InstructionAccountNode, InstructionArgumentNode, InstructionInputValueNode, InstructionNode } from '@codama/nodes';
import { ResolvedInstructionInput } from '@codama/visitors-core';
export declare function hasAsyncFunction(instructionNode: InstructionNode, resolvedInputs: ResolvedInstructionInput[], asyncResolvers: string[]): boolean;
export declare function hasAsyncDefaultValues(resolvedInputs: ResolvedInstructionInput[], asyncResolvers: string[]): boolean;
export declare function isAsyncDefaultValue(defaultValue: InstructionInputValueNode, asyncResolvers: string[]): boolean;
export declare function getInstructionDependencies(input: InstructionAccountNode | InstructionArgumentNode | InstructionNode, asyncResolvers: string[], useAsync: boolean): (AccountValueNode | ArgumentValueNode)[];
//# sourceMappingURL=async.d.ts.map