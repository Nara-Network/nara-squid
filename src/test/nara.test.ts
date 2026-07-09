import { expect } from 'chai';
import { naraService } from '../services/nara';

describe('naraService.calculateVestingDistributionApr', () => {
  const WAD = 10n ** 18n;

  it('annualizes the current vesting distribution over the staked earning supply', () => {
    const apr = naraService.calculateVestingDistributionApr({
      naraUsdSupply: 1000n * WAD,
      naraUsdPlusTotalAssets: 500n * WAD,
      naraUsdPlusVestingAmount: 10n * WAD,
      naraUsdPlusLastDistributionAt: 1000n,
      naraUsdPlusVestingPeriod: 7n * 24n * 60n * 60n,
      blockTimestamp: 1000 * 1000,
    });

    expect(apr).to.equal(10505n);
  });

  it('returns zero when the snapshot has no active vesting amount', () => {
    const apr = naraService.calculateVestingDistributionApr({
      naraUsdSupply: 1000n * WAD,
      naraUsdPlusTotalAssets: 500n * WAD,
      naraUsdPlusVestingAmount: 0n,
      naraUsdPlusLastDistributionAt: 1000n,
      naraUsdPlusVestingPeriod: 7n * 24n * 60n * 60n,
      blockTimestamp: 1000 * 1000,
    });

    expect(apr).to.equal(0n);
  });
});
