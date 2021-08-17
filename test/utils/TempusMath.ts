import { TempusPool } from "./TempusPool";
import { NumberOrString } from "./Decimal";
import Decimal from 'decimal.js';

export async function calculateMintedSharesOnDeposit(tempusPool: TempusPool, ybtDepositAmount: NumberOrString) : Promise<string> {
    const initialExchangeRate: Decimal = new Decimal((await tempusPool.initialInterestRate()).toString())
    const depositAmount: Decimal = new Decimal(ybtDepositAmount.toString());
    
    return depositAmount.mul(initialExchangeRate).toString();
}
