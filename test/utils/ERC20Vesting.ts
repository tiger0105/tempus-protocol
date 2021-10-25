import { Contract, Transaction } from "ethers";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, Signer, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";

export interface VestingTerms {
  startTime:number;
  period:number;
  amount: NumberOrString;
  claimed: NumberOrString;
}

/**
 * Typed wrapper for ERC20Vesting contract
 */
export class ERC20Vesting extends ContractBase {
  erc20: ERC20;
  constructor(contractName:string, token: ERC20, contract?:Contract) {
    super(contractName, token.decimals, contract);
    this.erc20 = token;
  }

  static async create(token:ERC20, wallet: SignerOrAddress): Promise<ERC20Vesting> {
    const contractName = "ERC20Vesting";
    const contract = await this.deployContract(contractName, token.address, addressOf(wallet));
    return new ERC20Vesting(contractName, token, contract);
  }

  async wallet(): Promise<String> {
    return this.contract.wallet();
  }

  async token(): Promise<String> {
    return this.contract.token();
  }

  async startVesting(
    sender:SignerOrAddress, 
    receiver:SignerOrAddress,
    terms:VestingTerms
  ):Promise<Transaction> {
    this.erc20.approve(sender, this.address, terms.amount);
    return this.connect(sender).startVesting(
      addressOf(receiver),
      {
        startTime: terms.startTime,
        period: terms.period,
        amount: this.toBigNum(terms.amount),
        claimed: this.toBigNum(terms.claimed)
      }
    );
  }

  async getVestingTerms(receiver:SignerOrAddress): Promise<VestingTerms> {
    const terms = await this.contract.getVestingTerms(addressOf(receiver));
    return {
      startTime: terms.startTime,
      period: terms.period,
      amount: this.fromBigNum(terms.amount),
      claimed: this.fromBigNum(terms.claimed)
    }
  }

  async stopVesting(sender:SignerOrAddress, receiver:SignerOrAddress): Promise<Transaction> {
    return this.connect(sender).stopVesting(addressOf(receiver));
  }

  async claimable(receiver:SignerOrAddress): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.claimable(addressOf(receiver)));
  }

  async claim(sender:SignerOrAddress, amount:NumberOrString): Promise<any> {
    return this.connect(sender).claim(addressOf(sender), this.toBigNum(amount));
  }
}