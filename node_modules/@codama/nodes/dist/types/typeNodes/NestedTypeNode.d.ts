import type { NestedTypeNode, Node, TypeNode } from '@codama/node-types';
export declare function resolveNestedTypeNode<TType extends TypeNode>(typeNode: NestedTypeNode<TType>): TType;
export declare function transformNestedTypeNode<TFrom extends TypeNode, TTo extends TypeNode>(typeNode: NestedTypeNode<TFrom>, map: (type: TFrom) => TTo): NestedTypeNode<TTo>;
export declare function isNestedTypeNode<TKind extends TypeNode['kind']>(node: Node | null | undefined, kind: TKind | TKind[]): node is NestedTypeNode<Extract<TypeNode, {
    kind: TKind;
}>>;
export declare function assertIsNestedTypeNode<TKind extends TypeNode['kind']>(node: Node | null | undefined, kind: TKind | TKind[]): asserts node is NestedTypeNode<Extract<TypeNode, {
    kind: TKind;
}>>;
//# sourceMappingURL=NestedTypeNode.d.ts.map