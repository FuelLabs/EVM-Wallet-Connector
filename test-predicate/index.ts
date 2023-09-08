import { Wallet as ETHWallet, Signer, ethers } from "ethers";
import { recoverAddress, hashMessage, toUtf8Bytes, formatBytes32String } from "ethers/lib/utils";
import { readFileSync } from "fs";
import {
  Predicate,
  Provider,
  ScriptTransactionRequest,
  bn,
  hexlify,
  Wallet as FUELWallet,
  BaseAssetId,
  Address,
  CoinQuantityLike,
  U64Coder,
  hashTransaction,
  BN,
} from "fuels";
import { join } from "path";

async function main() {
  const ethWallet = ETHWallet.createRandom();
  const predicateBin = hexlify(
    readFileSync(
      join(
        __dirname,
        "../signature-predicate/out/debug/signature-predicate.bin"
      )
    )
  );
  const predicateAbi = JSON.parse(
    readFileSync(
      join(
        __dirname,
        "../signature-predicate/out/debug/signature-predicate-abi.json"
      )
    ).toString()
  );
  const provider = new Provider("http://127.0.0.1:4000/graphql");
  const fuelWallet = FUELWallet.fromPrivateKey(
    "0xa449b1ffee0e2205fa924c6740cc48b3b473aa28587df6dab12abc245d1f5298",
    provider
  );
  const fuelWalletReceiver = FUELWallet.generate({ provider });

  console.log('receiver account', fuelWalletReceiver.address.toString(), 'balance', (await fuelWalletReceiver.getBalance()).format());

  const predicate = new Predicate(predicateBin, 0, predicateAbi, provider, {
    SIGNER: {
      value: `0x000000000000000000000000${ethWallet.address
        .toString()
        .replace("0x", "")}`,
    },
  });
  predicate.setData(0);

  const result = await fuelWallet.transfer(
    predicate.address,
    bn(1_000_000_000),
    BaseAssetId,
    {
      gasPrice: 1,
    }
  );
  await result.wait();

  console.log('predicate', predicate.address.toString(), 'balance', (await predicate.getBalance()).format());

  const assetId = BaseAssetId;
  const amount = bn(1_000);
  const request = new ScriptTransactionRequest({
    gasLimit: 100000,
    gasPrice: 1,
  });
  request.addCoinOutput(fuelWalletReceiver.address, amount, assetId);
  const fee = request.calculateFee();
  let quantities: CoinQuantityLike[] = [];

  if (fee.assetId === hexlify(assetId)) {
    fee.amount = fee.amount.add(amount);
    quantities = [fee];
  } else {
    quantities = [[amount, assetId], fee];
  }

  const resources = await predicate.getResourcesToSpend(quantities);
  request.addResources(resources);
  predicate.populateTransactionPredicateData(request);
  const newTx = await provider.estimatePredicates(request);
  const txId = hashTransaction(newTx, 0);
  const signature = await ethWallet.signMessage(txId);

  request.updateWitness(0, signature);
  request.witnesses.push('0x');
  request.updateWitness(1, hashMessage(txId));

  const result2 = await provider.sendTransaction(newTx);
  const tx = await result2.waitForResult();

  console.log('receiver account', fuelWalletReceiver.address.toString(), 'balance', (await fuelWalletReceiver.getBalance()).format());
  console.log('predicate', predicate.address.toString(), 'balance', (await predicate.getBalance()).format());
}

main();
