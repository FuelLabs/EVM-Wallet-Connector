import type {
  AbiMap,
  Asset,
  FuelEventArg,
  FuelProviderConfig,
  FuelEvents,
  Network,
  FuelWalletConnector
} from '@fuel-wallet/types';
import {
  FuelWalletConnection,
  FuelWalletLocked,
  FuelWalletProvider
} from '@fuel-wallet/sdk';
import { JsonAbi, TransactionRequestLike } from 'fuels';
import { BrowserProvider, Signer } from 'ethers';

class EVMWalletConnector extends FuelWalletConnection {
  provider: BrowserProvider;
  signer: Signer | null;

  constructor(provier: BrowserProvider) {
    super({} as FuelWalletConnector); // TODO: what do I do here?
    this.provider = provier;
    this.signer = null;
  }

  async isConnected(): Promise<boolean> {
    return Promise.resolve(this.signer !== null);
  }

  async connect(): Promise<boolean> {
    this.signer = await this.provider.getSigner();
    return Promise.resolve(true);
  }

  async disconnect(): Promise<boolean> {
    this.signer = null;
    return Promise.resolve(true);
  }

  async accounts(): Promise<Array<string>> {
    if (await this.isConnected()) {
      return []; // TODO
    } else {
      return [];
    }
  }

  async currentAccount(): Promise<string> {
    if (!(await this.isConnected())) {
      throw new Error('Not Connected.');
    }
    return this.signer!.getAddress();
  }

  async signMessage(address: string, message: string): Promise<string> {
    // TODO: fail for now since signature schemes are different
    throw new Error('Not Implemented.');
  }

  async sendTransaction(
    transaction: TransactionRequestLike & { signer?: string },
    providerConfig: FuelProviderConfig,
    signer?: string
  ): Promise<string> {
    return 'Placeholder';
  }

  async assets(): Promise<Array<Asset>> {
    throw new Error('Not Implemented.');
  }

  async addAsset(asset: Asset): Promise<boolean> {
    throw new Error('Not Implemented.');
  }

  async addAssets(assets: Asset[]): Promise<boolean> {
    throw new Error('Not Implemented.');
  }

  async getWallet(): Promise<FuelWalletLocked> {
    return {} as FuelWalletLocked;
  }

  async getProvider(): Promise<BrowserProvider> {
    return Promise.resolve(this.provider);
  }

  async addAbi(abiMap: AbiMap): Promise<boolean> {
    console.warn('Cannot add an ABI.');
    return Promise.resolve(false);
  }

  async getAbi(contractId: string): Promise<JsonAbi> {
    return Promise.resolve({} as JsonAbi);
  }

  async hasAbi(contractId: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  async network(): Promise<FuelProviderConfig> {
    if (await this.isConnected()) {
      let network = await this.provider.getNetwork();
      let config: FuelProviderConfig = { id: network.id, url: network.url };
      return Promise.resolve(config);
    } else {
      return Promise.resolve({} as FuelProviderConfig);
    }
  }

  async networks(): Promise<FuelProviderConfig[]> {
    // TODO: fetch networks

    return {} as FuelProviderConfig[];
  }

  async addNetwork(network: Network): Promise<boolean> {
    // TODO: add network to some place

    return Promise.resolve(true);
  }

  // on<E extends FuelEvents['type'], D extends FuelEventArg<E>>(
  //   eventName: E,
  //   listener: (data: D) => void
  // ): this {
  //   return super.on(eventName, listener);
  // }
}
