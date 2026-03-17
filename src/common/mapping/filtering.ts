import { Network, Token, } from '../../model';
import { ProcessorContext } from '../processor';
import { toEntityMap } from './helpers';

export async function filterCurrencies(
  currencies: Map<string, Token>,
  ctx: ProcessorContext,
  syncedNetwork: Network
) {
  if (currencies.size == 0) return currencies;

  const dbCurrencies: Map<string, Token> = await ctx.store
    .findBy(Token, { network: syncedNetwork })
    .then(toEntityMap);

  for (const t of dbCurrencies.values()) {
    if (currencies.has(t.id)) {
      currencies.delete(t.id);
    }
  }
  return currencies;
}
