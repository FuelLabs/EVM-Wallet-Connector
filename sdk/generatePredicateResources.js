const fs = require('fs');

const outputDirectory =  `${__dirname}/../simple-predicate/out/debug`;
const abiPath = `${outputDirectory}/simple-predicate-abi.json`;
const bytecodePath = `${outputDirectory}/simple-predicate.bin`;

const abi = fs.readFileSync(abiPath, 'utf8');
const bytecode = fs.readFileSync(bytecodePath);

const tsCode = `
function base64ToUint8Array(base64: string) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (var i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const predicateAbi = ${abi};

export const predicateBytecode = base64ToUint8Array('${bytecode.toString('base64')}');
`

fs.writeFileSync(`${__dirname}/src/predicateResources.ts`, tsCode);
console.log('Generated');
