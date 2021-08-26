import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

describeForEachPool("TempusPool YieldShare", (pool:ITestPool) =>
{
  it("Should have correct rates for Yields and Principals before Maturity", async () =>
  {
    await pool.createDefault();
    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.within(0.9091, 0.9092);
    expect(yieldsPrice).to.be.within(0.0908, 0.0909);
    expect(principalPrice + yieldsPrice).to.be.equal(1);
  });

  it("Should have correct rates for Yields and Principals after Maturity", async () =>
  {
    await pool.createDefault();
    await pool.setInterestRate(1.5); // set the final interest rate
    await pool.fastForwardToMaturity();

    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.within(1.0, 1.0);
    expect(yieldsPrice).to.be.within(0.5, 0.5);
    expect(principalPrice + yieldsPrice).to.be.equal(1.5);
  });
});
