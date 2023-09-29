# Setup

## Predicate

The `simple-predicate` project needs to be compiled.

> Note: this ought to be replaced with the project [Signature Verification](https://github.com/FuelLabs/EVM-Wallet-Connector/pull/1) once the Rust testing issue is resolved.

Requirement: have `forc` installed.

To compile the predicate run

```bash
cd simple-predicate
forc build
```

## Connector

### Installation

From the root of the project change into the `sdk` directory and install the dependencies.

Requirement: have `pnpm` installed.

```bash
cd sdk
pnpm install
```

> Note: There may be remnants of dependencies that are no longer used or ought to be replaced so the `package.json` file must be looked at prior to "production" to prune unnecessary packages

### Preparing to run the tests

Starting nodes.

#### Hardhat

This package is likely to be removed entirely. Until then, it looks like we must start a node ourselves in a terminal because running the test command on its own does not spin up a node in-memory.

Requirement: `npx`, `hardhat`

```bash
cd sdk
npx hardhat node
```

#### Fuel

It looks like the TypeScript SDK has removed the docs for running an in-memory node so we will run it ourselves in another terminal.

Requirements: `fuel-core`

```bash
cd simple-predicate
fuel-core run --db-type in-memory --chain ../sdk/test/chainConfig.json
```

### Running the tests

```bash
cd sdk
pnpm test
```

# Todo

- Replace any `node` dependencies / calls to enable compatibility with the browser and running locally (use a bundler such as `webpack`)
- Replace any library dependencies, such as `ethers.js` (https://viem.sh/ or JSON-RPC?) and `hardhat` (mock EIP-1193 provider?), to generalize the connector
- Implement listener for events such as changing accounts
- When `FuelWalletConnection` is not constrained to the use of `window.ethereum` extend the connector with the connection
- Add infrastructure (CI) to check code formatting and run tests upon pull requests
- Implement into dApp for live integration / demonstration
