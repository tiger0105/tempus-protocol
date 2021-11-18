// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./StakingToken.sol";
import "../TempusToken.sol";
import "../../utils/Ownable.sol";

contract TempusStaking is Ownable {
    event Staked(address account, uint256 depositedAmount, uint256 stakeIssued);
    event Unstaked(address account, uint256 withdrawnAmount, uint256 stakeRevoked);
    event Lockup(address account, uint256 lockupEnd);

    TempusToken public immutable tempusToken;
    StakingToken public immutable stakingToken;

    mapping(address => uint256) public lockups;

    constructor(TempusToken _tempusToken, StakingToken _stakingToken) {
        tempusToken = _tempusToken;
        stakingToken = _stakingToken;
    }

    function join(uint256 amount, uint256 lockupEnd) external {
        require(tempusToken.balanceOf(msg.sender) >= amount, "Insufficient balance.");
        require(tempusToken.transferFrom(msg.sender, address(this), amount), "Transfer failed.");

        uint256 rate = exchangeRate();
        assert(rate != 0);

        uint256 issuedTokens = amount * rate;

        stakingToken.mint(msg.sender, issuedTokens);

        _lockup(msg.sender, lockupEnd);

        emit Staked(msg.sender, amount, issuedTokens);
    }

    function leave(uint256 amount) external {
        require(lockups[msg.sender] < block.timestamp, "Still locked");

        // TODO: implement
        assert(false);
    }

    function extendLockup(uint256 lockupEnd) external {
        _lockup(msg.sender, lockupEnd);
    }

    function _lockup(address account, uint256 lockupEnd) internal {
        require(lockups[account] <= lockupEnd, "Cannot shorten lockup");
        if (lockupEnd < block.timestamp) {
            // This is to uniformize the timestamp, but is not strictly needed.
            lockupEnd = 0;
        }
        if (lockupEnd != 0) {
            emit Lockup(account, lockupEnd);
        }
        lockups[account] = lockupEnd;
    }

    /// The exchange rate is the rate between the total outstanding stTEMP and balance of TEMP
    /// at the staking contract.
    ///
    /// Since this checks total supply of stTEMP, any user-initated burning increases the returns.
    /// Since this checks total balance sent to staking, any donations sent increases the returns.
    function exchangeRate() public view returns (uint256) {
        // TODO: check edge cases
        uint256 underlyingBalance = tempusToken.balanceOf(address(this));
        uint256 totalSupply = stakingToken.totalSupply();
        // TODO: handle negative rate
        require(underlyingBalance >= totalSupply, "Negative yield");
        return underlyingBalance / totalSupply;
    }
}
