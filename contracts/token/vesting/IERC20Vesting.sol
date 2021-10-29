// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity 0.8.6;

interface IERC20Vesting {
    /// @dev Vesting Terms for ERC tokens
    struct VestingTerms {
        /// @dev startTime for vesting
        uint256 startTime;
        /// @dev vesting Period
        uint256 period;
        /// @dev total amount of tokens to vest over period
        uint256 amount;
        /// @dev how much was claimed so far
        uint256 claimed;
    }

    /// A new vesting receiver was added.
    event VestingAdded(address indexed receiver, VestingTerms terms);

    /// An existing vesting receiver was removed.
    event VestingRemoved(address indexed receiver);

    /// An existing vesting receiver's address has changed.
    event VestingTransferred(address indexed oldReceiver, address newReceiver);

    /// Some portion of the available amount was claimed by the vesting receiver.
    event VestingClaimed(address indexed receiver, address to, uint256 value);

    /// @return Address of account that starts and stops vesting for different parties
    function wallet() external view returns (address);

    /// @return Address of token that is being vested
    function token() external view returns (IERC20);

    /// @dev Returns terms on which particular reciever is getting vested tokens
    /// @param receiver Address of beneficiary
    /// @return Vesting terms of particular receiver
    function getVestingTerms(address receiver) external view returns (VestingTerms memory);

    /// @dev Adds new account for vesting
    /// @param receiver Beneficiary for vesting tokens
    /// @param terms Vesting terms for particular receiver
    function startVesting(address receiver, VestingTerms calldata terms) external;

    /// @dev Adds multiple accounts for vesting
    /// Arrays need to be of same length
    /// @param receivers Beneficiaries for vesting tokens
    /// @param terms Vesting terms for all accounts
    function startVestingBatch(address[] calldata receivers, VestingTerms[] calldata terms) external;

    /// @dev Transfers tokens to a given address
    /// @param to Address of token receiver
    /// @param value Number of tokens to claim
    function claim(address to, uint256 value) external;

    /// @dev Transfers vesting schedule from `msg.sender` to new address
    /// A receiver cannot have an existing vesting schedule.
    /// @param receiver Address for new token receiver
    function transferVesting(address receiver) external;

    /// @dev Stops vesting for receiver and sends all tokens back to wallet
    /// @param receiver Address of account for which we are stopping vesting
    function stopVesting(address receiver) external;

    /// @dev Calculates the maximum amount of vested tokens that can be claimed for particular address
    /// @param receiver Address of token receiver
    /// @return Number of vested tokens one can claim
    function claimable(address receiver) external view returns (uint);
}
