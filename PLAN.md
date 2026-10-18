# GAME OF CHOGS — Hackathon Plan (Chogathon 2026)

> *"When you play the Game of Chogs, you win or you get rugged."*

Deadline: ~6 days (submissions close ~Oct 24, 2026). Judging runs 7 days after that, and the daily hooks are built for that week.

---

## Status (updated Oct 18)

- [x] Chog Genesis verified on-chain: `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` (Monad 143, ids 1..1969; display name = metadata number). $CHOG `0x3500…7777`
- [x] Trait cache `data/genesis.json` (1955/1969; rerun `scripts/fetch-genesis.mjs` to finish)
- [x] Rules engine: 6 moves, grudges, titles, tick, coronation, bots, balanced Houses (`shared/game.js`), plus a sim test
- [x] The Raven: template tabloid with about 600 lines (`shared/raven.js`, `shared/ravenLines.js`)
- [x] Doodle Chog SVG generator from real traits, with stickers (`shared/chogArt.js`)
- [x] Server: oath login, live ownerOf, moves, feasts, proposals, bastards, faucet, dynamic metadata, art, image proxy (OpenSea CDN)
- [x] Contracts compiled: ChogLedger, ChogNobles, MockChogGenesis, plus a deploy script
- [x] Client: gate, map, my Chog, court, noble sheet, slam result + FX + sound, Raven, ticker, tutorial, mobile tabs
- [ ] Fund relayer `0x3013b0F162f2fC0770f070f44715Ee4a84881e41`, then deploy testnet and test the faucet holder flow
- [ ] GitHub repo + Render + Upstash, then deploy live
- [ ] Mainnet deploy (ledger + nobles), switch the live site to `CHAIN_MODE=mainnet` (keep a testnet judge mirror?)
- [ ] Polish pass, demo video, submission

## 1. The pitch (one line)

**Every Chog Genesis NFT is a noble in a Game of Thrones parody. Stab, feast, marry, duel and sit on the Iron Toilet. Every grudge, title, scar and heir is stored against the token, so selling your Chog sells its whole bloody reputation.**

The design doc (Chog Dynasty) stays the backbone. These changes make it shippable in 6 days and easier to play:

| Design doc | Game of Chogs (v1) | Why |
|---|---|---|
| 10 actions, 3 AP | **6 moves, 3 GAS per day** (Monad gas joke) | Easier to learn. Clarity is worth 15%. |
| Everything resolves at a daily tick | **Moves resolve instantly** with an explosion and a reveal. The **throne and the Raven** run on the daily tick. | Judges get fun in their first minute and a reason to come back tomorrow. |
| GPT Gazette | **"The Raven"**: a template and mad-libs tabloid built from the day's events | No LLM or paid API, and it works offline |
| Consent txs for duels | Only marriage needs consent. Everything else resolves against the target's stats. | Targets don't have to be online |
| Empty world until holders join | **All ~1,969 Genesis Chogs exist as unclaimed nobles** from day 0. An owner connects and claims theirs. | A living world. Judges can stab real Chog #420. Real owners return to "you were stabbed 4 times while you slept". |
| Wagmi/RainbowKit/Next | Vite + vanilla JS + `viem`, the same shape as royal-ramble | Fast, small, and code we already know |

---

## 2. Why the NFT is essential (submission field 03)

1. **Key.** Every move is an EIP-712 message signed by the wallet that `ownerOf(tokenId)` returns *right now*. If you don't hold the token, you don't control the noble.
2. **State container.** Clout, titles, scars, shames, spouse, heirs and grudges are keyed by `(collection, tokenId)`. Each daily tick seals them to the **ChogLedger** contract on Monad (one batch tx and the Raven's hash). Heirs are real ERC-721s whose `tokenURI` is a live dynamic-metadata endpoint, so titles appear in wallets and marketplaces.
3. **Transferable identity.** State follows the token and never the wallet. The buyer of a "Kingslayer, Twice-Widowed" Chog inherits its enemies, spouse, heirs and throne claim. The profile shows a "Previous Lords" list.
4. **Traits are the character.** Stats and House come from on-chain traits. A rare hat is a different opening game, not just bigger numbers.

**Strip-out test:** with no NFT there is no noble, no stats, no House, no save file and no portrait. The game cannot run.

**Non-holders (judges and the masses):** they **"Claim a Bastard"**: a free, gasless mint of a *Chog Snow* NFT (our ERC-721, Monad testnet, relayer pays). Bastards are still NFTs, so the rule holds, but they are second-class (lower stat caps, the "Snow" surname, a legitimisation quest). That is a GoT joke and an onboarding funnel at the same time. If no wallet is present, a burner key is created in localStorage.

---

## 3. Core loop (easy mode)

Open the app. Read **The Raven** (yesterday's drama). See your Chog with its stickers (crown, scars, shame bell). You have **3 GAS**. Pick a target on the map or roster and play a move. 💥 It resolves instantly. Leave. Come back tomorrow for new gas, the coronation and revenge.

### The 6 moves

| Move | Cost | Roll | Win | Lose |
|---|---|---|---|---|
| **STAB** (scheme) | 1 | Cunning vs Cunning+Vigor | Steal Clout, target gets a 🗡 sticker, grudge recorded | **Walk of Shame**: "SHAME!" graffiti, bell, sad trombone, shame mark |
| **DUEL** (trial by combat) | 1 | Vigor+Charisma vs same, + luck | Scar trophy on winner, Clout | Eyepatch or bandage sticker |
| **FEAST** | 1 | — | Everyone who RSVPs within 6h: +opinion, +Clout for host | 10% chance of a **Red Wedding** if two nemeses attend (screen-wide explosion) |
| **PROPOSE** | 1 | consent | Married. Ring sticker, unlocks BEGET | Rejected: "friendzoned" mark |
| **BEGET HEIR** | 2 | married, 2-day cooldown | Mints a **Chogling** NFT with traits mixed from both parents, drawn by the doodle generator | — |
| **BEND THE KNEE** | 1 | — | Swear to a liege: they gain Clout, you get protection (stabbing you also angers them) | Betraying a liege later earns **Oathbreaker** |

- **Grudges:** if someone stabbed you, revenge on them gets +25% for 3 days ("The North Remembers" becomes **"The Chain Remembers"**).
- **Rugged ≠ dead:** losing badly leaves your Chog "Rugged" (X eyes) for the rest of the day. *"What is rugged may never die."*
- **Rarity matters:** rare traits mean higher base stats and a higher Clout cap. Commons get the **underdog path**: knee-bending coalitions and a +10% stab bonus on anyone in the top 10 ("Chaos is a ladder").

### Daily tick (00:00 UTC)
1. Gas refills.
2. **Coronation:** the highest-Clout Chog takes the **Iron Toilet** (crown sticker, fanfare, sound). Second place becomes **Hand of the Chog**.
3. **The Raven** is published from that day's events. It is archived forever and shareable.
4. Outcomes are **sealed on-chain** (ChogLedger batch).
5. NPC Chogs (unclaimed nobles) take scripted moves so the world never goes quiet. No LLM, only weighted rules: grudges first, then the weakest neighbour, then feasts.

### Retention hooks (judges come back daily)
Gas refill · the coronation race · revenge windows · Chogling grows up in 2 days · "while you were away" report · Watch streak ("Brothers of the Night's Watch" title at 5 days) · the Raven.

### Titles (bitmask on-chain), first batch
Kingslayer (stab the current Toilet-holder) · Oathbreaker · Twice-Wed · Kinglet (held the Iron Toilet) · Hand of the Chog · The Shamed (3 walks of shame) · Red Wedding Planner · Fartfather (3 heirs) · The Unstabbable (survived 5 stabs) · Night's Watch (5-day streak) · Bastard Legitimised.

---

## 4. Comedy bank (GoT → Chog)

Used in the Raven, toasts, move results and loading screens:

- "When you play the Game of Chogs, you win or you get rugged."
- "Winter is Chogging."
- "A Chog always pays its gas fees." (the Lannister line)
- "The night is dark and full of farts."
- "Chaos is a ladder. Farts are a staircase."
- "You know nothing, Chog Snow."
- "HODL the door!" (Hodor)
- "The Chain remembers."
- "Valar Chogulis. All Chogs must rug." / "Valar Dohodlis. All Chogs must HODL."
- "I fart and I know things."
- "FARTCARYS!" (Dracarys; the explosion move FX)
- "Shame. Shame. *ding*" (walk of shame)
- "What is rugged may never die, but rises again, harder… and fartier."
- "The Purple Wedding" (Monad purple) and "The Red Wedding" (feast disaster)
- "Iron Toilet" (the throne) · "King's Landing" becomes **"Chog's Landing"**
- Houses (from the hat trait): House Snark, House Lambopiss, House Targaryeet, House Greyjoint, House Boltonft, House Tyrelly. Final names TBD, keep them clean enough for the Chog team.
- "The Molandaks are coming" (stretch: winter invasion event, a cross-collection nod)

The Raven uses template sentences with slots (`{actor} stabbed {target} at {place}. {quote}`), roughly 60 templates per event type, picked at random from a seed. It reads as hand-written gossip without needing an LLM.

---

## 5. Art direction — graffiti doodle

- **Look:** thick black wobbly outlines (doodle), flat bright fills (Chog palette: cream face, pink and red spikes, yellow, sky blue, purple), spray-paint texture, drips, tag-style headings, sticker overlays, halftone. UI panels look like walls and torn posters. Moves end in **comic explosions** (POW / STAB / FARTCARYS starbursts, particles, screen shake).
- **Portraits:**
  - Owned Genesis Chog: its **real NFT image**, with our sticker overlays (crown, scar, eyepatch, ring, shame bell, dagger).
  - Bastards, Choglings and map tokens: a **procedural doodle Chog SVG generator** in the Chog style. Round cream head, spiky hair tufts, cap with slogan text (CHOG / GM / HODL / FART…), big grin with gold tooth, blush cheeks, eye variants (normal, laser, glasses, angry), outfit (jersey number, suit and tie, hoodie). Traits map 1:1 from metadata so a Chogling looks like a mix of its parents.
- **Map:** royal-ramble's Voronoi map gen, restyled as **"The Seven Chogdoms"**: a spray-painted city-wall map, province fills as spray blobs, thick outlines, tag labels, and castle icons drawn as graffiti throw-ups. Each province belongs to a House. Chogs stand on their House's land.
- **Sound:** small, preloaded, under ~400 KB total. Farts and the shame bell are **synthesized with WebAudio** (0 KB).

---

## 6. Tech

```
game-of-chogs/
  index.html, vite.config.js
  src/            UI: map, court, roster, raven, ticker, fx (explosions), doodle-chog SVG gen, audio
  shared/         game rules (pure, deterministic): stats-from-traits, moves, tick, raven templates, mapgen, rng
  server/         Express: auth (EIP-712 verify + ownerOf), moves API, tick cron, NPC bots, metadata endpoint, store
  contracts/      ChogLedger.sol (sealed state + titles), ChogBastards.sol + Choglings.sol (ERC-721, relayer-minted)
  scripts/        fetch-genesis-traits.js (one-off cache of all ~1,969 traits → data/genesis.json), deploy, seed
  public/fonts, public/sfx
```

- **Chain:** `viem` only. Read `ownerOf` and traits from the **Chog Genesis contract (Monad mainnet)**. Our contracts go on **Monad testnet** (mainnet-ready). Contracts are built with Foundry (fall back to Hardhat if not installed).
- **Storage:** JSON on disk with an optional Upstash mirror (royal-ramble `store.js`). No database, no FalkorDB, no LLM.
- **Hosting:** Render or Fly (long-running, so the tick timer works), the same configs as royal-ramble.
- **$CHOG (bonus, stretch):** "A Chog always pays its debts". Burn $CHOG for +1 GAS/day (cap 1) or to hire **the Faceless Chog** (a guaranteed stab). The server verifies the burn tx.

---

## 7. Day-by-day

| Day | Date | Goal | Done when |
|---|---|---|---|
| **1** | Oct 18–19 | Scaffold, assets, map, doodle Chog | Vite + Express runs. Map renders graffiti-style. Doodle Chog generator makes 20 varied Chogs. Genesis contract address and metadata format confirmed. `genesis.json` cached. |
| **2** | Oct 20 | Game core and contracts | `shared/` rules with 6 moves, stats, grudges, titles, tick, all unit-tested in node. EIP-712 auth + ownerOf check. Bastards, Choglings and Ledger deployed to testnet. Gasless bastard mint works. |
| **3** | Oct 21 | Playable UI | Court view, roster, map targeting, move flow, explosion FX + sounds, ticker. A new player goes from landing to first stab in **under 60 s**. |
| **4** | Oct 22 | The daily layer | Tick: coronation, Raven templates + archive, on-chain seal, NPC bots, marriage + beget + Chogling mint, "while you were away". |
| **5** | Oct 23 | Juice, onboarding, deploy | 3-step tutorial. Mobile layout. Deployed live. World seeded with 3 days of simulated history. Holder playtest link sent to the Chog Discord. |
| **6** | Oct 24 | Ship | Bug-fix only. 3-min demo video. README. Submission fields 01–06. Optional $CHOG burn if there is time. |

**Cut order if behind:** $CHOG → Molandak invasion → Chogling art blending (use one parent's look) → DUEL (fold into STAB) → on-chain seal (keep the signed-action log; seal manually once before submitting). **Never cut:** the instant explosion moves, the Raven, the throne, sticker overlays on the NFT portrait.

**Subagents (cheap models)** for mechanical work: asset copy and font subsetting, the traits-scraping script, contract boilerplate and tests, Raven template writing (bulk comedy lines).

---

## 8. Open items to verify on Day 1

- [ ] Chog Genesis contract address on Monad mainnet, plus the `tokenURI` and metadata format (trait names: hat, eyes, body, background…)
- [ ] $CHOG token address (for the stretch goal)
- [ ] Monad testnet RPC, chain id, faucet for the relayer wallet
- [ ] Foundry installed? `python` + `fonttools` for woff2 subsetting?
- [ ] Hosting account (Render or Fly) from royal-ramble still usable?

---

## 9. Reuse list

**From yeetfleet-vanilla** (fonts subset to woff2, around 100 KB total):
- Fonts: `Graffiti Treat.otf` (headings), `Vandal On The Fluid.ttf` (stamps and tags), `08Underground` (UI labels), `funkymuskrat.ttf` (body, if readable enough)
- SFX (~340 KB): fuel-explosion, shatter-shot-explosion, distant-explosion, Impact_1, forceful-impact, long-sweeping-air-swoosh, open-special-box, game-experience-level-increased, sad-game-over-trombone (walk of shame), medieval-show-fanfare (coronation), Tone1C_MajorTriadUp (UI tick)
- Music (optional, lazy-loaded): `Military March [Psx Bitcrush].ogg` (378 KB)

**From royal-ramble-falkord** (PROPOSED, waiting on your OK, see chat).
