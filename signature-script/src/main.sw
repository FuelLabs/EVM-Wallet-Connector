script;

use std::{
    b512::B512,
    constants::ZERO_B256,
    hash::keccak256,
    tx::{
        tx_id,
        tx_witness_data,
    },
    vm::evm::{
        ecr::ec_recover_evm_address,
        evm_address::EvmAddress,
    },
};

configurable {
    SIGNER: EvmAddress = EvmAddress::from(ZERO_B256),
}

fn main(witness_index: u8) -> bool {
    // Retrieve the MetaMask signature from the witness data in the Tx at the specified index
    let signature: B512 = tx_witness_data(witness_index);

    // Hash the Fuel Tx (as the signed message) and attempt to recover the signer from the signature
    let txid = tx_id();
    let result = ec_recover_evm_address(signature, keccak256(txid));
    // let result = ec_recover_evm_address(signature, txid);

    log(signature);
    log(txid);
    log(SIGNER);
    log(result);

    // If the signers match then the predicate has validated the Tx
    if result.is_ok() {
        if SIGNER == result.unwrap() {
            return true;
        }
    }

    // Otherwise, an invalid signature has been passed and we invalidate the Tx
    false
}
