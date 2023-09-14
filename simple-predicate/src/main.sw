predicate;

use std::{constants::ZERO_B256, vm::evm::evm_address::EvmAddress};

configurable {
    /// The Ethereum address that signed the transaction.
    SIGNER: EvmAddress = EvmAddress {
        value: ZERO_B256,
    },
}

fn main(signer: EvmAddress) -> bool {
    signer == SIGNER
}