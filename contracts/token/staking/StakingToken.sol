// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "../../utils/Ownable.sol";

/// Token representing a staking position.
contract StakingToken is Ownable, ERC20Votes {
    constructor() ERC20("Staked Tempus", "stTEMP") ERC20Permit("StakedTempus") {}

    /// Creates `amount` new tokens for `to`.
    /// @param account Recipient address to mint tokens to
    /// @param amount Number of tokens to mint
    function mint(address account, uint256 amount) external onlyOwner {
        require(account != address(0), "Can not mint to 0x0.");
        _mint(account, amount);
    }

    /// Destroys `amount` tokens from the caller.
    /// @param amount Number of tokens to burn.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }
}
