// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6 <0.9.0;

/// Interface representing the priceable tokens.
interface IPriceable {
    /// @dev Price per single share expressed in Backing Tokens of the underlying pool.
    ///      This is for the purpose of TempusAMM api support.
    ///      Example: exchanging Tempus Yield Share to DAI
    /// @return 1e18 decimal conversion rate per share
    function getPricePerFullShare() external returns (uint256);

    /// @return 1e18 decimal stored conversion rate per share
    function getPricePerFullShareStored() external view returns (uint256);
}
