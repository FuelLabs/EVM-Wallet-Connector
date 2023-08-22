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
    let padded_eth_address = convert_eth_address(&eth_wallet.address().0);
    let evm_address = EvmAddress::from(Bits256(padded_eth_address));

    // Create the predicate by setting the signer and pass in the witness argument
    let witness_index = 1;
    let configurables = MyPredicateConfigurables::new().set_SIGNER(evm_address);

    // Create a predicate
    let predicate = Predicate::load_from(PREDICATE_BINARY_PATH)
        .unwrap()
        .with_provider(fuel_wallet.provider().unwrap().clone())
        .with_configurables(configurables);

    fuel_wallet
        .transfer(
            &predicate.address().clone(),
            1,
            AssetId::default(),
            TxParameters::default(),
        )
        .await
        .unwrap();

    // Create input predicate
    let predicate_coin = &fuel_wallet
        .provider()
        .unwrap()
        .get_spendable_resources(ResourceFilter {
            from: predicate.address().clone(),
            asset_id: AssetId::default(),
            amount: 1,
            ..Default::default()
        })
        .await
        .unwrap()[0];

    let input_predicate = match predicate_coin {
        CoinType::Coin(_) => Input::resource_predicate(
            predicate_coin.clone(),
            predicate.code().clone(),
            MyPredicateEncoder::encode_data(witness_index),
        ),
        _ => panic!("Predicate coin resource type does not match"),
    };

    let mut inputs = vec![input_predicate];
    inputs.extend(wallet_coins);

    let consensus_parameters = fuel_wallet.provider().unwrap().consensus_parameters();

    // Create the Tx
    let mut tx = ScriptTransactionBuilder::default()
        .set_inputs(inputs)
        .set_tx_params(TxParameters::default())
        .set_consensus_parameters(consensus_parameters)
        .build()
        .unwrap();
    fuel_wallet.sign_transaction(&mut tx).unwrap();

    // Now that we have the Tx the ethereum wallet must sign the ID
    let tx_id = tx.id(consensus_parameters.chain_id.into());

    let signature = eth_wallet.sign_message(*tx_id).await.unwrap();

    // Convert into compact format for Sway
    let signed_tx = compact(&signature);

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
