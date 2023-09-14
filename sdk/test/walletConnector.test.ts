import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { ethers } from 'hardhat';
import { EVMWalletConnector } from '../src/index';
import {
  FuelWalletConnection,
  FuelWalletLocked,
  FuelWalletProvider
} from '@fuel-wallet/sdk';
import { JsonRpcProvider } from 'ethers';
import { readFileSync } from 'fs';
import { hexlify } from '@ethersproject/bytes';
import {
  InputValue,
  Predicate,
  Address,
  Wallet,
  BaseAssetId,
  FUEL_NETWORK_URL,
  Provider,
  ScriptTransactionRequest
} from 'fuels';
import { generateTestWallet } from '@fuel-ts/wallet/test-utils';

chai.use(chaiAsPromised);

describe('EVM Wallet Connector', () => {
  // Providers used to interact with wallets
  let ethProvider: JsonRpcProvider;
  let fuelProvider: FuelWalletProvider;

  // Our connector bridging MetaMask and predicate accounts
  let connector: EVMWalletConnector;

  // Accounts from hardhat used to determine predicate accounts
  let ethAccount1: string;
  let ethAccount2: string;

  // Predicate accounts associated with the ethereum accounts
  let predicateAccount1: string;
  let predicateAccount2: string;

  async function createPredicate(
    configurables: { [name: string]: unknown } | undefined
  ): Promise<Predicate<InputValue[]>> {
    let filePathBin = '../simple-predicate/out/debug/simple-predicate.bin';
    let filePathABI = '../simple-predicate/out/debug/simple-predicate-abi.json';
    let predicateBinary = hexlify(readFileSync(filePathBin));
    let predicateABI = JSON.parse(readFileSync(filePathABI, 'utf-8'));

    const chainId = await fuelProvider.getChainId();
    const predicate = new Predicate(
      predicateBinary,
      chainId,
      predicateABI,
      fuelProvider,
      configurables
    );

    return predicate;
  }

  before(async () => {
    // Fetch the signing accounts from hardhat
    let signers = await ethers.getSigners();
    ethAccount1 = signers[0]!.address;
    ethAccount2 = signers[1]!.address;

    // Setting the providers once should not cause issues
    // Create the Ethereum provider
    ethProvider = new ethers.JsonRpcProvider('http://localhost:8545');

    // Create the Fuel provider
    let walletConnection = new FuelWalletConnection({
      name: 'EVM-Wallet-Connector'
    });

    // TODO: local fuel provider https://fuellabs.github.io/fuels-ts/guide/testing/
    fuelProvider = new FuelWalletProvider(
      'https://beta-4.fuel.network/graphql',
      walletConnection
    );

    // Create the predicate and calculate the address for each Ethereum account
    let paddedAcc1 = ethAccount1.replace('0x', '0x000000000000000000000000');
    let paddedAcc2 = ethAccount2.replace('0x', '0x000000000000000000000000');

    let configurable1 = { SIGNER: Address.fromB256(paddedAcc1).toEvmAddress() };
    let configurable2 = { SIGNER: Address.fromB256(paddedAcc2).toEvmAddress() };

    let predicate1 = await createPredicate(configurable1);
    let predicate2 = await createPredicate(configurable2);

    predicateAccount1 = predicate1.address.toAddress();
    predicateAccount2 = predicate2.address.toAddress();
  });

  beforeEach(() => {
    // Class contains state, reset the state for each test
    connector = new EVMWalletConnector(ethProvider, fuelProvider);
  });

  // describe('connect()', () => {
  //   it('connects to ethers signer', async () => {
  //     let isNull = connector.ethSigner;
  //     let connected = await connector.connect();
  //     let isNotNull = connector.ethSigner;

  //     expect(isNull).to.be.null;
  //     expect(connected).to.be.true;
  //     expect(isNotNull).to.not.be.null;
  //   });
  // });

  // describe('isConnected()', () => {
  //   it('false when not connected', async () => {
  //     let connected = await connector.isConnected();

  //     expect(connected).to.be.false;
  //   });

  //   it('true when connected', async () => {
  //     await connector.connect();
  //     let connected = await connector.isConnected();

  //     expect(connected).to.be.true;
  //   });
  // });

  // describe('disconnect()', () => {
  //   it('disconnects from ethers signer', async () => {
  //     await connector.connect();

  //     let isNotNull = connector.ethSigner;
  //     let connected = await connector.disconnect();
  //     let isNull = connector.ethSigner;

  //     expect(isNotNull).to.not.be.null;
  //     expect(connected).to.be.true;
  //     expect(isNull).to.be.null;
  //   });
  // });

  // describe('accounts()', () => {
  //   it('returns the predicate accounts associated with the wallet', async () => {
  //     await connector.connect();

  //     let predicateAccounts = await connector.accounts();
  //     let acc1 = predicateAccounts[0];
  //     let acc2 = predicateAccounts[1];

  //     expect(acc1).to.be.equal(predicateAccount1);
  //     expect(acc2).to.be.equal(predicateAccount2);
  //   });
  // });

  // describe('currentAccount()', () => {
  //   it('returns the predicate account associated with the current signer account', async () => {
  //     await connector.connect();

  //     let account = await connector.currentAccount();

  //     expect(account).to.be.equal(predicateAccount1);
  //   });

  //   it('throws error when not connected', async () => {
  //     await expect(connector.currentAccount()).to.be.rejectedWith(
  //       'No connected accounts'
  //     );
  //   });
  // });

  // describe('signMessage()', () => {
  //   it('throws error', async () => {
  //     await expect(
  //       connector.signMessage('address', 'message')
  //     ).to.be.rejectedWith('Not implemented');
  //   });
  // });

  describe('sendTransaction()', () => {
    const assetId =
      '0x0101010101010101010101010101010101010101010101010101010101010101';

    it('sends when signer is not passed in', async () => {
      const provider = new Provider(FUEL_NETWORK_URL);

      const recipientWallet = Wallet.generate();
      console.log("generating wallet");
      const fundingWallet = await generateTestWallet(provider, [
        [5_000, BaseAssetId],
        [5_000, assetId]
      ]);
      console.log("created wallet");

      const amountToTransfer = 1000;

      let paddedAcc = ethAccount1.replace('0x', '0x000000000000000000000000');
      let configurable = { SIGNER: Address.fromB256(paddedAcc).toEvmAddress() };
      let predicate = await createPredicate(configurable);

      // transfer base asset to predicate so it can transfer to receiver
      const tx1 = await fundingWallet.transfer(
        predicate.address,
        amountToTransfer*2,
        assetId
      );
      await tx1.waitForResult();

      // transfer base asset to recipient to pay the fees
      const tx2 = await fundingWallet.transfer(
        recipientWallet.address,
        amountToTransfer*2
      );
      await tx2.waitForResult();

      const request = new ScriptTransactionRequest({
        gasLimit: 1000,
        gasPrice: 1
      });

      // fetch predicate resources to spend
      const predicateResoruces = await predicate.getResourcesToSpend([
        [amountToTransfer, assetId]
      ]);
      const recipientResources = await recipientWallet.getResourcesToSpend([[request.gasLimit, BaseAssetId]]);
      console.log(recipientResources);

      request
        .addResources(recipientResources)
        .addPredicateResources(predicateResoruces, predicate)
        .addCoinOutput(recipientWallet.address, amountToTransfer, assetId);

      // const recipientBaseAssetBefore = await recipientWallet.getBalance();
      // const recipientAssetABefore = await recipientWallet.getBalance(assetId);
      // const predicateAssetABefore = await predicate.getBalance(assetId);

      // call connector
      // await connector.connect();
      // let r = await connector.sendTransaction(request, { url: '' });

      const tx3 = await recipientWallet.sendTransaction(request);
      console.log(tx3);

      await tx3.waitForResult();

      // const recipientBaseAssetAfter = await recipientWallet.getBalance();
      // const recipientAssetAAfter = await recipientWallet.getBalance(assetId);
      // const predicateAssetAAfter = await predicate.getBalance(assetId);
    });
  });

  // describe('assets()', () => {
  //   it('returns an empty array', async () => {
  //     expect(await connector.assets()).to.deep.equal([]);
  //   });
  // });

  // describe('addAsset()', () => {
  //   it('returns false', async () => {
  //     expect(await connector.addAsset({ assetId: '' })).to.be.false;
  //   });
  // });

  // describe('addAssets()', () => {
  //   it('returns false', async () => {
  //     expect(await connector.addAssets([])).to.be.false;
  //   });
  // });

  // describe('getWallet()', () => {
  //   it('returns a predicate wallet', async () => {
  //     let wallet = await connector.getWallet(ethAccount1);

  //     expect(wallet).to.deep.equal(
  //       new FuelWalletLocked(predicateAccount1, fuelProvider)
  //     );
  //   });

  //   it('throws error for invalid address', async () => {
  //     await expect(connector.getWallet('0x123')).to.be.rejectedWith(
  //       'Invalid account'
  //     );
  //   });
  // });

  // describe('getProvider()', () => {
  //   it('returns the fuel provider', async () => {
  //     expect(await connector.getProvider()).to.be.equal(fuelProvider);
  //   });
  // });

  // describe('addAbi()', () => {
  //   it('returns false', async () => {
  //     expect(await connector.addAbi({})).to.be.false;
  //   });
  // });

  // describe('getAbi()', () => {
  //   it('throws error', async () => {
  //     await expect(connector.getAbi('contractId')).to.be.rejectedWith(
  //       'Cannot get contractId ABI for a predicate'
  //     );
  //   });
  // });

  // describe('hasAbi()', () => {
  //   it('returns false', async () => {
  //     expect(await connector.hasAbi('contractId')).to.be.false;
  //   });
  // });

  // describe('network()', () => {
  //   it('returns the fuel network info', async () => {
  //     let network = await connector.network();

  //     expect(network.id).to.be.equal(
  //       (await fuelProvider.getNetwork()).chainId.toString()
  //     );
  //     expect(network.url).to.be.equal(fuelProvider.url);
  //   });
  // });

  // describe('networks()', () => {
  //   it('returns an array of fuel network info', async () => {
  //     let networks = await connector.networks();
  //     let network = networks.pop();

  //     expect(network!.id).to.be.equal(
  //       (await connector.fuelProvider.getNetwork()).chainId.toString()
  //     );
  //     expect(network!.url).to.be.equal(fuelProvider.url);
  //   });
  // });

  // describe('addNetwork()', () => {
  //   it('throws error', async () => {
  //     await expect(
  //       connector.addNetwork({ name: '', url: '' })
  //     ).to.be.rejectedWith('Not implemented');
  //   });
  // });
});
