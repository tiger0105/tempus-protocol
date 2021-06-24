// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ATokenMock.sol";
import "./WadRayMath.sol";

// TODO: emit events matching with AAVE, these will be useful for frontend development
contract AavePoolMock {
    using WadRayMath for uint;

    // AAVE supports multi-reserve lending, but in this Mock we only support 1 reserve
    IERC20 private assetToken; // DAI
    ATokenMock public yieldToken; // aDAI
    uint128 private liquidityIndex; // the liquidity index in Ray (init:1ray=1e27)

    /// @dev Initialize AAVE Mock with a single supported reserve.
    /// We only support 1 reserve right now.
    /// @param asset The single ERC20 reserve token, such as DAI
    constructor(
        IERC20 asset // DAI
    ) {
        assetToken = asset;
        yieldToken = new ATokenMock("AaveAToken", "AAT");
        liquidityIndex = uint128(WadRayMath.ray()); // 1ray
    }

    /// @notice MOCK ONLY
    /// @dev Sets the current liquidity index for deposit() and getReserveNormalizedIncome()
    /// @param index Asset liquidity index. Expressed in ray (1e27)
    function setLiquidityIndex(uint128 index) public {
        liquidityIndex = index;
    }

    /// @dev Returns the normalized income per unit of asset
    /// @param asset The address of the underlying asset of the reserve
    /// @return The reserve's normalized income
    function getReserveNormalizedIncome(address asset) public view returns (uint) {
        require(address(assetToken) == asset, "invalid reserve asset");
        return liquidityIndex;
    }

    /// @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
    /// - E.g. User deposits 100 USDC and gets in return 100 aUSDC
    /// @param asset The address of the underlying asset to deposit
    /// @param amount The amount to be deposited
    /// @param onBehalfOf The address that will receive the aTokens, same as msg.sender if the user
    ///   wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
    ///   is a different wallet
    function deposit(
        address asset,
        uint amount,
        address onBehalfOf,
        uint16 /*referralCode*/
    ) public {
        require(address(assetToken) == asset, "invalid reserve asset");

        address pool = address(this);
        require(assetToken.transferFrom(msg.sender, pool, amount), "transfer failed");

        // liquidity index controls how many additional tokens are minted
        uint amountScaled = (amount).rayDiv(liquidityIndex);
        yieldToken.mint(onBehalfOf, amountScaled);
    }

    /// @notice MOCK ONLY
    /// @return Total deposited underlying assets of an user
    function getDeposit(address user) public view returns (uint) {
        return yieldToken.balanceOf(user);
    }
}
