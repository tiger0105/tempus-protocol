// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @author The tempus.finance team
/// @title The interface of a Tempus Pool
interface ITempusPool {
    /// @dev Event emitted on successful TempusPool deposit().
    /// @param depositor Address of user who deposits Yield Bearing Tokens to mint
    ///                  Tempus Principal Share (TPS) and Tempus Yield Shares
    /// @param recipient Address of the recipient who will receive TPS and TYS tokens
    /// @param yieldTokenAmount Amount of yield tokens received from underlying pool
    /// @param shareAmounts Number of Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS) granted to `recipient`
    /// @param rate Exchange rate of the underlying pool from Yield Bearing Tokens to the underlying asset
    event Deposited(address depositor, address recipient, uint256 yieldTokenAmount, uint256 shareAmounts, uint256 rate);

    /// @dev Event emitted on successful TempusPool redeem().
    /// @param redeemer Address of the user who wants to redeem Tempus Principal Shares (TPS)
    ///                 and Tempus Yield Shares (TYS) to Yield Bearing Tokens (YBT).
    /// @param principalAmount Number of Tempus Principal Shares (TPS) to redeem into the Yield Bearing Token (YBT)
    /// @param yieldAmount Number of Tempus Yield Shares (TYS) to redeem into the Yield Bearing Token (YBT)
    /// @param rate Exchange rate of the underlying pool from Yield Bearing Tokens to the underlying asset
    event Redeemed(address redeemer, uint256 principalAmount, uint256 yieldAmount, uint256 rate);

    /// @return The version of the pool.
    function version() external returns (uint);

    /// @return The underlying yield bearing token.
    /// @dev This token will be used as a token that user can deposit to mint same amounts
    /// of principal and interest shares.
    function yieldBearingToken() external returns (address);

    /// @return This TempusPool's Tempus Principal Share (TPS)
    function principalShare() external returns (IERC20);

    /// @return This TempusPool's Tempus Yield Share (TYS)
    function yieldShare() external returns (IERC20);

    /// @return Start time of the pool.
    function startTime() external returns (uint256);

    /// @return Maturity time of the pool.
    function maturityTime() external returns (uint256);

    /// @return True if maturity has been reached and the pool was finalized.
    function matured() external returns (bool);

    /// Finalize the pool. This can only happen on or after `maturityTime`.
    /// Once finalized depositing is not possible anymore, and the behaviour
    /// redemption will change.
    ///
    /// Can be called by anyone and can be called multiple times.
    function finalize() external;

    /// @dev Deposits yield bearing tokens (such as cDAI) into TempusPool
    ///      msg.sender must approve `yieldTokenAmount` to this TempusPool
    /// @notice Deposit will fail if maturity has been reached.
    /// @param yieldTokenAmount Amount of yield bearing tokens to deposit
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return Amount of TPS and TYS minted to `recipient`
    function deposit(uint256 yieldTokenAmount, address recipient) external returns (uint256);

    /// @dev Redeem yield bearing tokens from this TempusPool
    ///      msg.sender will receive the YBT
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem for YBT
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem for YBT
    /// @return Amount of Yield Bearing Tokens redeemed to `msg.sender`
    function redeem(uint256 principalAmount, uint256 yieldAmount) external returns (uint256);

    /// The current exchange rate of yield bearing token versus its backing.
    /// @return The rate.
    function currentExchangeRate() external view returns (uint256);

    /// Initial exchange rate of Yield Bearing Token versus Backing Token
    function initialExchangeRate() external view returns (uint256);

    /// @return Rate of exchanging one Tempus Yield Share into Yield Bearing Token
    function pricePerYieldShare() external view returns (uint256);
}
