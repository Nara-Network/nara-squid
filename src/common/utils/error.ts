export function throwError(message: string, txHash: string): never {
  throw new Error(`${message} - txHash: ${txHash}`);
}