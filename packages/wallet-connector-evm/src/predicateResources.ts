export const predicates = {
  'verification-predicate': {
    abi: {
  "types": [
    {
      "typeId": 0,
      "type": "b256",
      "components": null,
      "typeParameters": null
    },
    {
      "typeId": 1,
      "type": "bool",
      "components": null,
      "typeParameters": null
    },
    {
      "typeId": 2,
      "type": "struct EvmAddress",
      "components": [
        {
          "name": "value",
          "type": 0,
          "typeArguments": null
        }
      ],
      "typeParameters": null
    },
    {
      "typeId": 3,
      "type": "u64",
      "components": null,
      "typeParameters": null
    }
  ],
  "functions": [
    {
      "inputs": [
        {
          "name": "witness_index",
          "type": 3,
          "typeArguments": null
        }
      ],
      "name": "main",
      "output": {
        "name": "",
        "type": 1,
        "typeArguments": null
      },
      "attributes": null
    }
  ],
  "loggedTypes": [],
  "messagesTypes": [],
  "configurables": [
    {
      "name": "SIGNER",
      "configurableType": {
        "name": "",
        "type": 2,
        "typeArguments": []
      },
      "offset": 1952
    }
  ]
},
    bytecode: base64ToUint8Array('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'),
  },

};

function base64ToUint8Array(base64: string) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (var i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}