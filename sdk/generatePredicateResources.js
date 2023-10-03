const fs = require('fs');

const predicates = ['simple-predicate', 'tautology-predicate'];

let code = 'export const predicates = {\n';

predicates.forEach((predicate) => {
  const outputDirectory =  `${__dirname}/../${predicate}/out/debug`;
  const abiPath = `${outputDirectory}/${predicate}-abi.json`;
  const bytecodePath = `${outputDirectory}/${predicate}.bin`;

  const abi = fs.readFileSync(abiPath, 'utf8');
  const bytecode = fs.readFileSync(bytecodePath);

  code += `  '${predicate}': {\n`;
  code += `    abi: ${abi},\n`;
  code += `    bytecode: base64ToUint8Array('${bytecode.toString('base64')}'),\n`;
  code += `  },\n`;
});

code += `
};

function base64ToUint8Array(base64: string) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (var i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
`

fs.writeFileSync(`${__dirname}/src/predicateResources.ts`, code);
console.log('Generated');
