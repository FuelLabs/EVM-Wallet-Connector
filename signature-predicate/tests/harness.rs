use fuel_tx::Witness;
use fuels::{
    accounts::predicate::Predicate,
    prelude::*,
    types::{
        transaction_builders::{ScriptTransactionBuilder, TransactionBuilder},
        Bits256, EvmAddress,
    },
};

use ethers_core::{k256::ecdsa::SigningKey, rand::thread_rng};
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

    // TODO: how do I attach a predicate to a Tx?
    let predicate = Predicate::load_from(PREDICATE_BINARY_PATH)
        .unwrap()
        .with_provider(fuel_wallet.provider().unwrap().clone())
        .with_configurables(configurables)
        .with_data(MyPredicateEncoder::encode_data(witness_index));

    // Create the Tx
    let mut tx = ScriptTransactionBuilder::default()
        .set_inputs(wallet_coins)
        .build()
        .unwrap();

    // Now that we have the Tx the ethereum wallet must sign the ID
    let consensus_parameters = fuel_wallet.provider().unwrap().consensus_parameters();
    let tx_id = tx.id(consensus_parameters.chain_id.into());

    let signed_tx = eth_wallet.sign_message(tx_id).await.unwrap();

    // Then we add in the signed data for the witness
    tx.witnesses_mut().push(Witness::from(signed_tx.to_vec()));

    // Execute the Tx
    let response = fuel_wallet
        .provider()
        .unwrap()
        .send_transaction(&tx)
        .await
        .unwrap();
    dbg!(response);

    panic!();
}
