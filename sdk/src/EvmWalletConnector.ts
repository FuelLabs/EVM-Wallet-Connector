import type {
  AbiMap,
  Asset,
  FuelProviderConfig,
  Network
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
  InputValue
} from 'fuels';
import {
  BytesLike,
  hexlify,
  arrayify,
  splitSignature
} from '@ethersproject/bytes';
import { hexToBytes } from '@ethereumjs/util';
import memoize from 'memoizee';

import { EIP1193Provider } from './eip-1193';
import { getPredicateRoot } from './getPredicateRoot';
import { predicates } from './predicateResources';

// export class EVMWalletConnector extends FuelWalletConnection {
export class EVMWalletConnector {
  ethProvider: EIP1193Provider;

  // Our signer used to interact with the network
  fuelProvider: Provider;

  private predicate: { abi: any; bytecode: Uint8Array };

  constructor(
    ethProvider: EIP1193Provider,
    fuelProvider: Provider,
    {
      predicate = 'metamask-predicate'
    }: { predicate?: keyof typeof predicates } = {}
  ) {
    this.ethProvider = ethProvider;
    this.fuelProvider = fuelProvider;

    if (!predicates[predicate]) throw new Error('Invalid predicate');
    this.predicate = predicates[predicate];
  }

  async isConnected(): Promise<boolean> {
    const accounts = await this.accounts();
    return accounts.length > 0;
  }

  async connect(): Promise<boolean> {
    await this.ethProvider.request({ method: 'eth_requestAccounts' });
    return true;
  }

  async disconnect(): Promise<boolean> {
    // TODO: actually disconnect?
    return true;
  }

  async accounts(): Promise<string[]> {
    // Get the ethereum accounts
    const ethAccounts: Array<string> = await this.ethProvider.request({
      method: 'eth_accounts'
    });

    const chainId = await this.fuelProvider.getChainId();
    const accounts = ethAccounts.map((account) =>
      getPredicateAddress(
        account,
        chainId,
        this.predicate.bytecode,
        this.predicate.abi
      )
    );

    return accounts;
  }

  async currentAccount(): Promise<string | null> {
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    const ethAccounts: string[] = await this.ethProvider.request({
      method: 'eth_accounts'
    });

    if (ethAccounts.length === 0) {
      return null;
    }

    const fuelAccount = getPredicateAddress(
      ethAccounts[0]!,
      await this.fuelProvider.getChainId(),
      this.predicate.bytecode,
      this.predicate.abi
    );

    return fuelAccount;
  }

  async signMessage(address: string, message: string): Promise<string> {
    // A predicate "account" cannot sign
    throw new Error('Not implemented');
  }

  async sendTransaction(
    transaction: TransactionRequestLike & { signer?: string },
    _providerConfig?: FuelProviderConfig,
    signer?: string
  ): Promise<string> {
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }
    const ethAccounts: Array<string> = await this.ethProvider.request({
      method: 'eth_accounts'
    });
    const chainId = await this.fuelProvider.getChainId();
    const accounts = ethAccounts.map((account) => ({
      ethAccount: account,
      predicateAccount: getPredicateAddress(
        account,
        chainId,
        this.predicate.bytecode,
        this.predicate.abi
      )
    }));
    const account = signer
      ? accounts.find(({ predicateAccount }) => predicateAccount === signer)
      : accounts[0];

    if (!account) {
      throw Error('Invalid account');
    }

    const transactionRequest = transactionRequestify(transaction);

    // Create a predicate and set the witness index to call in `main()`
    const predicate = createPredicate(
      account.ethAccount,
      this.fuelProvider,
      this.predicate.bytecode,
      this.predicate.abi
    );
    predicate.connect(this.fuelProvider);
    predicate.setData(transactionRequest.witnesses.length);

    // Attach missing inputs (including estimated predicate gas usage) / outputs to the request
    await predicate.provider.estimateTxDependencies(transactionRequest);

    // To each input of the request, attach the predicate and its data
    const requestWithPredicateAttached =
      predicate.populateTransactionPredicateData(transactionRequest);

    const txID = hashTransaction(requestWithPredicateAttached, chainId);
    const signature = await this.ethProvider.request({
      method: 'personal_sign',
      params: [txID, account.ethAccount]
    });

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
    const walletProver = new FuelWalletProvider(
      this.fuelProvider.url,
      {
        walletConnection: new FuelWalletConnection({
          name: 'EVM-Wallet-Connector'
        })
      }
    )
    ;
    return walletProver;
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
    const chainId = await this.fuelProvider.getChainId();
    return { id: chainId.toString(), url: this.fuelProvider.url };
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

export const getPredicateAddress = memoize(
  (
    ethAddress: string,
    chainId: number,
    predicateBytecode: BytesLike,
    predicateAbi: JsonAbi
  ): string => {
    const configurable = {
      SIGNER: Address.fromB256(
        ethAddress.replace('0x', '0x000000000000000000000000')
      ).toEvmAddress()
    };

    // @ts-ignore
    const { predicateBytes } = Predicate.processPredicateData(
      predicateBytecode,
      predicateAbi,
      configurable
    );
    const address = Address.fromB256(getPredicateRoot(predicateBytes, chainId));
    return address.toString();
  }
);

export const createPredicate = memoize(function createPredicate(
  ethAddress: string,
  provider: Provider,
  predicateBytecode: BytesLike,
  predicateAbi: JsonAbi
): Predicate<InputValue[]> {
  const configurable = {
    SIGNER: Address.fromB256(
      ethAddress.replace('0x', '0x000000000000000000000000')
    ).toEvmAddress()
  };

  const predicate = new Predicate(
    arrayify(predicateBytecode),
    provider,
    predicateAbi,
    configurable
  );

  return predicate;
});
