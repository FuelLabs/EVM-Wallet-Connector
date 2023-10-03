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
  Provider,
  InputValue,
} from 'fuels';
import { JsonRpcProvider, Signer } from 'ethers';

import { readFileSync } from 'fs';
import { hexlify, splitSignature } from '@ethersproject/bytes';

import { hexToBytes } from '@ethereumjs/util';

// TODO: FuelWalletConnection requires a window.ethereum provider which should be abstracted away
// export class EVMWalletConnector extends FuelWalletConnection {
export class EVMWalletConnector {
  // TODO: abstract away to use a generic provider over any library
  ethProvider: JsonRpcProvider;

  // Our signer used to interact with the network
  fuelProvider: Provider;

  // TODO: abstract away to generic singer - possibly remove entirely and replace with RPC function
  // Currently connected Ethereum signer
  ethSigner: Signer | null;

  // Map(Ethereum Account => Predicate Account)
  userAccounts: Map<string, string>;

  // TODO: update to remove node functions
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

    // If a (Fuel / predicate) signer has been passed then update the ethers account
    if (signer !== undefined) {
      let validAccount = false;

      for (const [ethAccountKey, predicateAccount] of this.userAccounts) {
        if (signer === predicateAccount) {
          if (ethAccount !== ethAccountKey) {
            this.ethSigner = await this.ethProvider.getSigner(
              ethAccountKey.toLowerCase()
            );
            ethAccount = ethAccountKey;
          }
          validAccount = true;

          break;
        }
      }

      if (!validAccount) {
        throw Error('Invalid account');
      }
    }

    const transactionRequest = transactionRequestify(transaction);

    // Create a predicate and set the witness index to call in `main()`
    const predicate = await createPredicate(
      ethAccount,
      this.fuelProvider,
      this.predicateBinary,
      this.predicateABI
    );
    predicate.setData(transactionRequest.witnesses.length);

    // Attach missing inputs (including estimated predicate gas usage) / outputs to the request
    await predicate.provider.estimateTxDependencies(transactionRequest);

    // To each input of the request, attach the predicate and its data
    const requestWithPredicateAttached =
      predicate.populateTransactionPredicateData(transactionRequest);

    const chainInfo = await this.fuelProvider.getChain();
    const chainId: number = +chainInfo.consensusParameters.chainId;

    const txID = hashTransaction(requestWithPredicateAttached, chainId);
    const signature = await this.ethSigner!.signMessage(hexToBytes(txID));

    // Transform the signature into compact form for Sway to understand
    const compactSignature = splitSignature(hexToBytes(signature)).compact;

    // We have a witness, attach it to the transaction for inspection / recovery via the predicate
    // TODO: not that there is a strange witness before we add out compact signature
    //       it is [ 0x ] and we may need to update versions later if / when this is fixed
    transactionRequest.witnesses.push(compactSignature);

    const transactionWithPredicateEstimated =
      await this.fuelProvider.estimatePredicates(requestWithPredicateAttached);

    const response = await this.fuelProvider.operations.submit({
      encodedTransaction: hexlify(
        transactionWithPredicateEstimated.toTransactionBytes()
      )
    });

    return response.submit.id;
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

    // If the address is not a valid predicate account for this wallet then error
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
  const predicate = await createPredicate(
    ethAddress,
    fuelProvider,
    predicateBinary,
    predicateABI
  );

  return predicate.address.toAddress();
}

async function createPredicate(
  ethAddress: string,
  fuelProvider: Provider,
  predicateBinary: string,
  predicateABI: JsonAbi
): Promise<Predicate<InputValue[]>> {
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

  return predicate;
}
