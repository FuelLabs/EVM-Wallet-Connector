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
import { JsonAbi, TransactionRequestLike, Predicate, Address } from 'fuels';
import { JsonRpcProvider, Signer } from 'ethers';

import { readFileSync } from 'fs';
import { hexlify } from '@ethersproject/bytes';

export class EVMWalletConnector extends FuelWalletConnection {
  ethProvider: JsonRpcProvider;
  fuelProvider: FuelWalletProvider;
  ethSigner: Signer | null;

  predicateBinary = hexlify(
    readFileSync('../simple-predicate/out/debug/simple-predicate.bin')
  );
  predicateABI = JSON.parse(
    readFileSync(
      '../simple-predicate/out/debug/simple-predicate-abi.json',
      'utf-8'
    )
  );

  constructor(ethProvider: JsonRpcProvider, fuelProvider: FuelWalletProvider) {
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
    // Get the ethereum accounts
    let ethAccounts: Array<string> = await this.ethProvider.send(
      'eth_accounts',
      []
    );
    let predicateAccounts: Array<string> = [];

    // Init predicate
    const chainId = await this.fuelProvider.getChainId();

    // For each account set the configurable
    for (let index = 0; index < ethAccounts.length; index++) {
      const configurable = {
        SIGNER: Address.fromB256(
          ethAccounts[index]!.replace('0x', '0x000000000000000000000000')
        ).toEvmAddress()
      };

      const predicate = new Predicate(
        this.predicateBinary,
        chainId,
        this.predicateABI,
        this.fuelProvider,
        configurable
      );
      predicateAccounts.push(predicate.address.toAddress());
    }

    return predicateAccounts;
  }

  async currentAccount(): Promise<string> {
    let ethAccount = await this.ethSigner?.getAddress();

    // Init predicate
    const configurable = {
      SIGNER: Address.fromB256(
        ethAccount!.replace('0x', '0x000000000000000000000000')
      ).toEvmAddress()
    };

    const chainId = await this.fuelProvider.getChainId();
    const predicate = new Predicate(
      this.predicateBinary,
      chainId,
      this.predicateABI,
      this.fuelProvider,
      configurable
    );

    // Get the address of predicate
    let account = predicate.address.toAddress();

    return account;
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

  async getWallet(address: string): Promise<FuelWalletLocked> {
    const provider = await this.getProvider();

    let ethAccounts: Array<string> = await this.ethProvider.send(
      'eth_accounts',
      []
    );

    if (!ethAccounts.includes(address.toLowerCase())) {
      throw Error('Invalid account');
    }

    const configurable = {
      SIGNER: Address.fromB256(
        address.replace('0x', '0x000000000000000000000000')
      ).toEvmAddress()
    };
    const chainId = await this.fuelProvider.getChainId();
    const predicate = new Predicate(
      this.predicateBinary,
      chainId,
      this.predicateABI,
      this.fuelProvider,
      configurable
    );

    return new FuelWalletLocked(predicate.address.toAddress(), provider);
  }

  async getProvider(): Promise<FuelWalletProvider> {
    return this.fuelProvider;
  }

  async addAbi(abiMap: AbiMap): Promise<boolean> {
    console.warn('Cannot add an ABI to a predicate account.');
    return false;
  }

  async getAbi(contractId: string): Promise<JsonAbi> {
    throw Error('Cannot get ABI');
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
