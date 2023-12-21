// External libraries
import {
  BytesLike,
  hexlify,
  arrayify,
  splitSignature
} from '@ethersproject/bytes';
import { hexToBytes } from '@ethereumjs/util';
import memoize from 'memoizee';

import { FuelProviderConfig, Asset, AbiMap } from '@fuel-wallet/types';
import {
  Provider,
  transactionRequestify,
  type TransactionRequestLike,
  JsonAbi,
  Predicate,
  Address,
  hashTransaction,
  InputValue
} from 'fuels';
import {
  FuelConnector,
  Network,
  Version,
  ConnectorMetadata
} from '@fuel-wallet/sdk';

import { EIP1193Provider } from './eip-1193';
import { getPredicateRoot } from './getPredicateRoot';
import { predicates } from './predicateResources';

export class EVMWalletConnectorRefactor extends FuelConnector {
  // @ts-expect-error
  ethProvider: EIP1193Provider;
  // @ts-expect-error
  fuelProvider: Provider;
  private predicate: { abi: any; bytecode: Uint8Array };
  private setupLock: boolean = false;
  private _currentAccount: string | null = null;

  // metadata placeholder
  metadata: ConnectorMetadata = {
    image: '',
    install: {
      action: 'Install',
      description:
        'An EVM wallet is required.',
      link: ''
    }
  };

  constructor() {
    super();
    this.name = 'EVM wallet connector';
    this.predicate = predicates['verification-predicate'];
    this.installed = true;
  }

  /**
   * ============================================================
   * Application communication methods
   * ============================================================
   */

  async getProviders() {
    if (!this.fuelProvider || !this.ethProvider) {
      if (typeof window !== 'undefined') {
        // @ts-expect-error
        this.ethProvider = window.ethereum;
        if (!this.ethProvider) {
          throw new Error('Ethereum provider not found');
        }

        this.fuelProvider = await Provider.create(
          'https://beta-4.fuel.network/graphql'
        );
        if (!this.fuelProvider) {
          throw new Error('Fuel provider not found');
        }
      } else {
        throw new Error('window.ethereum not found');
      }
    }

    return { fuelProvider: this.fuelProvider, ethProvider: this.ethProvider };
  }

  async setup() {
    if (this.setupLock) return;
    this.setupLock = true;
    await this.setupCurrentAccount();
    await this.setupEventBridge();
  }

  async setupEventBridge() {
    const { ethProvider } = await this.getProviders();
    ethProvider.on('accountsChanged', async (accounts) => {
      this.emit('accounts', await this.accounts());
      if (this._currentAccount !== accounts[0]) {
        await this.setupCurrentAccount();
      }
    });
    ethProvider.on('connect', async (arg) => {
      this.emit('connection', await this.isConnected());
    });
    ethProvider.on('disconnect', async (arg) => {
      this.emit('connection', await this.isConnected());
    });
  }

  async setupCurrentAccount() {
      const [currentAccount = null] = await this.accounts();
      this._currentAccount = currentAccount;
      this.emit('currentAccount', currentAccount);
  }

  /**
   * ============================================================
   * Connector methods
   * ============================================================
   */

  async ping(): Promise<boolean> {
    await this.getProviders();
    await this.setup();
    return true;
  }

  async version(): Promise<Version> {
    return { app: '0.0.0', network: '0.0.0' };
  }

  async isConnected(): Promise<boolean> {
    const accounts = await this.accounts();
    return accounts.length > 0;
  }

  async accounts(): Promise<Array<string>> {
    // Get the ethereum accounts
    const { ethProvider, fuelProvider } = await this.getProviders();
    const ethAccounts: Array<string> = await ethProvider.request({
      method: 'eth_accounts'
    });

    const chainId = fuelProvider.getChainId();

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

  async connect(): Promise<boolean> {
    if (!(await this.isConnected())) {
      const { ethProvider } = await this.getProviders();
      await ethProvider.request({
        method: 'wallet_requestPermissions',
        params: [
          {
            eth_accounts: {}
          }
        ]
      });
    }
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<boolean> {
    if (await this.isConnected()) {
      const { ethProvider } = await this.getProviders();
      await ethProvider.request({
        method: 'wallet_revokePermissions',
        params: [
          {
            eth_accounts: {}
          }
        ]
      });
    }
    this.connected = false;
    return true;
  }

  async signMessage(address: string, message: string): Promise<string> {
    throw new Error('A predicate account cannot sign messages');
  }

  async sendTransaction(
    address: string,
    transaction: TransactionRequestLike
  ): Promise<string> {
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    const { ethProvider, fuelProvider } = await this.getProviders();
    const ethAccounts: Array<string> = await ethProvider.request({
      method: 'eth_accounts'
    });
    const chainId = fuelProvider.getChainId();
    const accounts = ethAccounts.map((account) => ({
      ethAccount: account,
      predicateAccount: getPredicateAddress(
        account,
        chainId,
        this.predicate.bytecode,
        this.predicate.abi
      )
    }));

    const account = accounts.find(
      ({ predicateAccount }) => predicateAccount === address
    );
    if (!account) {
      throw Error(`No account found for ${address}`);
    }
    const transactionRequest = transactionRequestify(transaction);

    // Create a predicate and set the witness index to call in predicate`
    const predicate = createPredicate(
      account.ethAccount,
      fuelProvider,
      this.predicate.bytecode,
      this.predicate.abi
    );
    predicate.connect(fuelProvider);
    predicate.setData(transactionRequest.witnesses.length);

    // Attach missing inputs (including estimated predicate gas usage) / outputs to the request
    await predicate.provider.estimateTxDependencies(transactionRequest);

    // To each input of the request, attach the predicate and its data
    const requestWithPredicateAttached =
      predicate.populateTransactionPredicateData(transactionRequest);

    const txID = hashTransaction(requestWithPredicateAttached, chainId);
    const signature = await ethProvider.request({
      method: 'personal_sign',
      params: [txID, account.ethAccount]
    });

    // Transform the signature into compact form for Sway to understand
    const compactSignature = splitSignature(hexToBytes(signature)).compact;

    // We have a witness, attach it to the transaction for inspection / recovery via the predicate
    // TODO: is below comment still relevant?
    // TODO: not that there is a strange witness before we add out compact signature
    //       it is [ 0x ] and we may need to update versions later if / when this is fixed
    transactionRequest.witnesses.push(compactSignature);

    const transactionWithPredicateEstimated =
      await fuelProvider.estimatePredicates(requestWithPredicateAttached);

    const response = await fuelProvider.operations.submit({
      encodedTransaction: hexlify(
        transactionWithPredicateEstimated.toTransactionBytes()
      )
    });

    return response.submit.id;
  }

  async currentAccount(): Promise<string | null> {
    if (!(await this.isConnected())) {
      throw Error('No connected accounts');
    }

    const { ethProvider, fuelProvider } = await this.getProviders();
    const ethAccounts: string[] = await ethProvider.request({
      method: 'eth_accounts'
    });

    if (ethAccounts.length === 0) {
      throw Error('No accounts found');
    }

    // Eth Wallet (MetaMask at least) return the current select account as the first
    // item in the accounts list.
    const fuelAccount = getPredicateAddress(
      ethAccounts[0]!,
      fuelProvider.getChainId(),
      this.predicate.bytecode,
      this.predicate.abi
    );

    return fuelAccount;
  }

  async addAssets(assets: Asset[]): Promise<boolean> {
    console.warn('A predicate account cannot add assets');
    return false;
  }

  async addAsset(asset: Asset): Promise<boolean> {
    console.warn('A predicate account cannot add an asset');
    return false;
  }

  async assets(): Promise<Array<Asset>> {
    // TODO: can get assets at a predicates address? emit warning/throw error if not?
    return [];
  }

  async addNetwork(networkUrl: string): Promise<boolean> {
    console.warn('Cannot add a network');
    return false;
  }

  async selectNetwork(_network: Network): Promise<boolean> {
    // TODO: actually allow selecting networks once mainnet is released?
    console.warn('Cannot select a network');
    return false;
  }

  async networks(): Promise<Network[]> {
    return [await this.currentNetwork()];
  }

  async currentNetwork(): Promise<Network> {
    const { fuelProvider } = await this.getProviders();
    const chainId = fuelProvider.getChainId();
    return { url: fuelProvider.url, chainId: chainId };
  }

  async addAbi(abiMap: AbiMap): Promise<boolean> {
    console.warn('Cannot add an ABI to a predicate account');
    return false;
  }

  async getAbi(contractId: string): Promise<JsonAbi> {
    throw Error('Cannot get contractId ABI for a predicate');
  }

  async hasAbi(contractId: string): Promise<boolean> {
    console.warn('A predicate account cannot have an ABI');
    return false;
  }
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
