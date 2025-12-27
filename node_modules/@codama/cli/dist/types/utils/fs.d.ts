import { PathLike } from 'node:fs';
export declare function resolveRelativePath(childPath: string, relativeDirectory?: string | null): string;
export declare function resolveConfigPath(childPath: string, configPath: string | null): string;
export declare function isLocalModulePath(modulePath: string): boolean;
export declare function readJson<T>(filePath: string): Promise<T>;
export declare function readFile(filePath: string): Promise<string>;
export declare function writeFile(filePath: string, content: string): Promise<void>;
export declare function canRead(p: PathLike): Promise<boolean>;
export declare function canWrite(p: PathLike): Promise<boolean>;
//# sourceMappingURL=fs.d.ts.map