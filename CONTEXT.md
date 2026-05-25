# Nara Squid

This context describes how the squid indexes Nara protocol state across chains for API consumers.

## Language

**Indexed Network**:
A blockchain whose Nara protocol state is processed independently and exposed as its own network in the API.
_Avoid_: folding chain-local data into another chain's network

**BSC**:
The Binance Smart Chain mainnet indexed as its own **Indexed Network** for NaraUSD and NaraUSD+ activity.
_Avoid_: Binance, BNB Chain, Ethereum BSC view

**Ethereum Hub**:
The Ethereum mainnet side of the protocol where reserve, investment, Keyring, and composer state are anchored.
_Avoid_: main chain, canonical chain

**Token-Level Integration**:
An indexing scope limited to chain-local token contracts and their NaraUSD/NaraUSD+ state, without Port vaults or hub backing metrics.
_Avoid_: full protocol integration

**Aggregate Token State**:
Network-level token measurements such as supply and NaraUSD+ exchange rate snapshots, without per-user token activity.
_Avoid_: user activity, bridge activity

**Verified Yield Interface**:
A chain-local NaraUSD+ contract interface confirmed to expose the exchange-rate read needed for APY calculation.
_Avoid_: assuming Ethereum behavior on every chain

**Supply-Only Token State**:
Aggregate token state limited to supply measurements because no chain-local yield interface has been verified.
_Avoid_: zero APY, implied yield

**Metric Availability**:
Whether a metric is populated for an indexed network based on verified chain-local data, without changing the public API shape for each network.
_Avoid_: schema-per-chain, inferred metrics

**BSC-Local Backing Defaults**:
Neutral backing metric values for BSC that avoid implying Ethereum Hub reserve or investment assets live on BSC.
_Avoid_: mirrored hub backing, duplicated reserves

**Buffered Start Block**:
A processor start block placed slightly before the first known contract code block to capture deployment-adjacent activity without broad historical backfill.
_Avoid_: exact deployment block, full-chain backfill

**Deployed Indexed Network**:
An indexed network whose processor runs in the production squid deployment by default.
_Avoid_: local-only network, dormant enum value

## Relationships

- **BSC** is an **Indexed Network** distinct from the **Ethereum Hub**.
- The **Ethereum Hub** owns reserve and backing context that is not duplicated onto **BSC**.
- The first BSC integration is a **Token-Level Integration**.
- The first BSC integration tracks **Aggregate Token State** only.
- BSC APY requires a **Verified Yield Interface** before being exposed.
- BSC currently has **Supply-Only Token State** because its NaraUSD+ contract does not expose the verified exchange-rate reads used for APY.
- BSC uses **Metric Availability** within the existing API shape for the first integration.
- BSC uses **BSC-Local Backing Defaults** instead of mirroring **Ethereum Hub** backing metrics.
- BSC indexing starts from a **Buffered Start Block** at block 99608000.
- BSC is a **Deployed Indexed Network**.

## Example dialogue

> **Dev:** "Should BSC supply be included in the Ethereum network response?"
> **Domain expert:** "No - BSC is its own **Indexed Network**. Ethereum remains the **Ethereum Hub** for reserve and backing context."
>
> **Dev:** "Should BSC include Port vault data?"
> **Domain expert:** "No - the first BSC integration is token-level only because no BSC Port vault addresses are part of the current address source."
>
> **Dev:** "Do BSC bridge transfers become user activity in the API?"
> **Domain expert:** "Not yet - the first BSC slice only exposes **Aggregate Token State**."
>
> **Dev:** "Can BSC reuse Ethereum's NaraUSD+ APY calculation?"
> **Domain expert:** "Only after the BSC NaraUSD+ contract has a **Verified Yield Interface**."
>
> **Dev:** "What should BSC expose after the NaraUSD+ yield reads fail?"
> **Domain expert:** "Expose **Supply-Only Token State** rather than implying a zero or Ethereum-derived APY."
>
> **Dev:** "Should the API schema change to show BSC has fewer metrics?"
> **Domain expert:** "No - use **Metric Availability** within the existing schema for this slice."
>
> **Dev:** "Should BSC show the same backing metrics as Ethereum?"
> **Domain expert:** "No - BSC uses **BSC-Local Backing Defaults** so backing is not misrepresented as chain-local."
>
> **Dev:** "Should BSC start exactly at the first token contract block?"
> **Domain expert:** "No - use a **Buffered Start Block** at 99608000 to include deployment-adjacent activity."
>
> **Dev:** "Should BSC run in production or remain local-only?"
> **Domain expert:** "Run it in production as a **Deployed Indexed Network** so the API does not advertise BSC without data."

## Flagged ambiguities

- "integrate BSC" could mean adding BSC addresses to Ethereum views or indexing BSC independently - resolved: BSC is indexed independently as **BSC**.
- "integrate BSC" could also imply a full protocol deployment with Port vaults and backing metrics - resolved: the first BSC integration is a **Token-Level Integration**.
- "token-level integration" could mean either per-user token movement or aggregate token state - resolved: the first BSC integration tracks **Aggregate Token State** only.
- "BSC APY" could mean reusing Ethereum's NaraUSD+ exchange-rate logic without checking the BSC contract - resolved: expose APY only after a **Verified Yield Interface** is confirmed.
- "no BSC APY" could be represented as zero APY or omitted APY - resolved: BSC has **Supply-Only Token State** until a yield interface exists.
- "metric availability" could require per-network schema changes - resolved: keep the existing API shape for the first BSC integration.
- "BSC backing" could mean Ethereum Hub backing copied onto BSC - resolved: BSC uses **BSC-Local Backing Defaults**.
- "BSC start block" could mean exact first-code block or a buffered block - resolved: use block 99608000 as the **Buffered Start Block**.
- "BSC support" could mean a local-only processor or a deployed processor - resolved: BSC is a **Deployed Indexed Network**.
