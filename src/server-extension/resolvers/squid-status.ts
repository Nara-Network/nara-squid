import { Resolver, Arg, Query, Field, ObjectType, registerEnumType } from 'type-graphql';
import { EntityManager } from 'typeorm';
import { Network } from '../../model';
import { squidStoreNames } from '../../common/types';

registerEnumType(Network, {
  name: 'Network',
});

@ObjectType()
export class SquidStatusOutput {
  @Field(() => BigInt, { nullable: false })
  height!: bigint;

  @Field(() => BigInt, { nullable: false })
  hotBlockHeight!: bigint;

  constructor(props: Partial<SquidStatusOutput>) {
    Object.assign(this, props);
  }
}

@Resolver()
export class SquidStatusResolver {
  constructor(private tx: () => Promise<EntityManager>) {}

  @Query(() => SquidStatusOutput)
  async meta(@Arg('network', () => Network) network: Network): Promise<SquidStatusOutput> {
    const manager = await this.tx();
    if (!squidStoreNames[network]) throw 'No processor available';

    let [status, hotBlock] = await manager.query(`
            (SELECT height FROM ${squidStoreNames[network]}.status WHERE id = 0 LIMIT 1) UNION
            (SELECT height FROM ${squidStoreNames[network]}.hot_block ORDER BY height DESC LIMIT 1)
        `);
    return {
      height: status.height,
      hotBlockHeight: hotBlock?.height || 0,
    };
  }
}
