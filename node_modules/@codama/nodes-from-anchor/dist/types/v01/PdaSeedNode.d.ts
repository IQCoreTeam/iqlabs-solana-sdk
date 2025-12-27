import { InstructionArgumentNode, PdaSeedNode, PdaSeedValueNode } from '@codama/nodes';
import { IdlV01Seed } from './idl';
export declare function pdaSeedNodeFromAnchorV01(seed: IdlV01Seed, instructionArguments: InstructionArgumentNode[], prefix?: string): Readonly<{
    definition: PdaSeedNode;
    value?: PdaSeedValueNode;
}>;
//# sourceMappingURL=PdaSeedNode.d.ts.map