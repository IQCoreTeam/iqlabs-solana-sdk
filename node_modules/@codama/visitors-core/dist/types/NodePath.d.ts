import { GetNodeFromKind, InstructionNode, Node, NodeKind, ProgramNode } from '@codama/nodes';
export type NodePath<TNode extends Node | undefined = undefined> = TNode extends undefined ? readonly Node[] : readonly [...(readonly Node[]), TNode];
export declare function getLastNodeFromPath<TNode extends Node>(path: NodePath<TNode>): TNode;
export declare function findFirstNodeFromPath<TKind extends NodeKind>(path: NodePath, kind: TKind | TKind[]): GetNodeFromKind<TKind> | undefined;
export declare function findLastNodeFromPath<TKind extends NodeKind>(path: NodePath, kind: TKind | TKind[]): GetNodeFromKind<TKind> | undefined;
export declare function findProgramNodeFromPath(path: NodePath): ProgramNode | undefined;
export declare function findInstructionNodeFromPath(path: NodePath): InstructionNode | undefined;
export declare function getNodePathUntilLastNode<TKind extends NodeKind>(path: NodePath, kind: TKind | TKind[]): NodePath<GetNodeFromKind<TKind>> | undefined;
export declare function isFilledNodePath(path: NodePath | null | undefined): path is NodePath<Node>;
export declare function isNodePath<TKind extends NodeKind>(path: NodePath | null | undefined, kind: TKind | TKind[]): path is NodePath<GetNodeFromKind<TKind>>;
export declare function assertIsNodePath<TKind extends NodeKind>(path: NodePath | null | undefined, kind: TKind | TKind[]): asserts path is NodePath<GetNodeFromKind<TKind>>;
export declare function nodePathToStringArray(path: NodePath): string[];
export declare function nodePathToString(path: NodePath): string;
//# sourceMappingURL=NodePath.d.ts.map