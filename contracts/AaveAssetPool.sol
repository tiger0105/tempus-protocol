// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IAssetPool.sol";
import "./mocks/AAVE/IAToken.sol";

contract AaveAssetPool is IAssetPool {
    /// @return The address of the Yield Bearing Token contract.
    address public immutable override yieldToken;

    /// @dev This can be used for approve() before depositAsset()
    /// @return The address of the underlying pool which transfers deposits
    address public immutable override pool;

    /// @param yieldTokenAddress The address of the Yield Bearing Token contract.
    /// @param poolAddress The address of the underlying pool which transfers deposits
    constructor(address yieldTokenAddress, address poolAddress) {
        yieldToken = yieldTokenAddress;
        pool = poolAddress;
    }

    /// @dev Deposits X amount of backing tokens from `msg.sender` into the pool
    ///      msg.sender must first approve transfer to this `pool` address
    /// @param recipient ERC20 Address which will receive the Yield Bearing Tokens
    /// @param amount Amount of backing tokens, such as ETH or DAI to deposit
    /// @return Number of Yield Bearing Tokens minted to `recipient`
    function depositAsset(address recipient, uint amount) external override returns (uint) {
        // solhint-disable-previous-line no-empty-blocks

        // TODO: Implement this
        // IAToken aToken = IAToken(yieldToken);
        // address asset = aToken.UNDERLYING_ASSET_ADDRESS();
        // // we deposit DAI from msg.sender to Aave and receive aDAI to recipient

        // (bool success, bytes memory data) = pool.delegatecall(
        //     abi.encodeWithSignature("deposit()", arg)
        // );

        // aToken.POOL().deposit(asset, amount, recipient, 0);
        return amount;
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
