# Setup

## Signature verification predicate

The `signature-verification` project needs to be compiled.

Requirement: have `forc` installed.

To compile the predicate run

```bash
cd signature-verification
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

### Running the tests

```bash
cd sdk
pnpm test
```

# Todo

- Implement listener for events such as changing accounts
- When `FuelWalletConnection` is not constrained to the use of `window.ethereum` extend the connector with the connection
- Add infrastructure (CI) to check code formatting and run tests upon pull requests
- Implement into dApp for live integration / demonstration
