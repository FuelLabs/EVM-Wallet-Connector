import {
    Wallet,
    BaseAssetId,
    FUEL_NETWORK_URL,
    Provider,
    WalletUnlocked,
    CoinQuantityLike,
    coinQuantityfy,
    ScriptTransactionRequest
  } from 'fuels';

  import { expect } from 'chai';

describe('demo', () => {
    it('generates a test wallet', async () => {
        const assetIdA = '0x0101010101010101010101010101010101010101010101010101010101010101';
        const provider = new Provider(FUEL_NETWORK_URL);

      const recipientWallet = Wallet.generate({ provider });
      const fundingWallet = new WalletUnlocked('0x01', provider);

      const quantities: CoinQuantityLike[] = [
        {
          amount: 1_000_000,
          assetId: BaseAssetId,
        },
        {
            amount: 1_000_000,
            assetId: assetIdA,
          },
      ];
    
      const request = new ScriptTransactionRequest({
        gasLimit: 10000,
        gasPrice: 1,
      });

      const resources = await fundingWallet.getResourcesToSpend(quantities);
    
      request.addResources(resources);
    
      quantities
        .map(coinQuantityfy)
        .forEach(({ amount, assetId }) => request.addCoinOutput(recipientWallet.address, amount, assetId));

      const response = await fundingWallet.sendTransaction(request);
    
      await response.wait();
    
      const assetBalance = await recipientWallet.getBalance(assetIdA);

      expect(assetBalance).not.equal(0);
    });
});