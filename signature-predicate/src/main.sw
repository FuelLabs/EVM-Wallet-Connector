predicate;

use std::{
    b512::B512,
    bytes::Bytes,
    constants::ZERO_B256,
    string::String,
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
    /// The Ethereum address that signed the transaction.
    SIGNER: EvmAddress = EvmAddress {
        value: ZERO_B256,
    },
}

fn main() -> bool {
    // Retrieve the Ethereum signature from the witness data in the Tx at the specified index.
    let signature: B512 = tx_witness_data(0);
    let hash_transaction: b256 = tx_witness_data(1);
    // Hash the Fuel Tx (as the signed message) and attempt to recover the signer from the signature.
    let result = ec_recover_evm_address(signature, hash_transaction);

    // If the signers match then the predicate has validated the Tx.
    if result.is_ok() {
        if SIGNER == result.unwrap() {
            return true;
        }
    }

    // Otherwise, an invalid signature has been passed and we invalidate the Tx.
    return false;
}
