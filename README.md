# Izumi-contracts-UniswapV3Mining


<div align="center">
  <a href="https://izumi.finance"> 
    <img width="450px" height="auto" 
    src="image/logo.png">
  </a>
</div>

Contracts to mine uniswap V3 NFT token

# Designs:

### Model1: mining with fixed price range.

### Model2: mining with no-impermanent loss.

# Generate Docs:
```
$ npx solidity-docgen --solc-module solc-0.8.4 -i contracts -o docs -t template
```

# Scripts:
Each script runs some specific tasks. Run a script with the following command line. 

Find more at [Guide for Hardhat Scripts](https://hardhat.org/guides/scripts.html').

```shell
$ HARDHAT_NETWORK='CUSTOM_NETWORK' node scripts/THE_SCRIPTS.js argv[0] argv[1] ...
```

If no argvs are passed, run the follows alternatively.
```shell
$ npx hardhat run scripts/THE_SCRIPTS.js --network CUSTOM_NETWORK
```
