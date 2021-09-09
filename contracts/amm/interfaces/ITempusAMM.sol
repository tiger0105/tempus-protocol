// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import "./IVault.sol";
import "./../../ITempusPool.sol";

interface ITempusAMM {
    enum JoinKind {
        INIT,
        EXACT_TOKENS_IN_FOR_BPT_OUT
    }
    enum ExitKind {
        EXACT_BPT_IN_FOR_TOKENS_OUT,
        BPT_IN_FOR_EXACT_TOKENS_OUT
    }

    function getVault() external view returns (IVault);

    function getPoolId() external view returns (bytes32);

    function tempusPool() external view returns (ITempusPool);

    function balanceOf(address) external view returns (uint256);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /// Calculates the expected returned swap amount
    /// @param amount The given input amount of tokens
    /// @param yieldShareIn Specifies whether to calculate the swap from TYS to TPS (if true) or from TPS to TYS (if false)
    /// @return The expected returned amount of outToken
    function getExpectedReturnGivenIn(uint256 amount, bool yieldShareIn) external view returns (uint256);

    /// @dev This function returns the appreciation of one BPT relative to the
    /// underlying tokens. This starts at 1 when the pool is created and grows over time
    function getRate() external view returns (uint256);
}
