import {
  FuelProviderConfig
} from '@fuel-wallet/types';
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
  ConnectorMetadata,
  Version
} from '@fuel-wallet/sdk';
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

export class EVMWalletConnectorRefactor extends FuelConnector {
  //TODO better solution to handling 'not definitely initialised'
  // @ts-expect-error
  ethProvider: EIP1193Provider;
  // @ts-expect-error
  fuelProvider: Provider;
  private predicate: { abi: any; bytecode: Uint8Array };
  // readonly client: JSONRPCClient;

  metadata: ConnectorMetadata = {
    image: '/connectors/fuel-wallet.svg',
    install: {
      action: 'Install',
      description:
        'To connect your Fuel Wallet, install the browser extension.',
      link: 'https://chrome.google.com/webstore/detail/fuel-wallet/dldjpboieedgcmpkchcjcbijingjcgok'
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
  private async getProviders() {
    if (this.fuelProvider && this.ethProvider) {
      return {
        fuelProvider: this.fuelProvider,
        ethProvider: this.ethProvider
      };
    }
    if (typeof window !== 'undefined') {
      // @ts-expect-error
      const ethProvider = window.ethereum;
      if (!ethProvider) {
        throw new Error('Ethereum provider not found');
      }
      this.ethProvider = ethProvider;

      const fuelProvider = await Provider.create(
        'https://beta-4.fuel.network/graphql'
      );
      if (!fuelProvider) {
        throw new Error('Fuel provider not found');
      }
      this.fuelProvider = fuelProvider;

      return {
        fuelProvider: this.fuelProvider,
        ethProvider: this.ethProvider
      };
    }
    throw new Error('window.ethereum not found!');
  }

  /**
   * ============================================================
   * Connector methods
   * ============================================================
   */

  async isConnected(): Promise<boolean> {
    try {
      const accounts = await this.accounts();
      console.log('isConnected called', accounts);
      return accounts.length > 0;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    await this.getProviders();
    console.log('ping pong');
    return true;
  }

  async version(): Promise<Version> {
    const ver: Version = {
      app: '0.0.0',
      network: '0.0.0'
    };
    return ver;
  }

  async connect(): Promise<boolean> {
    // Q: How does this ensure connection?
    const { ethProvider } = await this.getProviders();
    await ethProvider.request({ method: 'eth_requestAccounts' });
    this.connected = true;
    return true;
  }

  async accounts(): Promise<Array<string>> {
    // Get the ethereum accounts
    const { ethProvider, fuelProvider } = await this.getProviders();
    const ethAccounts: Array<string> = await ethProvider.request({
      method: 'eth_accounts'
    });
    //
    console.log('ethAccounts', ethAccounts);
    //

    const chainId = fuelProvider.getChainId();
    //
    console.log('chainId', chainId);
    //
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

    const { ethProvider, fuelProvider } = await this.getProviders();
    const ethAccounts: string[] = await ethProvider.request({
      method: 'eth_accounts'
    });

    if (ethAccounts.length === 0) {
      throw Error('No accounts found');
    }

    const fuelAccount = getPredicateAddress(
      ethAccounts[0]!,
      fuelProvider.getChainId(),
      this.predicate.bytecode,
      this.predicate.abi
    );

    return fuelAccount;
  }

  async sendTransaction(
    _address: string,
    transaction: TransactionRequestLike,
    _providerConfig?: FuelProviderConfig,
    signer?: string
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
    const account = signer
      ? accounts.find(({ predicateAccount }) => predicateAccount === signer)
      : accounts[0];

    if (!account) {
      throw Error('Invalid account');
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
    const signature = await this.ethProvider.request({
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

  async currentNetwork(): Promise<Network> {
    const { fuelProvider } = await this.getProviders();
    const chainId = fuelProvider.getChainId();
    return { url: fuelProvider.url, chainId: chainId };
  }

  async networks(): Promise<Network[]> {
    return [await this.currentNetwork()];
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
