import { BigDecimal } from '@subsquid/big-decimal';

export const multiplier = BigInt(1e18);

export const mulDecimal = (a: any, b: any) => {
  return (BigInt(a) * BigInt(b)) / multiplier;
};

export const divDecimal = (a: any, b: any) => {
  return (BigInt(a) * multiplier) / BigInt(b);
};

export const toWei = (amount: any, decimals: any = 0) => {
  return BigInt(
    BigDecimal(amount)
      .mul(10 ** (18 - decimals))
      .toNumber()
  );
};
