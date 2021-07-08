// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IAssetPool.sol";
import "./mocks/Compound/CTokenInterface.sol";

contract CompoundAssetPool is IAssetPool {
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
        // solhint-disable-previous-line no-empty-blocks
        // TODO: Implement this
    }

    /// @dev The current exchange rate of the yield bearing instrument compared
    ///      to the backing instrument. e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a WAD decimal
    function currentRate() external view override returns (uint) {
        CTokenInterface cToken = CTokenInterface(yieldToken);
        return cToken.exchangeRateCurrent();
    }
}
