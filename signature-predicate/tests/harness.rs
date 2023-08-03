#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(unused_mut)]

use fuel_tx::Witness;
use fuels::{
    accounts::predicate::Predicate,
    prelude::*,
    types::{
        transaction_builders::{ScriptTransactionBuilder, TransactionBuilder},
        Bits256, ContractId, EvmAddress,
    },
};

use ethers::types::Signature;
use ethers_core::{
    k256::{ecdsa::SigningKey, Secp256k1},
    rand::thread_rng,
};
use ethers_signers::{LocalWallet, Signer, Wallet};

const PREDICATE_BINARY_PATH: &str = "./out/debug/signature-predicate.bin";

abigen!(Predicate(
    name = "MyPredicate",
    abi = "out/debug/signature-predicate-abi.json"
));

fn convert_eth_address(eth_wallet: &Wallet<SigningKey>) -> [u8; 32] {
    let mut address: [u8; 32] = [0; 32];
    let ethereum_address = eth_wallet.address().0;
    // TODO: if things are not working consider moving the address to the end
    address[..ethereum_address.len()].copy_from_slice(&ethereum_address);
    address
}

async fn sign_message(wallet: &LocalWallet) -> Signature {
    let message = b"0x0000000000000000000000000000000000000000000000000000000000000000";
    let signature = wallet.sign_message(message).await;

    signature.unwrap()
}

#[tokio::test]
async fn testing() {
    // Create fuel wallet
    let mut wallets =
        launch_custom_provider_and_get_wallets(WalletsConfig::default(), None, None).await;
    let fuel_wallet = wallets.pop().unwrap();

    let wallet_coins = fuel_wallet
        .get_asset_inputs_for_amount(
            AssetId::default(),
            fuel_wallet
                .get_asset_balance(&AssetId::default())
                .await
                .unwrap(),
            None,
        )
        .await
        .unwrap();

    // Create eth wallet and convert to EVMAddress
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    let witness_index = 0;
    let configurables = MyPredicateConfigurables::new().set_SIGNER(evm_address);
    let predicate = Predicate::load_from(PREDICATE_BINARY_PATH)
        .unwrap()
        .with_provider(fuel_wallet.provider().unwrap().clone())
        .with_configurables(configurables)
        .with_data(MyPredicateEncoder::encode_data(witness_index));

    // Create the Tx
    let mut tx = ScriptTransactionBuilder::default()
        .set_inputs(wallet_coins)
        .set_witnesses(vec![Witness::from(vec![witness_index])])
        // .set_script_data(script_data)
        .build()
        .unwrap();

    let consensus_parameters = fuel_wallet.provider().unwrap().consensus_parameters();
    let tx_id = tx.id(consensus_parameters.chain_id.into());
    
    // tx.set_script_data(tx_id);

    // Execute the Tx
    let response = fuel_wallet
        .provider()
        .unwrap()
        .send_transaction(&tx)
        .await
        .unwrap();
    dbg!(response);

    // assert!(result.value);
    assert!(false);

    // 1. Configure SIGNER
    //    Set up a test MetaMask account
    // 2. Craft a Tx which is signed by an Ethereum key
    //    Craft some Tx
    //    Sign it with signature account
    // 3. Add the signature into the witness data
    // 4. Execute the Tx with a witness index which evaluates to `true`
}
