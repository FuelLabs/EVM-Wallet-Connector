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

  // Currently connected Ethereum signer
  ethSigner: Signer | null;

  // Map(Ethereum Account => Predicate Account)
  userAccounts: Map<string, string>;

  predicateBinary = hexlify(
    readFileSync('../simple-predicate/out/debug/simple-predicate.bin')
  );
  predicateABI = JSON.parse(
    readFileSync(
      '../simple-predicate/out/debug/simple-predicate-abi.json',
      'utf-8'
    )
  );

  constructor(ethProvider: JsonRpcProvider, fuelProvider: Provider) {
    this.ethProvider = ethProvider;
    this.fuelProvider = fuelProvider;
    this.ethSigner = null;
    this.userAccounts = new Map();
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
    this.userAccounts = new Map();
    return true;
  }

  async accounts(): Promise<Array<string>> {
    // Get the ethereum accounts
    const ethAccounts: Array<string> = await this.ethProvider.send(
      'eth_accounts',
      []
    );

    // If the user has not added any accounts then
    // return the previously generated predicate accounts
    if (ethAccounts.length === this.userAccounts.size) {
      return Array.from(this.userAccounts.values());
    }

    // For each ethereum account set the configurable on the predicate and
    // generate the predicate address
    for (let index = 0; index < ethAccounts.length; index++) {
      // If there is a new Ethereum account then add it to our cache
      if (!this.userAccounts.has(ethAccounts[index]!)) {
        const account = await getPredicateAccount(
          ethAccounts[index]!,
          this.fuelProvider,
          this.predicateBinary,
          this.predicateABI
        );

        this.userAccounts.set(ethAccounts[index]!, account);

        // If the number of accounts are equal then we should have them all cached
        if (ethAccounts.length === this.userAccounts.size) {
          break;
        }
      }
    }

    return Array.from(this.userAccounts.values());
  }

  async currentAccount(): Promise<string> {
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    const ethAccount = await this.ethSigner!.getAddress();
    let account: string;

    if (!this.userAccounts.has(ethAccount)) {
      account = await getPredicateAccount(
        ethAccount,
        this.fuelProvider,
        this.predicateBinary,
        this.predicateABI
      );

      this.userAccounts.set(ethAccount, account);
    } else {
      account = this.userAccounts.get(ethAccount)!;
    }

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
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    let ethAccount = await this.ethSigner!.getAddress();

    if (signer !== undefined) {
      let validAccount = false;

      for (const [ethAccountKey, predicateAccount] of this.userAccounts) {
        if (signer === predicateAccount) {
          if (ethAccount !== ethAccountKey) {
            this.ethSigner = await this.ethProvider.getSigner(
              ethAccountKey.toLowerCase()
            );
          }
          ethAccount = ethAccountKey;
          validAccount = true;

          break;
        }
      }

      if (!validAccount) {
        throw Error('Invalid account');
      }
    }
    const chainInfo = await this.fuelProvider.getChain();
    const chainId: number = +chainInfo.consensusParameters.chainId;

    const transactionRequest = transactionRequestify(transaction);
    const txID = hashTransaction(transactionRequest, chainId);

    const signature = await this.ethSigner!.signMessage(txID);

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
    const userAccounts = await this.accounts();

    if (!userAccounts.includes(address)) {
      throw Error('Invalid account');
    }

    const provider = await this.getProvider();

    return new FuelWalletLocked(address, provider);
  }

  async getProvider(): Promise<FuelWalletProvider> {
    const walletProvier = new FuelWalletProvider(
      this.fuelProvider.url,
      new FuelWalletConnection({
        name: 'EVM-Wallet-Connector'
      })
    );
    return walletProvier;
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
    const network = await this.fuelProvider.getNetwork();
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
  fuelProvider: Provider,
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
