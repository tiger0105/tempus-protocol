import { expect } from "chai";
import { Signer } from "../utils/ContractBase";
import { TempusPool } from "../utils/TempusPool";
import { ERC20 } from "../utils/ERC20";
import { NumberOrString } from "test/utils/Decimal";

export enum PoolType
{
  Aave = "Aave",
  Lido = "Lido",
  Compound = "Compound",
}

export class UserState {
  principalShares:Number;
  yieldShares:Number;
  yieldBearing:Number;

  // non-async to give us actual test failure line #
  public expect(principalShares:number, yieldShares:number, yieldBearing:number) {
    expect(this.principalShares).to.equal(principalShares, "principalShares did not match expected value");
    expect(this.yieldShares).to.equal(yieldShares, "yieldShares did not match expected value");
    expect(this.yieldBearing).to.equal(yieldBearing, "yieldBearing did not match expected value");
  }
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
  tempus:TempusPool;
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
   * @return Current Yield Bearing Token balance of the user
   */
  abstract yieldTokenBalance(user:Signer): Promise<NumberOrString>;

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
   * Deposit YieldBearingTokens into TempusPool
   */
  async depositYBT(user:Signer, yieldBearingAmount:number, recipient:Signer = null): Promise<void> {
    return this.tempus.deposit(user, yieldBearingAmount, (recipient !== null ? recipient : user));
  }

  /**
   * Typical setup call for most tests
   * 1. Deposits Asset into underlying pool by Owner
   * 1. Transfers Assets from Owner to depositors[]
   * 2. Transfers YBT from Owner to depositors[]
   */
  async setupAccounts(owner:Signer, depositors:[Signer,number][]): Promise<void> {
    if (!this.tempus)
      throw new Error('setupAccounts: createTempusPool not called');

    const totalDeposit = depositors.reduce((sum, current) => sum + current[1], 500);
    await this.deposit(owner, totalDeposit);

    for (let depositor of depositors) { // initial deposit for users
      const user = depositor[0];
      const amount = depositor[1];
      await this.asset().transfer(owner, user, 10000); // TODO: make this a parameter?
      await this.tempus.yieldBearing.transfer(owner, user, amount);
    }
  }

  /**
   * @returns Balances state for a single user
   */
  async userState(user:Signer): Promise<UserState> {
    let state = new UserState();
    state.principalShares = Number(await this.tempus.principalShare.balanceOf(user));
    state.yieldShares = Number(await this.tempus.yieldShare.balanceOf(user));
    state.yieldBearing = Number(await this.yieldTokenBalance(user));
    return state;
  }
}

