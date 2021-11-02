import { TokenInfo } from "./pool-utils/TokenInfo";
import { PoolType } from "./utils/TempusPool";

// Default list of all Pool Types that will be run during tests
export const ALL_POOLS = [
    PoolType.Aave,
    PoolType.Lido,
    PoolType.Compound,
    PoolType.Yearn
];

// Set this to `PoolType.XXX` if you want to only run one specific pool's tests
export const ONLY_RUN_POOL:PoolType = undefined;

// Set this to `aDAI` or `aUSDC` if you want to only run one specific YBT tests
export const ONLY_YIELD_TOKEN:string = undefined;

// Is this an integration test run?
export let RUN_INTEGRATION_TESTS:boolean = false;

const TOTAL_SUPPLY = 10000000000;

// pairs of [ASSET_TOKEN, YIELD_TOKEN] infos
// for standard unit tests which use mock protocols
export const MOCK_TOKENS: { [type:string]: TokenInfo[][]; } = {
  "Aave": [
    [
      { decimals:18, name:"Dai Stablecoin",            symbol:"DAI", totalSupply:TOTAL_SUPPLY },
      { decimals:18, name:"Aave interest bearing DAI", symbol:"aDAI" }
    ],
    [
      { decimals:6, name:"USD Coin",                   symbol:"USDC", totalSupply:TOTAL_SUPPLY },
      { decimals:6, name:"Aave interest bearing USDC", symbol:"aUSDC" } // similar to USDT
    ]
  ],
  "Compound": [
    [
      { decimals:18, name:"Dai Stablecoin", symbol:"DAI", totalSupply:TOTAL_SUPPLY },
      { decimals:8,  name:"Compound Dai",   symbol:"cDAI" }
    ],
    [
      { decimals:6, name:"USD Coin",          symbol:"USDC", totalSupply:TOTAL_SUPPLY },
      { decimals:8, name:"Compound USD Coin", symbol:"cUSDC" }
    ]
  ],
  "Lido": [
    [
      { decimals:18, name:"wETH Mock", symbol:"wETH", totalSupply:TOTAL_SUPPLY },
      { decimals:18, name:"Liquid staked Ether 2.0", symbol:"stETH" }
    ]
  ],
  "Yearn": [
    [
      { decimals:18, name:"Dai Stablecoin", symbol:"DAI", totalSupply:TOTAL_SUPPLY },
      { decimals:18,  name:"Dai yVault",   symbol:"yvDAI" }
    ],
    [
      { decimals:6, name:"USD Coin",          symbol:"USDC", totalSupply:TOTAL_SUPPLY },
      { decimals:6, name:"USDC yVault", symbol:"yvUSDC" }
    ]
  ]
};
