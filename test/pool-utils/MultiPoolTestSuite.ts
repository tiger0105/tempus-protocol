import { ethers } from "hardhat";
import { ITestPool, PoolType } from "./ITestPool";
import { AaveTestPool } from "./AaveTestPool";
import { LidoTestPool } from "./LidoTestPool";
import { CompoundTestPool } from "./CompoundTestPool";

export function createTestPool(type:PoolType): ITestPool {
    switch (type) {
      case PoolType.Aave: return new AaveTestPool();
      case PoolType.Lido: return new LidoTestPool();
      case PoolType.Compound: return new CompoundTestPool();
    }
  }
  
  export function describeForEachPool(title:string, fn:(pool:ITestPool) => void)
  {
    for (let type of [PoolType.Aave, PoolType.Lido, PoolType.Compound])
    {
        describe(title + " <> " + type.toString(), () =>
        {
          const pool = createTestPool(type);
          fn(pool);
        });
    }
  }
