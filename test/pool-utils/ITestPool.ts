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
  type:PoolType;
  principalName:string; // TPS
  yieldName:string; // TYS
  // if true, minting scales with exchangeRate,
  // ex true: deposit(100) with rate 1.2 will yield 120 TPS and TYS
  // ex false: deposit(100) with rate 1.0 will yield 100 TPS and TYS
  mintScalesWithRate:boolean;

  // initialized by createTempusPool()
  pool:TempusPool;
  maturityTime:number;

  constructor(type:PoolType, principalName:string, yieldName:string, mintScalesWithRate:boolean) { 
    this.type = type;
    this.principalName = principalName;
    this.yieldName = yieldName;
    this.mintScalesWithRate = mintScalesWithRate;
  }

  /**
   * @return The underlying asset token of the backing pool
   */
  abstract asset(): ERC20;

  /**
   * This must create the TempusPool instance
   */
  abstract createTempusPool(initialRate:number): Promise<TempusPool>;

  /**
   * @param rate Sets the exchange rate for the underlying mock pool
   */
  abstract setExchangeRate(rate:number): Promise<void>;

  /**
   * Deposit BackingTokens into the UNDERLYING pool and receive YBT
   */
  abstract deposit(user:Signer, amount:number): Promise<void>;

  /**
   * Typical setup call for most tests
   * 1. Deposits Asset into underlying pool by Owner
   * 1. Transfers Assets from Owner to depositors[]
   * 2. Transfers YBT from Owner to depositors[]
   */
  async setupAccounts(owner:Signer, depositors:[Signer,number][]): Promise<void> {
    if (!this.pool)
      throw new Error('setupAccounts: createTempusPool not called');

    const totalDeposit = depositors.reduce((sum, current) => sum + current[1], 500);
    await this.deposit(owner, totalDeposit);

    for (let depositor of depositors) { // initial deposit for users
      const user = depositor[0];
      const amount = depositor[1];
      await this.asset().transfer(owner, user, 10000); // TODO: make this a parameter?
      await this.pool.yieldBearing.transfer(owner, user, amount);
    }
  }
}

