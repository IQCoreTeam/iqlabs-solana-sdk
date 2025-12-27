/**
 * Heavily inspired by @solana/errors.
 * @see https://github.com/anza-xyz/kit/blob/main/packages/errors
 */
import { CodamaErrorCode } from './codes';
export declare function getHumanReadableErrorMessage<TErrorCode extends CodamaErrorCode>(code: TErrorCode, context?: object): string;
export declare function getErrorMessage<TErrorCode extends CodamaErrorCode>(code: TErrorCode, context?: object): string;
//# sourceMappingURL=message-formatter.d.ts.map