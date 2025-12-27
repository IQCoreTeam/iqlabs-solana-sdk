import { ChildProcess, SpawnOptions } from 'child_process';
export type ChildCommand = {
    command: string;
    args: string[];
};
export declare function createChildCommand(command: string, args?: string[]): ChildCommand;
export declare function formatChildCommand(childCommand: ChildCommand): string;
export type ChildProcessResult = ChildProcess & {
    stdoutString: string;
    stderrString: string;
};
export type ChildProcessError = Error & {
    childProcess: ChildProcessResult;
};
export declare function spawnChildCommand(childCommand: ChildCommand, options?: SpawnOptions & {
    quiet: boolean;
}): Promise<ChildProcess & {
    stdoutString: string;
    stderrString: string;
}>;
//# sourceMappingURL=childCommands.d.ts.map