use fuel_tx::Witness;
use fuels::{
    accounts::predicate::Predicate,
    prelude::{Signer, *},
    types::{
        coin_type::CoinType,
        input::Input,
        transaction_builders::{ScriptTransactionBuilder, TransactionBuilder},
        Bits256, EvmAddress,
    },
};

use ethers_core::{k256::ecdsa::SigningKey, rand::thread_rng};
use ethers_signers::{LocalWallet, Signer as EthSigner, Wallet};

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
async fn testing() {
    // Create fuel wallet
    let mut wallets =
        launch_custom_provider_and_get_wallets(WalletsConfig::default(), None, None).await;
    let fuel_wallet = wallets.pop().unwrap();

    // Create eth wallet and convert to EVMAddress
    let eth_wallet = LocalWallet::new(&mut thread_rng());
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));
    dbg!(&evm_address);

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

    let signed_tx = eth_wallet.sign_message(*tx_id).await.unwrap();
    dbg!(&signed_tx.to_vec());
    dbg!(&signed_tx.to_vec().len());

    // Then we add in the signed data for the witness
    tx.witnesses_mut().push(Witness::from(signed_tx.to_vec()));

    // dbg!(&tx);
    dbg!(*tx_id);

    // TODO: predicate fails to validate despite it always returning true so the setup must be incorrect here
    // Execute the Tx
    let receipts = fuel_wallet
        .provider()
        .unwrap()
        .send_transaction(&tx)
        .await
        .unwrap();

    let response = script_call_handler.get_response(receipts).unwrap();
    dbg!(response.value);
    dbg!(response.decode_logs().filter_succeeded());

    // panic!();
}
