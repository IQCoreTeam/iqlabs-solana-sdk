import { GetNodeFromKind, Node, NodeKind } from '@codama/nodes';
import { NodePath } from './NodePath';
export declare class NodeStack {
    /**
     * Contains all the node paths saved during the traversal.
     *
     * - The very last path is the current path which is being
     *   used during the traversal.
     * - The other paths can be used to save and restore the
     *   current path when jumping to different parts of the tree.
     *
     * There must at least be one path in the stack at all times.
     */
    private readonly stack;
    constructor(...stack: readonly [...(readonly NodePath[]), NodePath] | readonly []);
    private get currentPath();
    push(node: Node): void;
    pop(): Node | undefined;
    peek(): Node | undefined;
    pushPath(newPath?: NodePath): void;
    popPath(): NodePath;
    getPath(): NodePath;
    getPath<TKind extends NodeKind>(kind: TKind | TKind[]): NodePath<GetNodeFromKind<TKind>>;
    isEmpty(): boolean;
    clone(): NodeStack;
    toString(): string;
}
//# sourceMappingURL=NodeStack.d.ts.map