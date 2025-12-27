import { Command, ParseOptions } from 'commander';
export declare function codama(args: string[], opts?: {
    suppressOutput?: boolean;
}): Promise<void>;
export declare function runProgram(program: Command, argv: readonly string[], parseOptions?: ParseOptions): Promise<void>;
export declare function createProgram(internalOptions?: {
    exitOverride?: boolean;
    suppressOutput?: boolean;
}): Command;
//# sourceMappingURL=program.d.ts.map