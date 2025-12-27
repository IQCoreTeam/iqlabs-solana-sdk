import { AccountNode, DefinedTypeNode, InstructionAccountNode, InstructionArgumentNode, InstructionNode, LinkNode, PdaNode, ProgramNode } from '@codama/nodes';
import { NodePath } from './NodePath';
export type LinkableNode = AccountNode | DefinedTypeNode | InstructionAccountNode | InstructionArgumentNode | InstructionNode | PdaNode | ProgramNode;
export declare const LINKABLE_NODES: LinkableNode['kind'][];
export type GetLinkableFromLinkNode<TLinkNode extends LinkNode> = {
    accountLinkNode: AccountNode;
    definedTypeLinkNode: DefinedTypeNode;
    instructionAccountLinkNode: InstructionAccountNode;
    instructionArgumentLinkNode: InstructionArgumentNode;
    instructionLinkNode: InstructionNode;
    pdaLinkNode: PdaNode;
    programLinkNode: ProgramNode;
}[TLinkNode['kind']];
type ProgramDictionary = {
    accounts: Map<string, NodePath<AccountNode>>;
    definedTypes: Map<string, NodePath<DefinedTypeNode>>;
    instructions: Map<string, InstructionDictionary>;
    pdas: Map<string, NodePath<PdaNode>>;
    program: NodePath<ProgramNode>;
};
type InstructionDictionary = {
    accounts: Map<string, NodePath<InstructionAccountNode>>;
    arguments: Map<string, NodePath<InstructionArgumentNode>>;
    instruction: NodePath<InstructionNode>;
};
export declare class LinkableDictionary {
    readonly programs: Map<string, ProgramDictionary>;
    recordPath(linkablePath: NodePath<LinkableNode>): this;
    getPathOrThrow<TLinkNode extends LinkNode>(linkPath: NodePath<TLinkNode>): NodePath<GetLinkableFromLinkNode<TLinkNode>>;
    getPath<TLinkNode extends LinkNode>(linkPath: NodePath<TLinkNode>): NodePath<GetLinkableFromLinkNode<TLinkNode>> | undefined;
    getOrThrow<TLinkNode extends LinkNode>(linkPath: NodePath<TLinkNode>): GetLinkableFromLinkNode<TLinkNode>;
    get<TLinkNode extends LinkNode>(linkPath: NodePath<TLinkNode>): GetLinkableFromLinkNode<TLinkNode> | undefined;
    has(linkPath: NodePath<LinkNode>): boolean;
    private getOrCreateProgramDictionary;
    private getOrCreateInstructionDictionary;
    private getProgramDictionary;
    private getInstructionDictionary;
}
export {};
//# sourceMappingURL=LinkableDictionary.d.ts.map