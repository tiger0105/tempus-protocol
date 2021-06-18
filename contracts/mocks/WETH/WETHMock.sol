// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./../../token/ERC20OwnerMintableToken.sol";

contract WETHMock is ERC20OwnerMintableToken("WETHMock", "WETH") {
    function deposit() external payable {
        require(false);
    }

    function withdraw(uint256) external {
        require(false);
    }
}
