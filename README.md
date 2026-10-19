# Game of Chogs

> *When you play the Game of Chogs, you win or you get rugged.*

A Game of Thrones parody for **Chog Genesis** holders on Monad. Every one of the 1,969 Chogs is a scheming noble in one shared realm: **stab, duel, feast, marry, beget heirs, bend the knee** and fight for the **Iron Toilet**. Moves resolve instantly with comic explosions. Every night at 00:00 UTC the richest Chog is crowned, **The Raven** prints the day's gossip, and the realm's state is sealed on-chain.

Built for **Chogathon 2026**.

## Why the Chog NFT is essential

| Lens | How |
|---|---|
| **Key** | Only the wallet that `ownerOf(tokenId)` returns *right now* can play that noble. Ownership is checked live on every move, so a sold Chog stops obeying its old lord at once. |
| **State container** | Clout, titles, scars, shames, spouse, liege and heirs are keyed by the token (never the wallet) and sealed daily to **ChogLedger** on Monad. Bastards and heirs are real ERC-721s whose `tokenURI` is live metadata, so earned titles show up in wallets and marketplaces. |
| **Transferable identity** | Sell your Chog and the buyer inherits its enemies, spouse, heirs, titles and throne claim. Each noble keeps a "Previous Lords" history. |
| **Traits = character** | Stats come from on-chain traits: Cunning from Eyes and Accessory, Might from Body and Base, Charm from Head and Mouth, plus a Tier bonus. The House comes from the Background. A Legendary is a political heavyweight from day one; a Common has the underdog path (+10% to stab anyone in the top 10, because chaos is a ladder). |

**Strip-out test:** remove the NFT and there is no noble, no stats, no House, no save file and no portrait. The game cannot run.

**No Chog?** Claim a **Chog Snow**: a free bastard NFT minted gaslessly by the relayer. It is still an NFT (the rule holds), just a weaker one. Judges on testnet can also grab a **test Chog Genesis** (same ids, art and traits) and play the full holder flow in 30 seconds.

## How to play (30 seconds)

1. Connect a wallet and sign the oath (one free signature, no gas), or claim a bastard (a burner wallet is made if you have none).
2. You have **3 gas 💨 a day**. Click any Chog on the map or in the Court:
   - **STAB 🗡** steals 15% of their clout. Fail and you do the walk of shame (*ding*).
   - **DUEL ⚔** is trial by combat. The winner gets a scar, the loser a bandage.
   - **PROPOSE 💍**: real holders must consent. Married Chogs can **BEGET 🍼** a Chogling NFT that mixes both parents' traits.
   - **BEND THE KNEE 🧎**: your liege gains clout every day, and anyone who stabs you angers them.
   - **FEAST 🍗**: guests bring you clout. If enemies sit at the same table: **Red Wedding**.
3. Grudges last 3 days and give +15% revenge odds. **The Chain remembers.**
4. Come back tomorrow: the coronation, the Raven, new gas, revenge.

Unclaimed Chogs are run by simple rule-based bots (no LLM), so the realm is never quiet and holders come back to "you were stabbed 4 times while you slept".

## Tech

- **Client:** Vite + vanilla JS. The real Chog Genesis art everywhere (hand-drawn doodle portraits are a settings toggle). A canvas map from my earlier project *Royal Ramble*'s Voronoi generator, repainted as a watercolour sticker on a graffiti wall. Comic effects from sprite sheets (`scripts/build-fx.py` packs `assets-src/effects`), with shake, hit-freeze, bounces and fly-offs. Works on phones (tabs and bottom sheets). WebAudio-synthesized farts and shame bell.
- **Server:** Express. One shared world in JSON, mirrored to Upstash Redis. Lazy daily tick plus bots that act through the day. Runs always-on (`npm start`, Docker) or as a single Vercel function: there the world lives in Upstash with a version stamp, every change runs under a short Redis lock, login nonces are self-verifying, and a Vercel Cron closes the day at midnight UTC.
- **Chain (Monad):** `viem`. Ownership of all 1,969 tokens is read with Multicall3. Login is an EIP-191 signature (smart wallets supported via ERC-1271/6492). Contracts:
  - `ChogLedger.sol`: the daily seal (noble records, the Raven's hash, the king)
  - `ChogNobles.sol`: Chog Snow bastards and Chogling heirs (parents recorded on-chain)
  - `MockChogGenesis.sol`: testnet stand-in for judges
- **No LLMs, no paid APIs.** The Raven is stitched from over 400 hand-written template lines.

### Run locally

```bash
npm install
node scripts/fetch-genesis.mjs      # caches all 1,969 trait sets to data/genesis.json (resumable)
node scripts/compile.mjs            # compiles contracts/ → contracts/out/
cp .env.example .env                # set RELAYER_KEY etc.
npm run dev                         # API :8787 + Vite :5180
```

Host it: **Vercel** (`vercel.json`, one project per network with `CHAIN_MODE` = `mainnet` or `testnet`, plus `STORE_PREFIX`, `RELAYER_KEY`, `OPENSEA_API_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN`), or anywhere that runs Docker. Deploy contracts: `TEST_WALLETS=0xYou node scripts/deploy.mjs testnet https://your-url` (or `mainnet`). Addresses go to `data/deployments.json`. For local testing without a Chog, set `DEV_OWNS=0xYourAddr:1,2,3` (ignored on mainnet). `POST /api/dev/tick` skips to tomorrow (disabled on mainnet).

### Pre-existing code (disclosed)

Reused from my own earlier hackathon project *Royal Ramble*: the Voronoi map generator (`shared/mapgen.js`, `shared/rng.js`), the Upstash mirror (`server/store.js`) and small sketch helpers. Fonts and sound effects come from my own asset library (mixkit sounds; graffiti fonts). Everything else was written for Chogathon. Written with the help of AI coding assistants (Claude Code).

## Roadmap

Molandak invasion ("Winter is Chogging") as a server-wide event · $CHOG burns (*a Chog always pays its gas fees*) for extra gas or hiring the Faceless Chog · seasons with a Hall of Legends · cross-collection marriages with other Monanimals.
