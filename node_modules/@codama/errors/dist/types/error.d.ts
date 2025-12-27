/**
 * Heavily inspired by @solana/errors.
 * @see https://github.com/anza-xyz/kit/blob/main/packages/errors
 */
import { CodamaErrorCode } from './codes';
import { CodamaErrorContext } from './context';
export declare function isCodamaError<TErrorCode extends CodamaErrorCode>(e: unknown, code?: TErrorCode): e is CodamaError<TErrorCode>;
type CodamaErrorCodedContext = Readonly<{
    [P in CodamaErrorCode]: (CodamaErrorContext[P] extends undefined ? object : CodamaErrorContext[P]) & {
        __code: P;
    };
}>;
export declare class CodamaError<TErrorCode extends CodamaErrorCode = CodamaErrorCode> extends Error {
    readonly context: CodamaErrorCodedContext[TErrorCode];
    constructor(...[code, contextAndErrorOptions]: CodamaErrorContext[TErrorCode] extends undefined ? [code: TErrorCode, errorOptions?: ErrorOptions | undefined] : [code: TErrorCode, contextAndErrorOptions: CodamaErrorContext[TErrorCode] & (ErrorOptions | undefined)]);
}
export {};
//# sourceMappingURL=error.d.ts.map