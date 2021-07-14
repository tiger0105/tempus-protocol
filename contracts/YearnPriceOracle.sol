// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./mocks/yearn/IYearnVaultV2.sol";
import "./IPriceOracle.sol";

contract YearnPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a WAD decimal
    function currentRate(address token) external view override returns (uint256) {
        IYearnVaultV2 vault = IYearnVaultV2(token);
        return vault.pricePerShare();
    }
}
