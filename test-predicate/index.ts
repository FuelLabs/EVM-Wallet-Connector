import { Wallet as ETHWallet } from "ethers";
import { arrayify, hashMessage } from "ethers/lib/utils";
import { readFileSync } from "fs";
import {
  Predicate,
  Provider,
  ScriptTransactionRequest,
  bn,
  hexlify,
  Wallet as FUELWallet,
  BaseAssetId,
  CoinQuantityLike,
  hashTransaction,
  BN,
  toBytes,
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

  request.updateWitness(0, compact(signature));
  request.witnesses.push('0x');
  request.updateWitness(1, hashMessage(txId));

  console.dir(request.toJSON(), { depth: null });

  const result2 = await provider.sendTransaction(newTx);
  const tx = await result2.waitForResult();

  console.log('receiver account', fuelWalletReceiver.address.toString(), 'balance', (await fuelWalletReceiver.getBalance()).format());
  console.log('predicate', predicate.address.toString(), 'balance', (await predicate.getBalance()).format());
}

main();

function compact(sigString: string): Uint8Array {
const r = sigString.slice(0, 66); // First 64 characters after 0x
const s = '0x' + sigString.slice(66, 130); // Next 64 characters
const v = parseInt(sigString.slice(130, 132), 16); // Last 2 characters
  const shiftedParity = bn(v - 27).shln(255);
  const yParityAndS = shiftedParity.or(bn(s));

  const sig = new Uint8Array(64);
  const sBytes = yParityAndS.toArray('be', 32);
  sig.set(arrayify(r), 0);
  sig.set(sBytes, 32);

  return sig;
}


// This can probably be cleaned up
// fn compact(signature: &Signature) -> [u8; 64] {
//     let shifted_parity = U256::from(signature.v - 27) << 255;

//     let r = signature.r;
//     let y_parity_and_s = shifted_parity | signature.s;

//     let mut sig = [0u8; 64];
//     let mut r_bytes = [0u8; 32];
//     let mut s_bytes = [0u8; 32];
//     r.to_big_endian(&mut r_bytes);
//     y_parity_and_s.to_big_endian(&mut s_bytes);
//     sig[..32].copy_from_slice(&r_bytes);
//     sig[32..64].copy_from_slice(&s_bytes);
//     return sig;
// }
