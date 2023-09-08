use fuel_tx::Witness;
use fuels::{
    accounts::{predicate::Predicate, fuel_crypto::SecretKey},
    prelude::{*},
    types::{
        transaction_builders::{ScriptTransactionBuilder, TransactionBuilder},
        Bits256, EvmAddress,
    }, client::FuelClient,
};
use std::{
    str::FromStr
};

use ethers_core::{
    rand::thread_rng,
    types::{Signature, U256}, utils::hash_message,
};
use ethers_signers::{LocalWallet, Signer as EthSigner};

const PREDICATE_BINARY_PATH: &str = "./out/debug/signature-predicate.bin";

abigen!(Predicate(
    name = "MyPredicate",
    abi = "out/debug/signature-predicate-abi.json"
));

fn convert_eth_address(eth_wallet_address: &[u8]) -> [u8; 32] {
    let mut address: [u8; 32] = [0; 32];
    address[12..].copy_from_slice(eth_wallet_address);
    address
}

#[tokio::test]
async fn testing() {
    // Create fuel wallet
    // let mut wallets =
    //     launch_custom_provider_and_get_wallets(WalletsConfig::default(), None, None).await;
    // let fuel_wallet = wallets.pop().unwrap();
    // let fuel_provider = fuel_wallet.provider().unwrap().clone();
    let fuel_client: FuelClient = FuelClient::new("http://127.0.0.1:4000").unwrap();
    let node_info = fuel_client.chain_info().await.unwrap();
    let consensus_parameters = node_info.consensus_parameters;
    let fuel_provider = Provider::new(fuel_client.clone(), consensus_parameters.clone().into());
    let fuel_wallet = WalletUnlocked::new_from_private_key(
        SecretKey::from_str(
            "0xa449b1ffee0e2205fa924c6740cc48b3b473aa28587df6dab12abc245d1f5298",
        )
        .unwrap(),
        Some(fuel_provider.clone()),
    );

    // Create eth wallet and convert to EVMAddress
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    // let witness_index = 1;
    let configurables = MyPredicateConfigurables::new().set_SIGNER(evm_address);

    // Create a predicate
    let predicate = Predicate::load_from(PREDICATE_BINARY_PATH)
        .unwrap()
        .with_provider(fuel_provider.clone())
        .with_configurables(configurables);

    // Tx params
    let tx_params = TxParameters::new(1, 100_000, 0);

    fuel_wallet
        .transfer(
            &predicate.address().clone(),
            1_000_000,
            AssetId::default(),
            tx_params.clone(),
        )
        .await
        .unwrap();

    // Create a receiver wallet
    let fuel_wallet_receiver = WalletUnlocked::new_random(Some(fuel_provider.clone()));

    // ================================
    // Create a prediucate transfer
    // ================================
    let amount = 1_000;
    let inputs = predicate
        .get_asset_inputs_for_amount(AssetId::default(), amount, None)
        .await.unwrap();
    let outputs = predicate.get_asset_outputs_for_amount(
        fuel_wallet_receiver.address(),
        AssetId::default(),
        amount,
    );
    let tx_builder = ScriptTransactionBuilder::prepare_transfer(inputs, outputs, tx_params.clone())
        .set_consensus_parameters(consensus_parameters.clone().into());
    let mut tx = predicate
        .add_fee_resources(tx_builder, amount, None)
        .await.unwrap();

    // Now that we have the Tx the ethereum wallet must sign the ID
    let tx_id = tx.id(consensus_parameters.chain_id.into());
    // Message signature
    let signature = eth_wallet.sign_message(*tx_id).await.unwrap();
    // Convert into compact format for Sway
    // let signed_tx = compact(&signature);

    // Then we add in the signed data for the witness
    tx.witnesses_mut().clear();
    tx.witnesses_mut().push(Witness::from(signature.to_vec()));
    tx.witnesses_mut().push(Witness::from(hash_message(*tx_id).as_bytes()));

    // Estimate predicates
    tx.estimate_predicates(&consensus_parameters.clone().into()).unwrap();

    println!("{:#?}", tx);

    let receipts = fuel_provider.send_transaction(&tx).await.unwrap();
    println!("{:#?}", receipts);

    // Execute the Tx
    let response = fuel_provider
        .clone()
        .send_transaction(&tx)
        .await
        .unwrap();
    dbg!(response);
}

// This can probably be cleaned up
fn compact(signature: &Signature) -> [u8; 64] {
    let shifted_parity = U256::from(signature.v - 27) << 255;

    let r = signature.r;
    let y_parity_and_s = shifted_parity | signature.s;

    let mut sig = [0u8; 64];
    let mut r_bytes = [0u8; 32];
    let mut s_bytes = [0u8; 32];
    r.to_big_endian(&mut r_bytes);
    y_parity_and_s.to_big_endian(&mut s_bytes);
    sig[..32].copy_from_slice(&r_bytes);
    sig[32..64].copy_from_slice(&s_bytes);
    return sig;
}
