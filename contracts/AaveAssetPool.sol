// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IAssetPool.sol";
import "./mocks/AAVE/IAToken.sol";

contract AaveAssetPool is IAssetPool {
    /// @return The address of the Yield Bearing Token contract.
    address public immutable override yieldToken;

    /// @param yieldTokenAddress The address of the Yield Bearing Token contract.
    constructor(address yieldTokenAddress) {
        yieldToken = yieldTokenAddress;
    }

    /// @dev Deposits X amount of backing tokens from sender into the pool
    /// @param onBehalfOf ERC20 Address which will receive the Yield Bearing Tokens
    /// @param amount Amount of backing tokens, such as ETH or DAI to deposit
    function depositAsset(address onBehalfOf, uint amount) external override {
        IAToken aToken = IAToken(yieldToken);
        address asset = aToken.UNDERLYING_ASSET_ADDRESS();
        // we deposit DAI to Aave and receive aDAI into tempus pool contract
        aToken.POOL().deposit(asset, amount, onBehalfOf, 0);
    }

    /// @dev The current exchange rate of the yield bearing instrument compared
    ///      to the backing instrument. e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a WAD decimal
    function currentRate() external view override returns (uint) {
        IAToken aToken = IAToken(yieldToken);
        uint rateInRay = aToken.POOL().getReserveNormalizedIncome(aToken.UNDERLYING_ASSET_ADDRESS());
        // convert from RAY 1e27 to WAD 1e18 decimal
        return rateInRay / 1e9;
    }
}
