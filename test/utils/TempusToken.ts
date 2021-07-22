import { NumberOrString } from "./Decimal";
import { SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";

/**
 * Type safe wrapper of TempusToken
 */
export class TempusToken extends ERC20 {
  constructor() {
    super("TempusToken");
  }

  /**
   * Allow token holders to burn their own tokens.
   * @param sender Account that is issuing the burn.
   * @param account Token holder account
   * @param amount Number of tokens to burn
   */
  async burn(sender:SignerOrAddress, account:SignerOrAddress, amount:NumberOrString) {
    await this.connect(sender).burn(addressOf(account), this.toBigNum(amount));
  }
}
