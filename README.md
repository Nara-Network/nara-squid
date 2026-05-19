# Squid Protocol

## Local development

1. Copy [`.env.example`](.env.example) to `.env` and fill in the required values.
2. Configure the target network in [`src/config.json`](src/config.json).
3. Start PostgreSQL:

   ```
   docker compose up -d
   ```

4. Run the processor for your target network (builds, migrates, and starts indexing):

   - **Mainnet:** `npm run squid:ethereum`
   - **Sepolia:** `npm run squid:ethereumSepolia`

5. Start the GraphQL API in a separate terminal:

   ```
   sqd serve
   ```

   Playground: http://localhost:4000/graphql

## Deploying to SQD Cloud

Deployments are automated with the [Deploy Squid](.github/workflows/deploy_squid.yaml) GitHub Actions workflow.

### Prerequisites

- Add a `SQUID_AUTH_TOKEN` repository secret with a valid [Subsquid Cloud](https://app.subsquid.io/) auth token.

### Deploy via GitHub Actions

1. Open **Actions** → **Deploy Squid** → **Run workflow**.
2. Under **Use workflow from**, pick the branch that contains this workflow (any branch is fine).
3. Set the inputs:
   - **branch** — branch to checkout, build, and deploy (default: `main`). Set this to a feature branch name to deploy code that is not on `main`.
   - **version** — deployment slot passed to `sqd deploy -s` (e.g. `0-1-3`).
4. Run the workflow.

The workflow checks out the selected branch, builds the project, and deploys to the **holdex** organization as **nara-squid**:

```
sqd deploy . -o holdex -n nara-squid -s <slot> --allow-manifest-override --no-interactive --allow-update
```

### Deploy locally

With the Subsquid CLI authenticated (`sqd auth`):

```
npx sqd deploy . -o holdex -n nara-squid -s <slot> --allow-manifest-override --no-interactive --allow-update
```

Replace `<slot>` with the target deployment slot.

