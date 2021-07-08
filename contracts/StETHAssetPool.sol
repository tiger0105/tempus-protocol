// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IAssetPool.sol";
import "./mocks/lido/StETH.sol";

contract StETHAssetPool is IAssetPool {
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
    ///      msg.sender must first approve transfer to this `yieldToken` address
    /// @param recipient ERC20 Address which will receive the Yield Bearing Tokens
    /// @param amount Amount of backing tokens, such as ETH or DAI to deposit
    /// @return Number of Yield Bearing Tokens minted to `recipient`
    function depositAsset(address recipient, uint amount) external override returns (uint) {
        // solhint-disable-previous-line no-empty-blocks
        // TODO: Implement this
        return amount;
    }

    /// @dev The current exchange rate of the yield bearing instrument compared
    ///      to the backing instrument. e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a WAD decimal
    function currentRate() external view override returns (uint256) {
        StETH steth = StETH(yieldToken);
        uint totalSupply = steth.totalSupply();
        if (totalSupply == 0) {
            return 1e18; // 1 WAD
        } else {
            return (steth.getTotalShares() * 1e18) / totalSupply;
        }
    }
}
