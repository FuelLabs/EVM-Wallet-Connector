use fuel_tx::Witness;
use fuels::{
    accounts::predicate::Predicate,
    prelude::*,
    types::{
        transaction_builders::{ScriptTransactionBuilder, TransactionBuilder},
        Bits256, EvmAddress,
    },
};

use ethers_core::{
    rand::thread_rng,
    types::{Signature, U256},
};
use ethers_signers::{LocalWallet, Signer as EthSigner};

const PREDICATE_BINARY_PATH: &str = "./out/debug/signature-predicate.bin";

abigen!(Predicate(
    name = "MyPredicate",
    abi = "out/debug/signature-predicate-abi.json"
));

#[tokio::test]
async fn valid_signature_returns_true_for_validating() {
    // Create a Fuel wallet which will fund the predicate
    let fuel_wallet = launch_provider_and_get_wallet().await;
    let provider = fuel_wallet.provider().unwrap();

    // Create an Ethereum wallet and convert to EVMAddress for the predicate configurable
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    let witness_index = 0;
    let configurables = MyPredicateConfigurables::new().with_SIGNER(evm_address);
    let predicate_data = MyPredicateEncoder::encode_data(witness_index);

    let predicate = Predicate::load_from(PREDICATE_BINARY_PATH)
        .unwrap()
        .with_provider(provider.clone())
        .with_data(predicate_data)
        .with_configurables(configurables);

    // Define the quantity and asset that the predicate will contain
    let starting_balance = 100;
    let asset_id = AssetId::default();

    // Define the amount that will be transferred from the predicate to the recipient
    let transfer_amount_to_wallet = 10;

    // Fund the predicate to check the change of balance upon signature recovery
    fuel_wallet
        .transfer(
            &predicate.address().clone(),
            starting_balance,
            asset_id,
            TxParameters::default(),
        )
        .await
        .unwrap();

    // Fetch predicate input in order to have a UTXO with funds for transfer
    let inputs_predicate = predicate
        .get_asset_inputs_for_amount(AssetId::default(), starting_balance)
        .await
        .unwrap();

    // Specify amount to transfer to recipient, send the rest back to the predicate
    let outputs = predicate.get_asset_outputs_for_amount(
        fuel_wallet.address(),
        asset_id,
        transfer_amount_to_wallet,
    );

    // Create the Tx
    let network_info = provider.network_info().await.unwrap();
    let tb = ScriptTransactionBuilder::prepare_transfer(
        inputs_predicate,
        outputs,
        TxParameters::default(),
        network_info.clone(),
    );
    let mut tx = tb.build().unwrap();

    // Now that we have the Tx the Ethereum wallet must sign the ID of the Fuel Tx
    let tx_id = tx.id(network_info.chain_id());

    let signature = eth_wallet.sign_message(*tx_id).await.unwrap();

    // Convert into compact format for Sway
    let signed_tx: [u8; 64] = compact(&signature);

    // Add the signed data as a witness onto the Tx
    tx.append_witness(Witness::from(signed_tx.to_vec()), &network_info)
        .unwrap();

    // Check predicate balance before sending the Tx
    let balance_before = predicate.get_asset_balance(&asset_id).await.unwrap();

    // Execute the Tx
    let tx_id = provider.send_transaction(tx).await.unwrap();
    let _receipts = provider.tx_status(&tx_id).await.unwrap().take_receipts();

    // Check predicate balance after sending the Tx
    let balance_after = predicate.get_asset_balance(&asset_id).await.unwrap();

    assert_eq!(balance_before, starting_balance);
    assert_eq!(balance_after, starting_balance - transfer_amount_to_wallet);
}

#[tokio::test]
async fn invalid_signature_returns_false_for_failed_validation() {
    // Create a Fuel wallet which will fund the predicate
    let fuel_wallet = launch_provider_and_get_wallet().await;
    let provider = fuel_wallet.provider().unwrap();

    // Create an Ethereum wallet and convert to EVMAddress for the predicate configurable
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    let witness_index = 0;
    let configurables = MyPredicateConfigurables::new().with_SIGNER(evm_address);
    let predicate_data = MyPredicateEncoder::encode_data(witness_index);

    let predicate = Predicate::load_from(PREDICATE_BINARY_PATH)
        .unwrap()
        .with_provider(provider.clone())
        .with_data(predicate_data)
        .with_configurables(configurables);

    // Define the quantity and asset that the predicate will contain
    let starting_balance = 100;
    let asset_id = AssetId::default();

    // Define the amount that will be transferred from the predicate to the recipient
    let transfer_amount_to_wallet = 10;

    // Fund the predicate to check the change of balance upon signature recovery
    fuel_wallet
        .transfer(
            &predicate.address().clone(),
            starting_balance,
            asset_id,
            TxParameters::default(),
        )
        .await
        .unwrap();

    // Fetch predicate input in order to have a UTXO with funds for transfer
    let inputs_predicate = predicate
        .get_asset_inputs_for_amount(AssetId::default(), starting_balance)
        .await
        .unwrap();

    // Specify amount to transfer to recipient, send the rest back to the predicate
    let outputs = predicate.get_asset_outputs_for_amount(
        fuel_wallet.address(),
        asset_id,
        transfer_amount_to_wallet,
    );

    // Create the Tx
    let network_info = provider.network_info().await.unwrap();
    let tb = ScriptTransactionBuilder::prepare_transfer(
        inputs_predicate,
        outputs,
        TxParameters::default(),
        network_info.clone(),
    );
    let mut tx = tb.build().unwrap();

    // Now that we have the Tx the Ethereum wallet must sign the ID of the Fuel Tx
    let tx_id = tx.id(network_info.chain_id());

    let signature = eth_wallet.sign_message(*tx_id).await.unwrap();

    // Convert into compact format for Sway
    let mut signed_tx: [u8; 64] = compact(&signature);

    // Invalidate the signature to force a different address to be recovered and thus fail validation
    if signed_tx[0] < 255 {
        signed_tx[0] += 1;
    } else {
        signed_tx[0] -= 1;
    }

    // Add the signed data as a witness onto the Tx
    tx.append_witness(Witness::from(signed_tx.to_vec()), &network_info)
        .unwrap();

    // Execute the Tx, causing a revert because the predicate fails to validate
    let tx_result = provider.send_transaction(tx).await;

    assert!(tx_result.is_err());
}

fn convert_eth_address(eth_wallet_address: &[u8]) -> [u8; 32] {
    let mut address: [u8; 32] = [0; 32];
    address[12..].copy_from_slice(eth_wallet_address);
    address
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

    sig
}
