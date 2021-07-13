// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CTokenMock.sol";
import "./CTokenInterfaces.sol";

/// Yield Bearing Token for Compound - CErc20 / CToken
contract CErc20 is CTokenMock, CErc20Interface {
    using SafeERC20 for IERC20;

    constructor(
        ComptrollerMock comptrollerInterface,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) CTokenMock(comptrollerInterface, name, symbol) {
        underlying = underlyingAsset;
    }

    /// User Interface ///

    /// @notice Sender supplies assets into the market and receives cTokens in exchange
    /// @dev Accrues interest whether or not the operation succeeds, unless reverted
    /// @param mintAmount The amount of the underlying asset to supply
    /// @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
    function mint(uint mintAmount) external override returns (uint) {
        (uint err, ) = mintInternal(mintAmount);
        return err;
    }

    /**
     * @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom` and reverts in that case.
     *      This will revert due to insufficient balance or insufficient allowance.
     *      This function returns the actual amount received,
     *      which may be less than `amount` if there is a fee attached to the transfer.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     */
    function doTransferIn(address from, uint amount) internal override returns (uint) {
        IERC20 backingToken = IERC20(underlying);

        uint balanceBefore = backingToken.balanceOf(address(this));
        backingToken.safeTransferFrom(from, address(this), amount);
        uint balanceAfter = backingToken.balanceOf(address(this));

        require(balanceAfter >= balanceBefore, "TOKEN_TRANSFER_IN_OVERFLOW");
        return balanceAfter - balanceBefore; // underflow already checked above, just subtract
    }
}
