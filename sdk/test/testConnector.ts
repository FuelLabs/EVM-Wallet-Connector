import { Provider } from 'fuels';

import { EVMWalletConnector } from '../src/index';
import { EIP1193Provider } from '../src/eip-1193';

export class testEVMWalletConnector extends EVMWalletConnector {
  constructor(ethProvider: EIP1193Provider, fuelProvider: Provider) {
    super();
    this.ethProvider = ethProvider;
    this.fuelProvider = fuelProvider;
  }

  async getProviders() {
    return { fuelProvider: this.fuelProvider, ethProvider: this.ethProvider };
  }
}
