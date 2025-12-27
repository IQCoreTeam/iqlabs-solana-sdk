import { ChildCommand } from './childCommands';
export declare function getPackageManagerInstallCommand(packages: string[], options?: string[]): Promise<ChildCommand>;
export declare function installMissingDependencies(message: string, requiredDependencies: string[]): Promise<boolean>;
export declare function installDependencies(message: string, dependencies: string[]): Promise<boolean>;
//# sourceMappingURL=packageInstall.d.ts.map