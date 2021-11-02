import { PoolTestFixture } from "./PoolTestFixture";
import { AaveTestPool } from "./AaveTestPool";
import { LidoTestPool } from "./LidoTestPool";
import { YearnTestPool } from "./YearnTestPool";
import { TokenInfo } from "./TokenInfo";
import { CompoundTestPool } from "./CompoundTestPool";
import { PoolType } from "../utils/TempusPool";
import { Suite } from "mocha";
import { 
  ONLY_RUN_POOL, ONLY_YIELD_TOKEN, ALL_POOLS, MOCK_TOKENS, RUN_INTEGRATION_TESTS
} from "../Config";

function _describeForEachPoolType(title:string, poolTypes:PoolType[], only:boolean, fn:(pool:PoolTestFixture) => void)
{
  let parent:Suite = null;

  for (let type of poolTypes)
  {
    if (ONLY_RUN_POOL && ONLY_RUN_POOL !== type) {
      continue;
    }

    for (let pair of MOCK_TOKENS[type]) {
      let ASSET_TOKEN:TokenInfo = pair[0];
      let YIELD_TOKEN:TokenInfo = pair[1];

      if (ONLY_YIELD_TOKEN && ONLY_YIELD_TOKEN !== YIELD_TOKEN.symbol) {
        continue;
      }

      const describeTestBody = () =>
      {
        // HACK: manually measure time, since new yarn hardhat+mocha stopped reporting them
        let startTime:number;
        beforeEach(() => {
          startTime = Date.now();
        });
        afterEach(() => {
          const elapsedMs = (Date.now() - startTime);
          let color = '0'; // default
          if (elapsedMs > 1000) color = '31'; // red
          else if (elapsedMs > 200) color = '33'; // yellow
          else if (elapsedMs > 100) color = '32'; // green
          // move to previous line, column 100 and set color
          console.log('\x1b[F\x1b[100C\x1b[%sm%sms\x1b[0m', color, elapsedMs);
        });
  
        let pool:PoolTestFixture;
        switch (type) {
          case PoolType.Aave:     pool = new AaveTestPool(ASSET_TOKEN, YIELD_TOKEN, RUN_INTEGRATION_TESTS); break;
          case PoolType.Lido:     pool = new LidoTestPool(ASSET_TOKEN, YIELD_TOKEN, RUN_INTEGRATION_TESTS); break;
          case PoolType.Compound: pool = new CompoundTestPool(ASSET_TOKEN, YIELD_TOKEN, RUN_INTEGRATION_TESTS); break;
          case PoolType.Yearn:    pool = new YearnTestPool(ASSET_TOKEN, YIELD_TOKEN, RUN_INTEGRATION_TESTS); break;
        }
        fn(pool);
      };
  
      // we want to describe suites by underlying pool type Prefix
      // this means tests are grouped and run by pool type, making fixtures faster
      const suiteTitle = type.toString() + " " + YIELD_TOKEN.symbol + " <> " + title;
      let suite:Suite = only ? describe.only(suiteTitle, describeTestBody) : describe(suiteTitle, describeTestBody);
      parent = suite.parent;
    }
  }

  // make sure to sort these suites by title
  parent?.suites.sort((a:Suite, b:Suite) => a.title.localeCompare(b.title));
  return parent;
}

interface MultiPoolSuiteFunction {
  /**
   * Batch describes unit test block for each specified PoolType
   */
  (title:string, fn:(pool:PoolTestFixture) => void): void;

  /**
   * Batch describes unit test block for specific PoolTypes
   */
  type: (title:string, poolTypes:PoolType[], fn:(pool:PoolTestFixture) => void) => void;

  /**
   * Indicates this suite should be executed exclusively.
   */
  only: (title:string, fn:(pool:PoolTestFixture) => void) => void;
}

function createDescribeForEachPool(): MultiPoolSuiteFunction {
  const f:MultiPoolSuiteFunction = (title:string, fn:(pool:PoolTestFixture) => void) => {
    _describeForEachPoolType(title, ALL_POOLS, /*only*/false, fn);
  };
  f.type = (title:string, poolTypes:PoolType[], fn:(pool:PoolTestFixture) => void) => {
    _describeForEachPoolType(title, poolTypes, /*only*/false, fn);
  };
  f.only = (title:string, fn:(pool:PoolTestFixture) => void) => {
    _describeForEachPoolType(title, ALL_POOLS, /*only*/true, fn);
  };
  return f;
}

/**
 * Batch describes unit test block for all PoolTypes
 */
export const describeForEachPool:MultiPoolSuiteFunction = createDescribeForEachPool();
