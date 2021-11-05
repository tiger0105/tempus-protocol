import { PoolTestFixture } from "./PoolTestFixture";
import { AaveTestPool } from "./AaveTestPool";
import { LidoTestPool } from "./LidoTestPool";
import { YearnTestPool } from "./YearnTestPool";
import { TokenInfo } from "./TokenInfo";
import { CompoundTestPool } from "./CompoundTestPool";
import { PoolType } from "../utils/TempusPool";
import { Suite } from "mocha";
import { 
  isIntegrationTestsEnabled, getOnlyRunPool, getOnlyRunToken, getTokens, ALL_POOLS
} from "../Config";

const integration = isIntegrationTestsEnabled();
const onlyRun = getOnlyRunPool();
const onlyToken = getOnlyRunToken();
const tokens = getTokens(integration);

function _describeForEachPoolType(title:string, poolTypes:PoolType[], only:boolean, fn:(pool:PoolTestFixture) => void)
{
  let parent:Suite = null;

  for (let type of poolTypes)
  {
    if (onlyRun && onlyRun !== type) {
      continue;
    }

    for (let pair of tokens[type]) {
      let asset:TokenInfo = pair[0];
      let yieldToken:TokenInfo = pair[1];

      if (onlyToken && onlyToken !== yieldToken.symbol) {
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
          case PoolType.Aave:     pool = new AaveTestPool(asset, yieldToken, integration); break;
          case PoolType.Lido:     pool = new LidoTestPool(asset, yieldToken, integration); break;
          case PoolType.Compound: pool = new CompoundTestPool(asset, yieldToken, integration); break;
          case PoolType.Yearn:    pool = new YearnTestPool(asset, yieldToken, integration); break;
        }
        fn(pool);
      };
  
      // we want to describe suites by underlying pool type Prefix
      // this means tests are grouped and run by pool type, making fixtures faster
      const suiteTitle = type.toString() + " " + yieldToken.symbol + " <> " + title;
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
