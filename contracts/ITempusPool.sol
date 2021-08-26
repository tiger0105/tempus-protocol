// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "./token/IPoolShare.sol";

/// @author The tempus.finance team
/// @title The interface of a Tempus Pool
interface ITempusPool {
    struct FeesConfig {
        uint256 depositPercent;
        uint256 earlyRedeemPercent;
        uint256 matureRedeemPercent;
    }

    /// @return The version of the pool.
    function version() external view returns (uint);

    /// @return The name of underlying protocol, for example "Aave" for Aave protocol
    function protocolName() external view returns (bytes32);

    /// @return The underlying yield bearing token.
    /// @dev This token will be used as a token that user can deposit to mint same amounts
    /// of principal and interest shares.
    function yieldBearingToken() external view returns (address);

    /// @dev This is the address of the actual backing asset token
    ///      in the case of ETH, this address will be 0
    /// @return Address of the Backing Token
    function backingToken() external view returns (address);

    /// @return This TempusPool's Tempus Principal Share (TPS)
    function principalShare() external view returns (IPoolShare);

    /// @return This TempusPool's Tempus Yield Share (TYS)
    function yieldShare() external view returns (IPoolShare);

    /// @return The TempusController address that is authorized to perform restricted actions
    function controller() external view returns (address);

    /// @return Start time of the pool.
    function startTime() external view returns (uint256);

    /// @return Maturity time of the pool.
    function maturityTime() external view returns (uint256);

    /// @return True if maturity has been reached and the pool was finalized.
    function matured() external view returns (bool);

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
    /// @return mintedShares Amount of TPS and TYS minted to `recipient`
    /// @return depositedBT The YBT value deposited, denominated as Backing Tokens
    /// @return rate The interest rate at the time of the deposit
    function deposit(uint256 yieldTokenAmount, address recipient)
        external
        returns (
            uint256 mintedShares,
            uint256 depositedBT,
            uint256 rate
        );

    /// @dev Deposits backing token to the underlying protocol, and then to Tempus Pool.
    /// @param backingTokenAmount amount of Backing Tokens to be deposit into the underlying protocol
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return mintedShares Amount of TPS and TYS minted to `recipient`
    /// @return depositedYBT The BT value deposited, denominated as Yield Bearing Tokens
    /// @return rate The interest rate at the time of the deposit
    function depositBacking(uint256 backingTokenAmount, address recipient)
        external
        payable
        returns (
            uint256 mintedShares,
            uint256 depositedYBT,
            uint256 rate
        );

    /// @dev Redeem yield bearing tokens from this TempusPool
    ///      msg.sender will receive the YBT
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param from Address to redeem its Tempus Shares
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem for YBT
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem for YBT
    /// @param recipient Address to which redeemed YBT will be sent
    /// @return redeemableYieldTokens Amount of Yield Bearing Tokens redeemed to `recipient`
    /// @return redeemableBackingTokens Amount of Yield Bearing Tokens redeemed to `recipient`, denominated in BT
    /// @return rate The interest rate at the time of the redemption
    function redeem(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    )
        external
        returns (
            uint256 redeemableYieldTokens,
            uint256 redeemableBackingTokens,
            uint256 rate
        );

    /// @dev Redeem TPS+TYS held by msg.sender into backing tokens
    ///      `msg.sender` must approve TPS and TYS amounts to this TempusPool.
    ///      `msg.sender` will receive the backing tokens
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param from Address to redeem its Tempus Shares
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem
    /// @param recipient Address to which redeemed BT will be sent
    /// @return redeemableYieldTokens Amount of Backing Tokens redeemed to `recipient`, denominated in YBT
    /// @return redeemableBackingTokens Amount of Backing Tokens redeemed to `recipient`
    /// @return rate The interest rate at the time of the redemption
    function redeemToBacking(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    )
        external
        payable
        returns (
            uint256 redeemableYieldTokens,
            uint256 redeemableBackingTokens,
            uint256 rate
        );

    /// The current interest rate of the underlying pool
    /// Calling this can accrue interest in the underlying pool
    /// @return The interest rate
    function currentInterestRate() external view returns (uint256);

    /// @return Initial interest rate of the underlying pool
    function initialInterestRate() external view returns (uint256);

    /// @return Rate of one Tempus Yield Share expressed in Asset Tokens
    function pricePerYieldShare() external returns (uint256);

    /// @return Rate of one Tempus Principal Share expressed in Asset Tokens
    function pricePerPrincipalShare() external returns (uint256);

    /// @return Rate of one Tempus Yield Share expressed in Asset Tokens,
    /// @dev calculated with stored interest rates
    function pricePerYieldShareStored() external view returns (uint256);

    /// @return Rate of one Tempus Principal Share expressed in Asset Tokens
    /// @dev calculated with stored interest rates
    function pricePerPrincipalShareStored() external view returns (uint256);

    /// Returns the current fee configuration.
    function feesConfig()
        external
        view
        returns (
            uint256 depositPercent,
            uint256 earlyRedeemPercent,
            uint256 matureRedeemPercent
        );

    /// Replace the current fee configuration with a new one.
    function setFeesConfig(FeesConfig calldata newFeesConfig) external;
}
