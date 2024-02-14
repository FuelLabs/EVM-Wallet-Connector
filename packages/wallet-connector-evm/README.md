# Fuel Wallet Connector for MetaMask

This Connector is part of the effort to enable users to use their current **MetaMask Wallet**,
to sign transactions on Fuel Network.

> **Warning**
> This project is under active development, the current version of the `@fuel-wallet/sdk` is not compatible with the new Connectors.

## 🧑‍💻 Getting Started

### Install

```sh
npm install @fuels/wallet-connector-evm @fuel-wallet/sdk@0.15.2
```

### Using

```ts
import { Fuel, defaultConnectors } from '@fuel-wallet/sdk';
import { EVMWalletConnector } from '@fuels/wallet-connector-evm';

const fuel = new Fuel({
  connectors: [
    // Also show other connectors like Fuel Wallet
    ...defaultConnectors(),
    new EVMWalletConnector()
  ]
});

await fuel.selectConnector('EVM wallet connector');
const connection = await fuel.connect();
console.log(connection);
```

## 📜 License

This repo is licensed under the `Apache-2.0` license. See [`LICENSE`](../../LICENSE) for more information.
