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

use std::ecr::{ec_recover, EcRecoverError};

configurable {
    SIGNER: EvmAddress = EvmAddress {
        value: ZERO_B256,
    },
}

// "\x19Ethereum Signed Message:\n32" converted to hex, contains 00000000 padding at the end
const ETHEREUM_PREFIX = 0x19457468657265756d205369676e6564204d6573736167653a0a333200000000;

fn main(witness_index: u64) -> bool {
    // Retrieve the MetaMask signature from the witness data in the Tx at the specified index
    let signature: B512 = tx_witness_data(witness_index);

    // Hash the Fuel Tx (as the signed message) and attempt to recover the signer from the signature
    let txid = tx_id();

    let result = ec_recover_evm_address(signature, personal_sign_hash(txid));

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

struct SignedData {
    id: b256,
    prefix: b256,
    empty: b256,
}

fn personal_sign_hash(transaction_id: b256) -> b256 {
    let data = SignedData {
        id: transaction_id,
        prefix: ETHEREUM_PREFIX,
        empty: ZERO_B256,
    };

    let data_ptr: u64 = asm(ptr: data.id) { ptr };
    let mut result_buffer = b256::min();
    asm(hash: result_buffer, id_ptr: data.id, end: data_ptr + 28 + 32, prefix_start: data.prefix, len: 32, hash_len: 28 + 32) {
        mcp  end id_ptr len;
        k256 hash prefix_start hash_len;
    }

    result_buffer
}
