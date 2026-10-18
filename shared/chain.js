// Chain constants shared by the server and the browser.
export const GENESIS = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'; // Chog Genesis, 1,969 tokens (ids 1..1969)
export const CHOG_TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777'; // $CHOG
export const MONAD = { id: 143, name: 'Monad', rpc: 'https://rpc.monad.xyz', explorer: 'https://monadscan.com' };
export const MONAD_TESTNET = { id: 10143, name: 'Monad Testnet', rpc: 'https://testnet-rpc.monad.xyz', explorer: 'https://testnet.monadexplorer.com' };
export const SUPPLY = 1969;
export const loginMessage = (address, nonce) => `Game of Chogs\n\nI swear on my Chogs that I am ${address.toLowerCase()}.\nNo gas, no transaction, just an oath.\n\nNonce: ${nonce}`;
