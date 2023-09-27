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
  ScriptRequest,
  Interface,
  BigNumberish,
  Script,
  TransactionResponse
} from 'fuels';
import { JsonRpcProvider, Signer } from 'ethers';

import { readFileSync } from 'fs';
import { hexlify, splitSignature } from '@ethersproject/bytes';

import { fromRpcSig, toCompactSig, hexToBytes, bytesToBigInt, bytesToHex, concatBytes, setLengthLeft } from "@ethereumjs/util"

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
    signer?: string,
    script: any
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
    const transactionRequest = transactionRequestify(transaction);

    const configurable = {
      SIGNER: Address.fromB256(
        ethAccount.replace('0x', '0x000000000000000000000000')
      ).toEvmAddress()
    };

    const nextAvailableIndex = transactionRequest.witnesses.length;
    const chainId2 = await this.fuelProvider.getChainId();
    const predicate = new Predicate(
      this.predicateBinary,
      chainId2,
      this.predicateABI,
      this.fuelProvider,
      configurable
    );
    predicate.setData(nextAvailableIndex);

    console.log('predicate address on sdk', predicate.address.toString());
    
    const chainInfo = await this.fuelProvider.getChain();
    const chainId: number = +chainInfo.consensusParameters.chainId;

    // Estimate tx gas and transaction inputs
    await predicate.provider.estimateTxDependencies(transactionRequest);

    // Prepare to sign transaction
    const requestWithEstimatedPredicateGas = await predicate.populateTransactionPredicateData(transactionRequest);
    const txID = hashTransaction(requestWithEstimatedPredicateGas, chainId);
    const signature = await this.ethSigner!.signMessage(hexToBytes(txID));
    // const signature = await this.ethSigner!.signMessage(hexToBytes("0x0000000000000000000000000000000000000000000000000000000000000000"));
    // console.log(signature);
    const thing = splitSignature(hexToBytes(signature));
    const compactSignature = thing.compact;

    // console.log(compactSignature.length / 2);
    // console.log(compactSignature);
    // console.log(hexToBytes(compactSignature));

    // Actual data
    // 0xe82ed51b2b3964a6779171ee6589b1b2f5b5ebb77c1555626205d4619cb8df279a3f5c43f6b0ea3c76d852252d8a19539aa3ca2cb9fb66af3ac4dee7e846b432

    // Ts extracted
    // 0x0000000000000040e82ed51b2b3964a6779171ee6589b1b2f5b5ebb77c1555626205d4619cb8df279a3f5c43f6b0ea3c76d852252d8a19539aa3ca2cb9fb66af

    // 0x0000000000000040e82ed51b2b3964a6779171ee6589b1b2f5b5ebb77c155562
    // 0x6205d4619cb8df279a3f5c43f6b0ea3c76d852252d8a19539aa3ca2cb9fb66af

    // let a = [
    //   232,  46, 213,  27,  43,  57, 100, 166, 119, 145, 113,
    //   238, 101, 137, 177, 178, 245, 181, 235, 183, 124,  21,
    //    85,  98,  98,   5, 212,  97, 156, 184, 223,  39, 154,
    //    63,  92,  67, 246, 176, 234,  60, 118, 216,  82,  37,
    //    45, 138,  25,  83, 154, 163, 202,  44, 185, 251, 102,
    //   175,  58, 196, 222, 231, 232,  70, 180,  50
    // ];
    
    // script.setConfigurableConstants({
    //   SIGNER: Address.fromB256(
    //     ethAccount.replace('0x', '0x000000000000000000000000')
    //   ).toEvmAddress()
    // });
    // const { value, logs } = await script.functions.main(0).call();
    // console.log(value.toString());
    // console.log(logs);

    // transactionRequest.witnesses.push(a);
    // console.log(transactionRequest.witnesses);
    transactionRequest.witnesses.push(compactSignature);
    // transactionRequest.witnesses.push(compactSignature);
    // console.log(transactionRequest.witnesses);
    // transactionRequest.witnesses.push(hexToBytes(compactSignature));

    // 0xe82ed51b2b3964a6779171ee6589b1b2f5b5ebb77c1555626205d4619cb8df279a3f5c43f6b0ea3c76d852252d8a19539aa3ca2cb9fb66af3ac4dee7e846b432
    //   e82ed51b2b3964a6779171ee6589b1b2f5b5ebb77c1555626205d4619cb8df279a3f5c43f6b0ea3c76d852252d8a19539aa3ca2cb9fb66af3ac4dee7e846b432

    // await this.fuelProvider.estimateTxDependencies(transactionRequest);
    
    
    const transactionWithPredicateEstimated = await this.fuelProvider.estimatePredicates(requestWithEstimatedPredicateGas);
    console.dir(transactionWithPredicateEstimated, { depth: null });
    const response = await this.fuelProvider.operations.submit({ 
      encodedTransaction: hexlify(transactionWithPredicateEstimated.toTransactionBytes())
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
