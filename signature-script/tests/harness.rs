use fuel_tx::Witness;
use fuels::{
    prelude::{abigen, launch_custom_provider_and_get_wallets, WalletsConfig},
    types::{transaction::Transaction, Bits256, EvmAddress},
};

use ethers_core::{
    rand::thread_rng,
    types::{Signature, U256},
};
use ethers_signers::{LocalWallet, Signer as EthSigner};

const SCRIPT_BINARY_PATH: &str = "./out/debug/signature-script.bin";

abigen!(Script(
    name = "MyScript",
    abi = "out/debug/signature-script-abi.json"
));

fn convert_eth_address(eth_wallet_address: &[u8]) -> [u8; 32] {
    let mut address: [u8; 32] = [0; 32];
    address[12..].copy_from_slice(eth_wallet_address);
    address
}

#[tokio::test]
async fn valid_signature_returns_true_for_validating() {
    // Create fuel wallet
    let mut wallets =
        launch_custom_provider_and_get_wallets(WalletsConfig::default(), None, None).await;
    let fuel_wallet = wallets.pop().unwrap();

    // Create eth wallet and convert to EVMAddress
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    let witness_index = 1;
    let configurables = MyScriptConfigurables::new().set_SIGNER(evm_address);

    let script_call_handler = MyScript::new(fuel_wallet.clone(), SCRIPT_BINARY_PATH)
        .with_configurables(configurables)
        .main(witness_index);

    let mut tx = script_call_handler.build_tx().await.unwrap();

    // Now that we have the Tx the ethereum wallet must sign the ID
    let consensus_parameters = fuel_wallet.provider().unwrap().consensus_parameters();
    let tx_id = tx.id(consensus_parameters.chain_id.into());

    let signature = eth_wallet.sign_message(*tx_id).await.unwrap();

    // Convert into compact format for Sway
    let signed_tx = compact(&signature);

    // Then we add in the signed data for the witness
    tx.witnesses_mut().push(Witness::from(signed_tx.to_vec()));

    // Execute the Tx
    let receipts = fuel_wallet
        .provider()
        .unwrap()
        .send_transaction(&tx)
        .await
        .unwrap();

    let response = script_call_handler.get_response(receipts).unwrap();

    assert!(response.value);
}

#[tokio::test]
async fn invalid_signature_returns_false_for_failed_validation() {
    // Create fuel wallet
    let mut wallets =
        launch_custom_provider_and_get_wallets(WalletsConfig::default(), None, None).await;
    let fuel_wallet = wallets.pop().unwrap();

    // Create eth wallet and convert to EVMAddress
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    let witness_index = 1;
    let configurables = MyScriptConfigurables::new().set_SIGNER(evm_address);

    let script_call_handler = MyScript::new(fuel_wallet.clone(), SCRIPT_BINARY_PATH)
        .with_configurables(configurables)
        .main(witness_index);

    let mut tx = script_call_handler.build_tx().await.unwrap();

    // Now that we have the Tx the ethereum wallet must sign the ID
    let consensus_parameters = fuel_wallet.provider().unwrap().consensus_parameters();
    let tx_id = tx.id(consensus_parameters.chain_id.into());

    let signature = eth_wallet.sign_message(*tx_id).await.unwrap();

    // Convert into compact format for Sway
    let mut signed_tx = compact(&signature);

    // Invalidate the signature to force a different address to be recovered and thus fail validation
    if signed_tx[0] < 255 {
        signed_tx[0] += 1;
    } else {
        signed_tx[0] -= 1;
    }

    // Then we add in the signed data for the witness
    tx.witnesses_mut().push(Witness::from(signed_tx.to_vec()));

    // Execute the Tx
    let receipts = fuel_wallet
        .provider()
        .unwrap()
        .send_transaction(&tx)
        .await
        .unwrap();

    let response = script_call_handler.get_response(receipts).unwrap();

    assert!(!response.value);
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
