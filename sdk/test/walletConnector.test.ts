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
  bn,
  OutputType,
  InputValue,
  Predicate,
  Address,
  Wallet,
  BaseAssetId,
  FUEL_NETWORK_URL,
  Provider,
  ScriptTransactionRequest,
  WalletUnlocked,
  CoinQuantityLike,
  coinQuantityfy,
  hashTransaction,
  TransactionResponse,
  CoinTransactionRequestOutput,
  Script,
  BigNumberish
} from 'fuels';

chai.use(chaiAsPromised);

describe('EVM Wallet Connector', () => {
  // Providers used to interact with wallets
  let ethProvider: JsonRpcProvider;
  let fuelProvider: Provider;

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
    predicate.setData(1);

    return predicate;
  }

  before(async () => {
    // Fetch the signing accounts from hardhat
    let signers = await ethers.getSigners();
    ethAccount1 = signers[0]!.address;
    ethAccount2 = signers[1]!.address;

    // Setting the providers once should not cause issues
    // Create the Ethereum provider
    ethProvider = new ethers.JsonRpcProvider('http://localhost:8545'); // TODO: switch hardhat node to local node for this?

    // Create the Fuel provider
    fuelProvider = new Provider(FUEL_NETWORK_URL);

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

  describe('connect()', () => {
    it('connects to ethers signer', async () => {
      let isNull = connector.ethSigner;
      let connected = await connector.connect();
      let isNotNull = connector.ethSigner;

      expect(isNull).to.be.null;
      expect(connected).to.be.true;
      expect(isNotNull).to.not.be.null;
    });
  });

  describe('isConnected()', () => {
    it('false when not connected', async () => {
      let connected = await connector.isConnected();

      expect(connected).to.be.false;
    });

    it('true when connected', async () => {
      await connector.connect();
      let connected = await connector.isConnected();

      expect(connected).to.be.true;
    });
  });

  describe('disconnect()', () => {
    it('disconnects from ethers signer', async () => {
      await connector.connect();

      let isNotNull = connector.ethSigner;
      let connected = await connector.disconnect();
      let isNull = connector.ethSigner;

      expect(isNotNull).to.not.be.null;
      expect(connected).to.be.true;
      expect(isNull).to.be.null;
    });
  });

  describe('accounts()', () => {
    it('returns the predicate accounts associated with the wallet', async () => {
      await connector.connect();

      let predicateAccounts = await connector.accounts();
      let acc1 = predicateAccounts[0];
      let acc2 = predicateAccounts[1];

      expect(acc1).to.be.equal(predicateAccount1);
      expect(acc2).to.be.equal(predicateAccount2);
    });
  });

  describe('currentAccount()', () => {
    it('returns the predicate account associated with the current signer account', async () => {
      await connector.connect();

      let account = await connector.currentAccount();

      expect(account).to.be.equal(predicateAccount1);
    });

    it('throws error when not connected', async () => {
      await expect(connector.currentAccount()).to.be.rejectedWith(
        'No connected accounts'
      );
    });
  });

  describe('signMessage()', () => {
    it('throws error', async () => {
      await expect(
        connector.signMessage('address', 'message')
      ).to.be.rejectedWith('Not implemented');
    });
  });

  describe('sendTransaction()', () => {
    const ALT_ASSET_ID =
      '0x0101010101010101010101010101010101010101010101010101010101010101';

    it('sends when signer is not passed in', async () => {
      let paddedAcc = ethAccount1.replace('0x', '0x000000000000000000000000');
      let configurable = { SIGNER: Address.fromB256(paddedAcc).toEvmAddress() };
      let predicate = await createPredicate(configurable);

      const provider = new Provider(FUEL_NETWORK_URL);
      const fundingWallet = new WalletUnlocked('0x01', provider);

      // Transfer base asset coins to predicate
      await fundingWallet
        .transfer(predicate.address, 1_000_000, BaseAssetId, {
          gasLimit: 10000,
          gasPrice: 1
        })
        .then((resp) => resp.wait());
      // Transfer alt asset coins to predicate
      await fundingWallet
        .transfer(predicate.address, 1_000_000, ALT_ASSET_ID, {
          gasLimit: 10000,
          gasPrice: 1
        })
        .then((resp) => resp.wait());

      // Check predicate balances
      const predicateETHBalanceInitial = await predicate.getBalance();
      const predicateAltBalanceInitial =
        await predicate.getBalance(ALT_ASSET_ID);

      // Check predicate has the balance required
      expect(predicateETHBalanceInitial.gte(1000000));
      expect(predicateAltBalanceInitial.gte(1000000));

      // Amount to transfer
      const amountToTransfer = 10;

      // Create a recipient Wallet
      const recipientWallet = Wallet.generate({ provider });
      const recipientBalanceInitial =
        await recipientWallet.getBalance(ALT_ASSET_ID);

      // Create transfer from predicate to recipient
      const request = new ScriptTransactionRequest({
        gasLimit: 10000,
        gasPrice: 1
      });
      request.addCoinOutput(
        recipientWallet.address,
        amountToTransfer,
        ALT_ASSET_ID
      );

      // fund transaction
      const resouces = await predicate.getResourcesToSpend([
        {
          assetId: BaseAssetId,
          amount: bn(1_000_000)
        },
        {
          assetId: ALT_ASSET_ID,
          amount: bn(1_000_000)
        }
      ]);
      // request.setData(scriptABI, [1]);
      request.addResources(resouces);
      // console.log(request.inputs);
      const requestWithEstimatedPredicateGas =
        await predicate.populateTransactionPredicateData(request);

      // Connect ETH account
      await connector.connect();

      // TODO: The user accounts mapping must be populated in order to check if the account is valid
      // Temporary hack here?
      await connector.accounts();

      let scriptBin = hexlify(
        readFileSync('../simple-script/out/debug/simple-script.bin')
      );
      let scriptABI = JSON.parse(
        readFileSync(
          '../simple-script/out/debug/simple-script-abi.json',
          'utf-8'
        )
      );
      const scriptInstance = new Script<BigNumberish[], BigNumberish>(scriptBin, scriptABI, fundingWallet);

      scriptInstance.setConfigurableConstants({
        SIGNER: Address.fromB256(
          ethAccount1.replace('0x', '0x000000000000000000000000')
        ).toEvmAddress()
      });

      const request2 = new ScriptTransactionRequest({
        script: scriptInstance.bytes,
        gasLimit: 10000,
        gasPrice: 1
      });
      request2.setData(scriptABI, [1]);
      request2.addResources(resouces);

      //  Send transaction using EvmWalletConnector
      const transactionId = await connector.sendTransaction(
        request2,
        // requestWithEstimatedPredicateGas,
        {
          url: provider.url
        },
        predicateAccount1,
        scriptInstance
      );
      const response = new TransactionResponse(transactionId, provider);
      const { receipts, gqlTransaction } = await response.waitForResult();
      console.log(receipts);
      // console.log(gqlTransaction.receipts);

      // Check balances are correct
      const predicateAltBalanceFinal = await predicate.getBalance(ALT_ASSET_ID);
      const recipientBalanceFinal =
        await recipientWallet.getBalance(ALT_ASSET_ID);

      expect(predicateAltBalanceFinal.toString()).eq(
        predicateAltBalanceInitial.sub(amountToTransfer).toString()
      );
      expect(recipientBalanceFinal.toString()).eq(
        recipientBalanceInitial.add(amountToTransfer).toString()
      );
    });
  });

  describe('assets()', () => {
    it('returns an empty array', async () => {
      expect(await connector.assets()).to.deep.equal([]);
    });
  });

  describe('addAsset()', () => {
    it('returns false', async () => {
      expect(await connector.addAsset({ assetId: '' })).to.be.false;
    });
  });

  describe('addAssets()', () => {
    it('returns false', async () => {
      expect(await connector.addAssets([])).to.be.false;
    });
  });

  describe('getWallet()', () => {
    it('returns a predicate wallet', async () => {
      let wallet = await connector.getWallet(predicateAccount1);

      let expectedWallet = new FuelWalletLocked(
        predicateAccount1,
        new FuelWalletProvider(
          fuelProvider.url,
          new FuelWalletConnection({
            name: 'EVM-Wallet-Connector'
          })
        )
      );

      expect(wallet.address).to.deep.equal(expectedWallet.address);
      expect(wallet.provider.url).to.equal(expectedWallet.provider.url);
    });

    it('throws error for invalid address', async () => {
      await expect(connector.getWallet('0x123')).to.be.rejectedWith(
        'Invalid account'
      );
    });
  });

  describe('getProvider()', () => {
    it('returns the fuel provider', async () => {
      const walletProvier = new FuelWalletProvider(
        fuelProvider.url,
        new FuelWalletConnection({
          name: 'EVM-Wallet-Connector'
        })
      );

      let connectorProvider = await connector.getProvider();

      expect(connectorProvider.url).to.be.equal(walletProvier.url);
      expect(connectorProvider.walletConnection.connectorName).to.be.equal(
        walletProvier.walletConnection.connectorName
      );
    });
  });

  describe('addAbi()', () => {
    it('returns false', async () => {
      expect(await connector.addAbi({})).to.be.false;
    });
  });

  describe('getAbi()', () => {
    it('throws error', async () => {
      await expect(connector.getAbi('contractId')).to.be.rejectedWith(
        'Cannot get contractId ABI for a predicate'
      );
    });
  });

  describe('hasAbi()', () => {
    it('returns false', async () => {
      expect(await connector.hasAbi('contractId')).to.be.false;
    });
  });

  describe('network()', () => {
    it('returns the fuel network info', async () => {
      let network = await connector.network();

      expect(network.id).to.be.equal(
        (await fuelProvider.getNetwork()).chainId.toString()
      );
      expect(network.url).to.be.equal(fuelProvider.url);
    });
  });

  describe('networks()', () => {
    it('returns an array of fuel network info', async () => {
      let networks = await connector.networks();
      let network = networks.pop();

      expect(network!.id).to.be.equal(
        (await connector.fuelProvider.getNetwork()).chainId.toString()
      );
      expect(network!.url).to.be.equal(fuelProvider.url);
    });
  });

  describe('addNetwork()', () => {
    it('throws error', async () => {
      await expect(
        connector.addNetwork({ name: '', url: '' })
      ).to.be.rejectedWith('Not implemented');
    });
  });
});
