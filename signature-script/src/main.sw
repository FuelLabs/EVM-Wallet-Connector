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

fn main(witness_index: u64) -> bool {
    // Retrieve the MetaMask signature from the witness data in the Tx at the specified index
    let signature: B512 = tx_witness_data(witness_index);

    // Hash the Fuel Tx (as the signed message) and attempt to recover the signer from the signature
    let txid = tx_id();
    // let result = ec_recover_evm_address(signature, keccak256(txid));
    // let result = ec_recover_evm_address(signature, txid);
    // let result = ec_recover_evm_address(signature, ZERO_B256);

    let formatted_message = eip_191_personal_sign_format(txid);
    let prefixed_message = keccak256((ETHEREUM_PREFIX, formatted_message));

    let result = ec_recover_evm_address(signature, prefixed_message);

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

const EIP191_INITIAL_BYTE = 0x19;
const EIP191_VERSION_BYTE = 0x45;
const ETHEREUM_PREFIX = "\x19Ethereum Signed Message:\n32";

fn eip_191_personal_sign_format(data_to_sign: b256) -> b256 {
    let signed_data = encode_and_pack_signed_data(EIP191_INITIAL_BYTE, EIP191_VERSION_BYTE, data_to_sign);
    let signed_data = (
        signed_data.get(0).unwrap(),
        signed_data.get(1).unwrap(),
        signed_data.get(2).unwrap(),
        signed_data.get(3).unwrap(),
        signed_data.get(4).unwrap(),
    );

    // Keccak256 hash the first 34 bytes of encoded_data
    let mut result_buffer = b256::min();
    asm(hash: result_buffer, ptr: signed_data, bytes: 34) {
        k256 hash ptr bytes;
        hash: b256
    }
}

fn encode_and_pack_signed_data(
    initial_byte: u64,
    version_byte: u64,
    message_hash: b256,
) -> Vec<u64> {
    let mut data = Vec::with_capacity(5);

    let (message_1, message_2, message_3, message_4) = decompose(message_hash);

    data.push((initial_byte << 56) + (version_byte << 48) + (message_1 >> 16));
    data.push((message_1 << 48) + (message_2 >> 16));
    data.push((message_2 << 48) + (message_3 >> 16));
    data.push((message_3 << 48) + (message_4 >> 16));
    data.push(message_4 << 48);

    data
}

fn decompose(value: b256) -> (u64, u64, u64, u64) {
    asm(r1: __addr_of(value)) { r1: (u64, u64, u64, u64) }
}

// ethers rs implementation of hashing the prefix, need to compare more to the code above
// pub fn hash_message<T: AsRef<[u8]>>(message: T) -> H256 {
//     const PREFIX: &str = "\x19Ethereum Signed Message:\n";

//     let message = message.as_ref();
//     let len = message.len();
//     let len_string = len.to_string();

//     let mut eth_message = Vec::with_capacity(PREFIX.len() + len_string.len() + len);
//     eth_message.extend_from_slice(PREFIX.as_bytes());
//     eth_message.extend_from_slice(len_string.as_bytes());
//     eth_message.extend_from_slice(message);

//     H256(keccak256(&eth_message))
// }
