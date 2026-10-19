# Game of Chogs: Chogathon 2026 submission guide

Everything needed to fill in the six submission fields, ready to paste. Items marked **[YOU]** need your input.

## Before you submit

- [ ] **[YOU]** Fill in the team members and the Discord and X handles in field 01.
- [ ] **[YOU]** Record your voice-over on top of the demo video (`_ref/reel/game-of-chogs-demo-v2.mp4`). The subtitles are the script, and the full script is at the bottom of this file. Upload the video (YouTube unlisted works) and paste the link in field 04.
- [ ] **[YOU]** Optional: fund the relayer `0x3013b0F162f2fC0770f070f44715Ee4a84881e41` with about 3 MON. I then run `node scripts/deploy.mjs mainnet https://game-of-chogs.vercel.app` and push, so bastard and heir NFTs and the daily seal also go live on mainnet. Until then the mainnet site plays fully, but those mints only happen on testnet.
- [ ] Open both links once in a private window to make sure they load: https://game-of-chogs.vercel.app and https://game-of-chogs-testnet.vercel.app
- [ ] Optional: use `launch/cover.png` as the cover or thumbnail image.

---

## 01 · Your project

- **Project name:** Game of Chogs
- **Tagline:** *When you play the Game of Chogs, you win or you get rugged.*
- **Team members:** **[YOU]**
- **Discord:** **[YOU]**
- **X:** **[YOU]**

## 02 · What you built

> Game of Chogs is a Game of Thrones parody where every one of the 1,969 Chog Genesis NFTs is a scheming noble in one shared realm on Monad. You get 3 gas a day to stab, duel, propose, feast, bend the knee or beget heirs. Every move resolves on the spot with a comic explosion. Win and a title like *Kingslayer* is stamped on your Chog. Fail and you do the walk of shame while the whole realm hears the bell.
>
> Every midnight UTC the richest Chog is crowned on the Iron Toilet. *The Raven*, a gossip paper, prints the day's stabbings, weddings and betrayals, and the state of the realm is sealed on-chain.
>
> **What's new:** the NFT isn't a profile picture you show off. It's a living character with a political career. Its record (titles, scars, spouse, liege, heirs, grudges) belongs to the token, so a Chog's history follows it across sales. Unclaimed Chogs are played by simple rule-based bots, so the realm is busy from day one, and you come back to "you were stabbed 4 times while you slept". There are no LLMs: the Raven is stitched from over 400 hand-written comedy lines.

## 03 · Why Chog matters

> Remove the Chog NFT and there is no game: no noble, no stats, no House, no save file and no portrait.
>
> - **Key:** only the wallet that `ownerOf(tokenId)` returns right now can play that noble. Ownership is checked live on every move, so a sold Chog stops obeying its old lord at once.
> - **Stats from traits:** Cunning comes from Eyes and Accessory, Might from Body and Base, Charm from Head and Mouth, plus a Tier bonus. The Background trait picks the House. A Legendary is a political heavyweight from day one, and a Common gets the underdog bonus.
> - **State container:** clout, titles, scars, spouse, liege and heirs are keyed by the token, not the wallet, and sealed every day to the ChogLedger contract on Monad.
> - **Transferable identity:** sell your Chog and the buyer inherits its enemies, spouse, heirs, titles and throne claim. Each noble keeps a list of its previous lords.
> - **NFTs make NFTs:** married Chogs can beget a *Chogling*, a real ERC-721 heir that records both parents on-chain. Players without a Chog can claim a free *bastard* NFT, minted gaslessly. Their `tokenURI` metadata is live, so earned titles show up in wallets and marketplaces.

## 04 · Show it working

- **Live game (mainnet, real Chog Genesis):** https://game-of-chogs.vercel.app
- **Judge mirror (Monad testnet, free test Chog):** https://game-of-chogs-testnet.vercel.app
- **Demo video (up to 3 min):** **[YOU: link]**

**Testing instructions (about 2 minutes):**

1. Open https://game-of-chogs-testnet.vercel.app on a desktop or a phone.
2. Click **Get a test Chog**. If you have no wallet extension, a burner wallet is made for you. A test Chog Genesis (same art and traits as the real ones) is minted to you on Monad testnet. No MON needed.
3. Follow the short tour: it points at your noble, your gas, the map, the court and each move.
4. Click any Chog on the map or in the court, then hit **Stab**. Watch the result: an explosion and a title, or the walk of shame.
5. Open **The Raven** in the top bar to read the realm's gossip from previous days.
6. Holders can use the mainnet link with a wallet that holds a Chog Genesis. It's one free signature to log in, with no gas and no approvals.

**Contracts (Monad testnet):**

| Contract | Address |
|---|---|
| ChogLedger (daily seal) | `0xebdfe4be5ce0e0cd9e7ff3826cfde7b20b216cab` |
| ChogNobles: bastards | `0x7c61bf1e215894d0cea4d64413726433ef833fa9` |
| ChogNobles: Choglings (heirs) | `0xb6df7c5e831b4323468d1fc64437b123d3439b89` |
| MockChogGenesis (judge copy of the collection) | `0x1474d333a91ef33313393495cabe5d5c93ca614f` |
| Chog Genesis (mainnet, read only) | `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` |

## 05 · Under the hood

- **Repository:** https://github.com/GunroarCannon/game-of-chogs
- **Tech stack:**
  - Vite and vanilla JS: a canvas watercolor map, sprite-sheet effects, and an onboarding tour.
  - An Express API running as one Vercel function. The world state lives in Upstash Redis and changes under a short lock, and a Vercel Cron closes the day at midnight UTC.
  - `viem` on Monad: Multicall3 ownership reads, EIP-191 login (smart wallets supported through ERC-1271/6492), and Solidity contracts for the ledger, the bastards and heirs, and the testnet mock.
  - No LLMs and no paid APIs. Real Chog art comes from the OpenSea CDN, with an IPFS fallback.
- **Pre-existing work (disclosed):** these pieces come from my own earlier hackathon project *Royal Ramble*:
  - the Voronoi map generator (`shared/mapgen.js`, `shared/rng.js`)
  - the Upstash mirror (`server/store.js`)
  - small sketch helpers

  Fonts and sound effects come from my own asset library. The logo and the effect sprites were supplied for this project. Everything else was written for Chogathon. Built with the help of AI coding assistants (Claude Code).

## 06 · What's next?

- **Usage so far:** **[YOU]** Add any numbers or quotes from people who played. Useful counts:
  - claimed nobles: the 🔥 Players tab in the court
  - the daily Raven tallies
- **Next:**
  - $CHOG burns for an extra gas or to hire *the Faceless Chog* (a guaranteed stab). This is planned and not built yet.
  - A Molandak invasion as a server-wide event ("Winter is Chogging").
  - Seasons with a Hall of Legends.
  - Cross-collection marriages with other Monanimals.
  - Mainnet heirs and bastards as soon as the relayer is funded.

---

## How it scores against the judging criteria

| Criterion | Weight | What to point the judges at |
|---|---|---|
| Novelty | 30% | The NFT is a character with a career. Its record, heirs and grudges travel with the token when it's sold. NFTs breed new NFTs, and a bastard NFT is the way in for people without a Chog. |
| Fun | 20% | Instant explosive results, the shame bell, KINGSLAYER stamps, the Raven's jokes, backstabbing friends. |
| Retention | 20% | 3 gas a day, a midnight crowning, "while you slept" reports with revenge buttons, grudges (+15% revenge for 3 days), Night's Watch streaks, the daily paper. |
| Clarity | 15% | A guided tour that points at every part of the game and shows mock menus, four big move buttons with odds, and a phone layout. |
| Execution | 15% | Live on Vercel (always awake), real Chog art, a testnet mirror with a one-click faucet, contracts deployed, a daily on-chain seal. |
| $CHOG bonus | bonus | Not integrated yet. Planned: burn $CHOG for gas or a hired assassin. Only claim it if it ships. |

---

## Demo voice-over script

This is the subtitle text burned into `_ref/reel/game-of-chogs-demo-v2.mp4` (2:16), one line per shot, with start times. Read it at a relaxed pace. The music and effects are mixed quietly (-26.6 LUFS) so your voice sits on top. After you add the voice, bring the whole mix up to about -14 LUFS for YouTube or X.

| t | Line |
|---|---|
| 0:00 | This is Game of Chogs, a Game of Thrones parody for Chog Genesis NFTs on Monad. |
| 0:07 | Every one of the 1,969 Chogs is a noble, all living in one shared realm. |
| 0:13 | Holders connect a wallet. No Chog? Claim a free bastard NFT. No gas needed. |
| 0:19 | Judges can grab a free test Chog on Monad testnet. Let's do that. |
| 0:25 | One click later, a real test Chog is minted straight to my wallet. |
| 0:31 | New players get a quick tour. The goal: be the richest Chog on the Iron Toilet. |
| 0:38 | Your NFT's real traits become its stats: cunning, might and charm. |
| 0:43 | You get three gas a day to spend on schemes. |
| 0:47 | This is the realm: seven Houses, painted in watercolor on a wall. |
| 0:53 | The pins are the big players. |
| 0:57 | Bots run the unclaimed Chogs, so someone is always plotting against you. |
| 1:01 | The court ranks every Chog by clout, players and bots on the same ladder. |
| 1:07 | Let's go after the king. You can stab, duel, propose or bend the knee. |
| 1:14 | The odds come from both Chogs' stats. Stab it is. |
| 1:18 | Here goes the stab... |
| 1:24 | Kingslayer! That title is now stamped on my NFT for good. |
| 1:27 | Miss, and you do the walk of shame. The whole realm hears the bell. |
| 1:33 | New players even get a practice menu that walks them through every move. |
| 1:40 | At midnight UTC a new king is crowned and the realm is sealed on Monad. |
| 1:47 | Then The Raven prints the day's gossip. My stab made the front page. |
| 1:53 | No AI here. Every story is stitched from hundreds of hand-written jokes. |
| 1:59 | It plays just as well on your phone. |
| 2:05 | Everything sticks to the NFT. |
| 2:08 | Sell your Chog, and the buyer inherits its titles, enemies and heirs. |
| 2:11 | (end card) Play now at game-of-chogs.vercel.app |
