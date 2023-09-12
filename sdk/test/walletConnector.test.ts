import { assert, expect } from 'chai';
import { ethers } from 'hardhat';
import { EVMWalletConnector } from '../src/index';
import { FuelWalletConnection, FuelWalletProvider } from '@fuel-wallet/sdk';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('EVM Wallet Connector', () => {
  let connector: EVMWalletConnector;
  let account1: HardhatEthersSigner;
  let account2: HardhatEthersSigner;

  before(async () => {
    let signers = await ethers.getSigners();
    account1 = signers.pop();
    account2 = signers.pop();
  });

  beforeEach(() => {
    let ethProvider = new ethers.BrowserProvider(window.ethereum);

    let walletConnection = new FuelWalletConnection({
      name: 'EVM-Wallet-Connector'
    });
    let fuelProvider = new FuelWalletProvider('providerUrl', walletConnection);

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

  xit('accounts()', () => {
    assert.equal(true, false);
  });

  xit('currentAccount()', () => {
    assert.equal(true, false);
  });

  describe('signMessage()', () => {
    it('throws error', async () => {
      expect(await connector.signMessage('address', 'message')).throws(
        'Not Implemented.'
      );
    });
  });

  xit('sendTransaction()', () => {
    assert.equal(true, false);
  });

  describe('assets()', () => {
    it('returns an empty array', async () => {
      expect(await connector.assets()).to.be.equal([]);
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
      let wallet = await connector.getWallet(account1.address);

      expect(wallet).to.be.equal('');
    });

    it('throws error for invalid address', async () => {
      expect(await connector.getWallet('0x123')).throws('Invalid account');
    });
  });

  describe('getProvider()', () => {
    it('returns the fuel provider', async () => {
      let provider = await connector.getProvider();

      expect(provider).to.be.equal(connector.fuelProvider);
    });
  });

  describe('addAbi()', () => {
    it('returns false', async () => {
      expect(await connector.addAbi({})).to.be.false;
    });
  });

  describe('getAbi()', () => {
    it('throws error', async () => {
      expect(await connector.getAbi('contractId')).throws('Cannot get ABI');
    });
  });

  describe('hasAbi()', () => {
    it('returns false', async () => {
      expect(await connector.hasAbi('contractId')).to.be.false;
    });
  });

  xit('network()', () => {
    assert.equal(true, false);
  });

  xit('networks()', () => {
    assert.equal(true, false);
  });

  describe('addNetwork()', () => {
    it('throws error', async () => {
      expect(await connector.addNetwork({ name: '', url: '' })).throws(
        'Not Implemented.'
      );
    });
  });
});
