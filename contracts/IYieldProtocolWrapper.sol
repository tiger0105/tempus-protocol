// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

interface IYieldProtocolWrapper {
    /// This mints yield tokens from underlying protocol
    /// @param yieldToken Yield token contract address
    /// @param backingTokenAmount Amount of backing tokens to be used for minting yield token
    /// @return amountMinted amount of yield tokens minted
    function mint(address yieldToken, uint256 backingTokenAmount) external payable returns (uint256 amountMinted);
}
