// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

// TODO: also add StETH interfaces (plus ERC20)
interface ILido {
    /// @notice Send funds to the pool with optional _referral parameter
    /// @dev This function is alternative way to submit funds. Supports optional referral address.
    /// @return Amount of StETH shares generated
    function submit(address _referral) external payable returns (uint256);
}
