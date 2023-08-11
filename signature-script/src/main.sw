script;

use std::{
    b512::B512,
    constants::ZERO_B256,
    hash::{keccak256, sha256},
    logging::log,
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
    // let signature: B512 = tx_witness_data(witness_index);

    // Hash the Fuel Tx (as the signed message) and attempt to recover the signer from the signature
    let txid = tx_id();
    log(100);
    log(keccak256(txid));
    log(110);
    // let result = ec_recover_evm_address(signature, keccak256(txid));
    let result = ec_recover_evm_address(B512::new(), keccak256(txid));

    // log(signature);
    // log(txid);
    // log(4);
    // log(keccak256(txid));
    // log(5);
    // log(sha256(txid));
    // log(6);
    // log(keccak256(1));
    // log(7);
    // log(SIGNER.value);
    // log(8);
    // log(SIGNER);
    // log(result.unwrap());

    // If the signers match then the predicate has validated the Tx
    if result.is_ok() {
        if SIGNER == result.unwrap() {
            log(1);
            return true;
        } else {
            log(3);
        }
    } else {
        log(2);
    }

    // Otherwise, an invalid signature has been passed and we invalidate the Tx
    false
}
