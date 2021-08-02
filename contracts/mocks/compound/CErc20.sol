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
     * @notice Sender redeems cTokens in exchange for the underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemTokens The number of cTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function redeem(uint redeemTokens) external override returns (uint) {
        return redeemFresh(msg.sender, redeemTokens);
    }

    /**
     * @notice User redeems cTokens in exchange for the underlying asset
     * @dev Assumes interest has already been accrued up to the current block
     * @param redeemer The address of the account which is redeeming the tokens
     * @param redeemTokensIn The number of cTokens to redeem into underlying (only one of redeemTokensIn or redeemAmountIn may be non-zero)
     * @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
     */
    function redeemFresh(address redeemer, uint redeemTokensIn) internal returns (uint) {
        uint256 exchangeRateMantissa = exchangeRateStored();
        uint256 redeemTokens;
        uint256 redeemAmount;

        if (redeemTokensIn > 0) {
            /*
             * We calculate the exchange rate and the amount of underlying to be redeemed:
             *  redeemTokens = redeemTokensIn
             *  redeemAmount = redeemTokensIn x exchangeRateCurrent
             */
            redeemTokens = redeemTokensIn;
            redeemAmount = (redeemTokensIn * exchangeRateMantissa) / 1e18;
        } else {
            revert("redeemTokensIn <= 0 not implemented in mock");
        }

        // burn the yield tokens
        _burn(redeemer, redeemTokens);

        /*
         * We invoke doTransferOut for the redeemer and the redeemAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  On success, the cToken has redeemAmount less of cash.
         *  doTransferOut reverts if anything goes wrong, since we can't be sure if side effects occurred.
         */
        doTransferOut(redeemer, redeemAmount);
        return 0; // success
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

    /**
     * @dev Similar to EIP20 transfer, except it handles a False success from `transfer` and returns an explanatory
     *      error code rather than reverting. If caller has not called checked protocol's balance, this may revert due to
     *      insufficient cash held in this contract. If caller has checked protocol's balance prior to this call, and verified
     *      it is >= amount, this should not revert in normal conditions.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
     */
    function doTransferOut(address to, uint amount) internal override {
        IERC20 backingToken = IERC20(underlying);
        backingToken.transfer(to, amount);
    }
}
