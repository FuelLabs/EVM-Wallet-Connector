import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {
  FuelWalletConnection,
  FuelWalletLocked,
  FuelWalletProvider
} from '@fuel-wallet/sdk';
import {
  bn,
  Wallet,
  BaseAssetId,
  Provider,
  ScriptTransactionRequest,
  WalletUnlocked
} from 'fuels';
import { launchNodeAndGetWallets } from '@fuel-ts/wallet/test-utils';
import { MockProvider } from './mockProvider';
import {
  EVMWalletConnector,
  createPredicate,
  getPredicateAddress
} from '../src/index';
import { predicates } from '../src/predicateResources';

chai.use(chaiAsPromised);

const predicate = 'verification-predicate';

describe('EVM Wallet Connector', () => {
  // Providers used to interact with wallets
  let ethProvider: MockProvider;
  let fuelProvider: Provider;

  // Our connector bridging MetaMask and predicate accounts
  let connector: EVMWalletConnector;

  // Accounts from hardhat used to determine predicate accounts
  let ethAccount1: string;
  let ethAccount2: string;

  // Predicate accounts associated with the ethereum accounts
  let predicateAccount1: string;
  let predicateAccount2: string;

  let stopProvider: any;

  const bytecode = predicates[predicate].bytecode;
  const abi = predicates[predicate].abi;

  before(async () => {
    process.env.GENESIS_SECRET =
      '0x6e48a022f9d4ae187bca4e2645abd62198ae294ee484766edbdaadf78160dc68';
    const { stop, provider } = await launchNodeAndGetWallets({
      launchNodeOptions: {
        chainConfigPath: `${__dirname}/chainConfig.json`
      }
    });
    fuelProvider = provider;
    stopProvider = stop;
  });

  after(() => {
    stopProvider && stopProvider();
  });

  beforeEach(async () => {
    // Setting the providers once should not cause issues
    // Create the Ethereum provider
    ethProvider = new MockProvider();

    const accounts = ethProvider.getAccounts();
    const chainId = await fuelProvider.getChainId();

    const predicateAccounts = await Promise.all(
      accounts.map(async (account) =>
        getPredicateAddress(account, chainId, bytecode, abi)
      )
    );

    ethAccount1 = accounts[0]!;
    ethAccount2 = accounts[1]!;

    predicateAccount1 = predicateAccounts[0]!;
    predicateAccount2 = predicateAccounts[1]!;

    // Class contains state, reset the state for each test
    connector = new EVMWalletConnector(ethProvider, fuelProvider);
  });

  afterEach(() => {
    ethProvider.removeAllListeners();
  });

  describe('connect()', () => {
    it('connects to ethers signer', async () => {
      let connected = await connector.connect();

      expect(connected).to.be.true;
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

      let connected = await connector.disconnect();

      expect(connected).to.be.true;
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

    it('transfer when signer is not passed in', async () => {
      let predicate = await createPredicate(
        ethAccount1,
        fuelProvider,
        bytecode,
        abi
      );

      const fundingWallet = new WalletUnlocked('0x01', fuelProvider);

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
      const recipientWallet = Wallet.generate({ provider: fuelProvider });
      const recipientBalanceInitial =
        await recipientWallet.getBalance(ALT_ASSET_ID);

      // Create transfer from predicate to recipient
      const transactionRequest = new ScriptTransactionRequest({
        gasLimit: 10000,
        gasPrice: 1
      });
      transactionRequest.addCoinOutput(
        recipientWallet.address,
        amountToTransfer,
        ALT_ASSET_ID
      );

      // fund transaction
      const resources = await predicate.getResourcesToSpend([
        {
          assetId: BaseAssetId,
          amount: bn(1_000_000)
        },
        {
          assetId: ALT_ASSET_ID,
          amount: bn(1_000_000)
        }
      ]);
      transactionRequest.addResources(resources);

      // Connect ETH account
      await connector.connect();

      // TODO: The user accounts mapping must be populated in order to check if the account is valid
      // Temporary hack here?
      await connector.accounts();

      //  Send transaction using EvmWalletConnector
      await connector.sendTransaction(transactionRequest);

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

    it('transfer when the current signer is passed in', async () => {
      let predicate = await createPredicate(
        ethAccount1,
        fuelProvider,
        bytecode,
        abi
      );

      const fundingWallet = new WalletUnlocked('0x01', fuelProvider);

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
      const recipientWallet = Wallet.generate({ provider: fuelProvider });
      const recipientBalanceInitial =
        await recipientWallet.getBalance(ALT_ASSET_ID);

      // Create transfer from predicate to recipient
      const transactionRequest = new ScriptTransactionRequest({
        gasLimit: 10000,
        gasPrice: 1
      });
      transactionRequest.addCoinOutput(
        recipientWallet.address,
        amountToTransfer,
        ALT_ASSET_ID
      );

      // fund transaction
      const resources = await predicate.getResourcesToSpend([
        {
          assetId: BaseAssetId,
          amount: bn(1_000_000)
        },
        {
          assetId: ALT_ASSET_ID,
          amount: bn(1_000_000)
        }
      ]);
      transactionRequest.addResources(resources);

      // Connect ETH account
      await connector.connect();

      // TODO: The user accounts mapping must be populated in order to check if the account is valid
      // Temporary hack here?
      await connector.accounts();

      //  Send transaction using EvmWalletConnector
      await connector.sendTransaction(
        transactionRequest,
        undefined,
        predicateAccount1
      );

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

    it('transfer when a different valid signer is passed in', async () => {
      let predicate = await createPredicate(
        ethAccount2,
        fuelProvider,
        bytecode,
        abi
      );

      const fundingWallet = new WalletUnlocked('0x01', fuelProvider);

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
      const recipientWallet = Wallet.generate({ provider: fuelProvider });
      const recipientBalanceInitial =
        await recipientWallet.getBalance(ALT_ASSET_ID);

      // Create transfer from predicate to recipient
      const transactionRequest = new ScriptTransactionRequest({
        gasLimit: 10000,
        gasPrice: 1
      });
      transactionRequest.addCoinOutput(
        recipientWallet.address,
        amountToTransfer,
        ALT_ASSET_ID
      );

      // fund transaction
      const resources = await predicate.getResourcesToSpend([
        {
          assetId: BaseAssetId,
          amount: bn(1_000_000)
        },
        {
          assetId: ALT_ASSET_ID,
          amount: bn(1_000_000)
        }
      ]);
      transactionRequest.addResources(resources);

      // Connect ETH account
      await connector.connect();

      // TODO: The user accounts mapping must be populated in order to check if the account is valid
      // Temporary hack here?
      await connector.accounts();

      // Send transaction using EvmWalletConnector
      await connector.sendTransaction(
        transactionRequest,
        undefined,
        predicateAccount2
      );

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

    it('errors when an invalid signer is passed in', async () => {
      let predicate = await createPredicate(
        ethAccount1,
        fuelProvider,
        bytecode,
        abi
      );

      const fundingWallet = new WalletUnlocked('0x01', fuelProvider);

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
      const recipientWallet = Wallet.generate({ provider: fuelProvider });

      // Create transfer from predicate to recipient
      const transactionRequest = new ScriptTransactionRequest({
        gasLimit: 10000,
        gasPrice: 1
      });
      transactionRequest.addCoinOutput(
        recipientWallet.address,
        amountToTransfer,
        ALT_ASSET_ID
      );

      // fund transaction
      const resources = await predicate.getResourcesToSpend([
        {
          assetId: BaseAssetId,
          amount: bn(1_000_000)
        },
        {
          assetId: ALT_ASSET_ID,
          amount: bn(1_000_000)
        }
      ]);
      transactionRequest.addResources(resources);

      // Connect ETH account
      await connector.connect();

      // TODO: The user accounts mapping must be populated in order to check if the account is valid
      // Temporary hack here?
      await connector.accounts();

      await expect(
        connector.sendTransaction(
          transactionRequest,
          undefined,
          predicateAccount2.replaceAll('h', 'X')
        )
      ).to.be.rejectedWith('Invalid account');
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
      await connector.connect();
      let wallet = await connector.getWallet(predicateAccount1);

      let expectedWallet = new FuelWalletLocked(
        predicateAccount1,
        new FuelWalletProvider(
          fuelProvider.url,
          {
            walletConnection: new FuelWalletConnection({
              name: 'EVM-Wallet-Connector'
            })
          }
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
      const walletProvider = new FuelWalletProvider(
        fuelProvider.url,
        {
          walletConnection: new FuelWalletConnection({
            name: 'EVM-Wallet-Connector'
          })
        }
      );

      let connectorProvider = await connector.getProvider();

      expect(connectorProvider.url).to.be.equal(walletProvider.url);
      expect(connectorProvider.walletConnection.connectorName).to.be.equal(
        walletProvider.walletConnection.connectorName
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
