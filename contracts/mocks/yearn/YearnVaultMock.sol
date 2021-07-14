// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";
import "./IYearnVaultV2.sol";

contract YearnVaultMock is ERC20, IYearnVaultV2 {
    IERC20 private immutable token; // DAI
    uint256 public totalDebt; // represents

    constructor(IERC20 asset) ERC20("YToken", "YToken") {
        token = asset;
        totalDebt = 0;
    }
    
    /// @dev Deposits an `amount` of underlying asset into the reserve, receiving Vault Shares in return.
    /// - E.g. User deposits 10 DAI and gets in return X yDai
    /// @param amount The amount to be deposited
    function deposit(uint256 amount) public override{
        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = amount;
        } else {
            shares = (amount * totalSupply() / totalAssets());
        }
        
        token.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, shares);
    }

    function pricePerShare() public view override returns (uint256) {
        return shareValue(1e18);
    }

    function totalAssets() public view override returns (uint256) {
        return token.balanceOf(address(this)) + totalDebt;
    }

    /// @notice MOCK ONLY
    /// @dev Increases the price per share to a given target price by adjusting the totalDebt state variable
    /// @param targetPrice The desired target price per share
    function increasePricePerShare(uint256 targetPrice) public {
        uint256 totalSharesInCirculation = totalSupply();
        
        require(totalSharesInCirculation > 0, "setting the price is only possible after a deposit was made");
        require(targetPrice > pricePerShare(), "targetPrice must be greater than the current pricePerShare");
        
        totalDebt = (totalSharesInCirculation * targetPrice) / 1e18 - token.balanceOf(address(this));
    }

    function shareValue(uint256 shares) internal view returns (uint256) {
        uint256 totalSharesInCirculation = totalSupply();
        
        // Returns price = 1:1 if vault is empty
        if (totalSharesInCirculation == 0) {
            return shares;
        }

        return (shares * totalAssets() / totalSharesInCirculation);
    }
}
