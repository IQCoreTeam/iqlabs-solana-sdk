import { Command } from 'commander';
export type ProgramOptions = Readonly<{
    config?: string;
    debug?: boolean;
    idl?: string;
}>;
export declare function setProgramOptions(program: Command): void;
//# sourceMappingURL=programOptions.d.ts.map