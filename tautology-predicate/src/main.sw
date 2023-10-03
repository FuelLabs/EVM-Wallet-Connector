predicate;

use std::{
    b512::B512,
    constants::ZERO_B256,
    tx::{
        tx_witness_data,
    },
    vm::evm::{
        evm_address::EvmAddress,
    },
};

configurable {
    /// The Ethereum address that signed the transaction.
    SIGNER: EvmAddress = EvmAddress {
        value: ZERO_B256,
    },
}

fn main(witness_index: u64) -> bool {
    let signature: B512 = tx_witness_data(witness_index);

    // We have to include SIGNER somewhere so the compiler doesn't remove the configurable
    if SIGNER.value == signature.bytes[0] {
        return true;
    }

    true
}
