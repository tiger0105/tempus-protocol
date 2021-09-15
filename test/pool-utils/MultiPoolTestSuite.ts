import { ITestPool } from "./ITestPool";
import { AaveTestPool } from "./AaveTestPool";
import { LidoTestPool } from "./LidoTestPool";
import { CompoundTestPool } from "./CompoundTestPool";
import { PoolType } from "../utils/TempusPool";
import { Suite } from "mocha";

// Set this to `PoolType.XXX` if you want to only run one specific pool's tests
let ONLY_RUN_POOL:PoolType = PoolType.Compound;

function createTestPool(type:PoolType): ITestPool {
  switch (type) {
    case PoolType.Aave: return new AaveTestPool();
    case PoolType.Lido: return new LidoTestPool(); 
    case PoolType.Compound: return new CompoundTestPool();
  }
}

/**
 * Batch describes unit test block for all PoolTypes
 */
export function describeForEachPool(title:string, fn:(pool:ITestPool) => void)
{
  describeForEachPoolType(title, [PoolType.Aave, PoolType.Lido, PoolType.Compound], fn);
}

/**
 * Batch describes unit test block for each specified PoolType
 */
export function describeForEachPoolType(title:string, poolTypes:PoolType[], fn:(pool:ITestPool) => void)
{
  let parent:Suite = null;

  for (let type of poolTypes)
  {
    if (ONLY_RUN_POOL && ONLY_RUN_POOL !== type) {
      continue;
    }

    // we want to describes suites by underlying pool type Prefix
    // this means tests are grouped and run by pool type, making fixtures faster
    let suite:Suite = describe(type.toString() + " <> " + title, () =>
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

      const pool = createTestPool(type);
      fn(pool);
    });
    parent = suite.parent;
  }

  // make sure to sort these suites by title
  parent?.suites.sort((a:Suite, b:Suite) => a.title.localeCompare(b.title));
}
