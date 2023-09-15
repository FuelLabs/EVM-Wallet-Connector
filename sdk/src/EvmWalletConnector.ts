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
import {
  JsonAbi,
  TransactionRequestLike,
  Predicate,
  Address,
  transactionRequestify,
  hashTransaction,
  Provider
} from 'fuels';
import { JsonRpcProvider, Signer } from 'ethers';

import { readFileSync } from 'fs';
import { hexlify } from '@ethersproject/bytes';

// export class EVMWalletConnector extends FuelWalletConnection {
export class EVMWalletConnector {
  ethProvider: JsonRpcProvider;
  fuelProvider: Provider;
  // fuelProvider: FuelWalletProvider;
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

  // constructor(ethProvider: JsonRpcProvider, fuelProvider: FuelWalletProvider) {
    constructor(ethProvider: JsonRpcProvider, fuelProvider: Provider) {
    // super({ name: 'EVM-Wallet-Connector' }); // TODO: add icon later
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

    // For each account set the configurable
    for (let index = 0; index < ethAccounts.length; index++) {
      let account = await getPredicateAccount(
        ethAccounts[index]!,
        this.fuelProvider,
        this.predicateBinary,
        this.predicateABI
      );

      predicateAccounts.push(account);
    }

    return predicateAccounts;
  }

  async currentAccount(): Promise<string> {
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    let ethAccount = await this.ethSigner!.getAddress();
    let account = await getPredicateAccount(
      ethAccount,
      this.fuelProvider,
      this.predicateBinary,
      this.predicateABI
    );

    return account;
  }

  async signMessage(address: string, message: string): Promise<string> {
    // A predicate "account" cannot sign
    throw new Error('Not implemented');
  }

  async sendTransaction(
    transaction: TransactionRequestLike & { signer?: string },
    providerConfig: FuelProviderConfig,
    signer?: string
  ): Promise<string> {
    // transaction: dapp builds script externally and passes it in
    // providerConfig: url of provider to send to
    // signer: which account to use (predicate)

    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    let ethAccount = await this.ethSigner!.getAddress();

    if (signer !== undefined && signer !== ethAccount) {
      this.ethSigner = await this.ethProvider.getSigner(signer!.toLowerCase());
    }

    const transactionRequest = transactionRequestify(transaction);
    const chainId = (
      await this.fuelProvider.getChain()
    ).consensusParameters.chainId.toNumber();
    console.log(chainId);
    const txID = hashTransaction(transactionRequest, chainId);
    console.log(txID);

    const signature = await this.ethSigner!.signMessage(txID);

    // TODO: this may be an issue - testing needed
    transactionRequest.witnesses.push(signature);

    let response = await this.fuelProvider.sendTransaction(transactionRequest);

    return response.id;
  }

  async assets(): Promise<Array<Asset>> {
    return [];
  }

  async addAsset(asset: Asset): Promise<boolean> {
    console.warn('A predicate account cannot add an asset');
    return false;
  }

  async addAssets(assets: Asset[]): Promise<boolean> {
    console.warn('A predicate account cannot add assets');
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

    let account = await getPredicateAccount(
      address,
      this.fuelProvider,
      this.predicateBinary,
      this.predicateABI
    );

    return new FuelWalletLocked(account, provider);
  }

  async getProvider(): Promise<FuelWalletProvider> {
    return this.fuelProvider;
  }

  async addAbi(abiMap: AbiMap): Promise<boolean> {
    console.warn('Cannot add an ABI to a predicate account');
    return false;
  }

  async getAbi(contractId: string): Promise<JsonAbi> {
    throw Error('Cannot get contractId ABI for a predicate');
  }

  async hasAbi(contractId: string): Promise<boolean> {
    return false;
  }

  async network(): Promise<FuelProviderConfig> {
    // TODO: look into chain IDs and raise possible bug issue
    let network = await this.fuelProvider.getNetwork();
    return { id: network.chainId.toString(), url: this.fuelProvider.url };
  }

  async networks(): Promise<FuelProviderConfig[]> {
    return [await this.network()];
  }

  async addNetwork(network: Network): Promise<boolean> {
    throw new Error('Not implemented');
  }

  // on<E extends FuelEvents['type'], D extends FuelEventArg<E>>(
  //   eventName: E,
  //   listener: (data: D) => void
  // ): this {
  //   return super.on(eventName, listener);
  // }
}

async function getPredicateAccount(
  ethAddress: string,
  fuelProvider: FuelWalletProvider,
  predicateBinary: string,
  predicateABI: JsonAbi
): Promise<string> {
  const configurable = {
    SIGNER: Address.fromB256(
      ethAddress.replace('0x', '0x000000000000000000000000')
    ).toEvmAddress()
  };
  const chainId = await fuelProvider.getChainId();
  const predicate = new Predicate(
    predicateBinary,
    chainId,
    predicateABI,
    fuelProvider,
    configurable
  );

  return predicate.address.toAddress();
}
