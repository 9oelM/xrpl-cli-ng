Your job is to write a full-on XRPL CLI.

Here's the overarching spec:
1. It's an XRPL CLI that leverages xrpl.js and Commander.js. Basically send tx from CLI to XRPL without having to write scripts.
1. Entirely written in strict, modern typescript to avoid any kind of type-related bugs
1. All features / flags / options covered by E2E tests.
1. All E2E tests that use XRPL will need to use XRPL testnet. The test needs to be orchestrated carefully as you need to use multiple accounts for running tests in parallel. At first, prefund one account from the faucet, and distribute the minimal funds to accounts that are going to be used for each test.
1. It uses traditional npm & package.json structure
1. Cover all amendments and features supported by [xrpl.js](https://js.xrpl.org/) and seen as enabled on https://livenet.xrpl.org/amendments. If an amendment is still being voted for but is supported by xrpl.js, xrpl-cli must be support the amendment.
1. Refer to the design choices of popular CLIs for other blockchains such as [`cast` for Ethereum](https://www.getfoundry.sh/reference/cast/cast), or [`starkli` for Starknet](https://book.starkli.rs/) whenever you're lost.

