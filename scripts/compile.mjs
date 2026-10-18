// Compile contracts/*.sol with solc-js into contracts/out/<Name>.json ({ abi, bytecode }).
import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const sources = {};
for (const f of fs.readdirSync('contracts').filter(f => f.endsWith('.sol'))) sources[f] = { content: fs.readFileSync(path.join('contracts', f), 'utf8') };
const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const findImports = p => { try { return { contents: fs.readFileSync(path.join('node_modules', p), 'utf8') }; } catch { return { error: 'not found ' + p }; } };
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errs = (out.errors || []).filter(e => e.severity === 'error');
for (const e of out.errors || []) console[e.severity === 'error' ? 'error' : 'warn'](e.formattedMessage);
if (errs.length) process.exit(1);
fs.mkdirSync('contracts/out', { recursive: true });
for (const [file, cs] of Object.entries(out.contracts)) {
  if (!sources[file]) continue;
  for (const [name, c] of Object.entries(cs)) {
    fs.writeFileSync(`contracts/out/${name}.json`, JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }));
    console.log('compiled', name, (c.evm.bytecode.object.length / 2) + ' bytes');
  }
}
