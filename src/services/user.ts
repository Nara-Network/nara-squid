import { Network, User } from '../model';

import { ProcessorContext } from '../common/processor';
import { BigDecimal } from '@subsquid/big-decimal';
import { isTestnet } from '../helpers/common';

async function getUserById(ctx: ProcessorContext, id: string): Promise<User | undefined> {
  return ctx.store.findOne(User, { where: { id, isTestnet: isTestnet(ctx.syncedNetwork) }, relations: { referredBy: true, referredUsers: true, stakingPositions: true, referredUsersPoints: true, portDeposits: true, portWithdrawalRequests: true } });
}

async function getAllUsers(ctx: ProcessorContext): Promise<User[]> {
  return ctx.store.find(User, { where: { isTestnet: isTestnet(ctx.syncedNetwork) }, relations: { referredBy: true, referredUsers: true, stakingPositions: { stakedToken: true }, referredUsersPoints: true, portDeposits: true, portWithdrawalRequests: true } });
}

function logIfUser(message: any, user: User | string) {
  if (typeof user === 'string' && user === '0x5898e09a4ac5798a93ee08356318299e00a7a837') {
    console.log(message);
    // @ts-ignore
  } else if (user?.address === '0x5898e09a4ac5798a93ee08356318299e00a7a837') {
    console.log(message);
  }
}

function getUserId(userAddress: string, network: Network): string {
  return `${userAddress.toLowerCase()}-${isTestnet(network) ? 'TESTNET' : 'MAINNET'}`;
}

async function getAllUsersByAddress(ctx: ProcessorContext, userAddress: string): Promise<User[]> {
  return ctx.store.find(User, { where: { address: userAddress.toLowerCase(), isTestnet: isTestnet(ctx.syncedNetwork) } });
}

async function updateUserTotalBridgeTransfers(ctx: ProcessorContext, userAddress: string, users: Map<string, User>): Promise<Map<string, User>> {
  const userId = getUserId(userAddress, ctx.syncedNetwork);
  let user = users.get(userId) ?? await userService.getUserById(ctx, userId);
  if (!user) {
    user = new User({
      id: userId,
      referredBy: undefined,
      referralCode: undefined,
      referredUsers: [],
      referredUsersPoints: [],
      referralCodePoints: BigDecimal(0),
      totalPoints: BigDecimal(0),
      referralPoints: BigDecimal(0),
      lgePoints: BigDecimal(0),
      tvl: BigDecimal(0),
      leaderboardPosition: 0,
      address: userAddress.toLowerCase(),
      totalBridgeTransfers: BigInt(0),
      isTestnet: isTestnet(ctx.syncedNetwork),
      portWithdrawalRequests: [],
      portDeposits: [],
    });
  }
  user.totalBridgeTransfers += BigInt(1);
  users.set(userId, user);
  return users;
}

export const userService = {
  getUserById,
  getAllUsers,
  logIfUser,
  getUserId,
  updateUserTotalBridgeTransfers
}