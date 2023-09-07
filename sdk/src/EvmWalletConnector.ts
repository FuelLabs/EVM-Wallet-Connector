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
  ethProvider: BrowserProvider;
  fuelProvider: FuelWalletProvider;
  ethSigner: Signer | null;

  constructor(ethProvider: BrowserProvider, fuelProvider: FuelWalletProvider) {
    super({ name: 'EVM-Wallet-Connector' }); // TODO: add icon later
    this.ethProvider = ethProvider;
    this.fuelProvider = fuelProvider;
    this.ethSigner = null;
  }

  async isConnected(): Promise<boolean> {
    return this.ethSigner !== null;
  }

  async connect(): Promise<boolean> {
    this.ethSigner = await this.ethProvider.getSigner();
    return true;
  }

  async disconnect(): Promise<boolean> {
    this.ethSigner = null;
    return true;
  }

  async accounts(): Promise<Array<string>> {
    // get the predicate bytecode, use each address of each account to set the configurable and then calculate each predicate address for this
    // addresses of each predicate

    // Get the ethereum accounts
    let ethAccounts: Array<string> = await this.ethProvider.send(
      'eth_accounts',
      []
    );
    let predicateAccounts: Array<string>;

    // Load the predicate file

    // For each account
    // Init predicate
    // Set the account configurable
    // Get the address of predicate

    return Promise.resolve(ethAccounts);
  }

  async currentAccount(): Promise<string> {
    let ethAccount = this.ethSigner?.getAddress();

    // Load the predicate file
    // Init predicate
    // Set the account configurable
    // Get the address of predicate

    return '';
  }

  async signMessage(address: string, message: string): Promise<string> {
    // Dev: a predicate "account" cannot sign
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
    return [];
  }

  async addAsset(asset: Asset): Promise<boolean> {
    console.warn('A predicate account cannot add an asset.');
    return false;
  }

  async addAssets(assets: Asset[]): Promise<boolean> {
    console.warn('A predicate account cannot add assets.');
    return false;
  }

  async getWallet(): Promise<FuelWalletLocked> {
    // turn instance of predicate into this
    return {} as FuelWalletLocked;
  }

  async getProvider(): Promise<FuelWalletProvider> {
    return this.fuelProvider;
  }

  async addAbi(abiMap: AbiMap): Promise<boolean> {
    console.warn('Cannot add an ABI to a predicate account.');
    return false;
  }

  async getAbi(contractId: string): Promise<JsonAbi | null> {
    return null;
  }

  async hasAbi(contractId: string): Promise<boolean> {
    return false;
  }

  async network(): Promise<FuelProviderConfig> {
    let network = await this.fuelProvider.getNetwork();
    return { id: network.chainId.toString(), url: this.fuelProvider.url };
  }

  async networks(): Promise<FuelProviderConfig[]> {
    return [await this.network()];
  }

  async addNetwork(network: Network): Promise<boolean> {
    throw new Error('Not Implemented.');
  }

  // on<E extends FuelEvents['type'], D extends FuelEventArg<E>>(
  //   eventName: E,
  //   listener: (data: D) => void
  // ): this {
  //   return super.on(eventName, listener);
  // }
}
