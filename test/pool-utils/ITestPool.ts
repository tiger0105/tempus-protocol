import { ethers } from "hardhat";
import { Signer } from "../utils/ContractBase";
import { TempusPool } from "../utils/TempusPool";
import { ERC20 } from "../utils/ERC20";

export enum PoolType
{
  Aave = "Aave",
  Lido = "Lido",
  Compound = "Compound",
}
export abstract class ITestPool {
  pool:TempusPool;
  maturityTime:number;
  type:PoolType;
  principalName:string; // TPS
  yieldName:string; // TYS

  constructor(type:PoolType, principalName:string, yieldName:string) { 
    this.type = type;
    this.principalName = principalName;
    this.yieldName = yieldName;
  }

  /**
   * @return The underlying asset token of the backing pool
   */
  abstract asset(): ERC20;

  /**
   * This must create the TempusPool instance
   */
  abstract createTempusPool(owner:Signer, user:Signer): Promise<TempusPool>;

  /**
   * @param rate Sets the exchange rate for the underlying mock pool
   */
  abstract setExchangeRate(rate:number): Promise<void>;

  /**
   * Deposit some tokens to users
   */
  abstract deposit(owner:Signer, users:Signer[], depositToUsers:number): Promise<void>;
}

