// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../amm/interfaces/ITempusAMM.sol";
import "../token/IPoolShare.sol";
import "../ITempusPool.sol";

contract TempusVault{
    constructor() {}

    /// TODO:
    /// 1. keeper.network integration ?
    /// 2. impose transfer limits (unless pool has matured)
    /// 3. implement min transfer limits (if only a tiny amount needs to be transferred
    ///             between pools to reach a balanced state, just don't do it.)
    function rebalance(ITempusAMM[] calldata amms) public {
        require(msg.sender == tx.origin, "contract calls are not allowed");
        require(amms.length > 0); /// TODO: IMPORTANT error msg
        require(amms.length <= 5); /// TODO: IMPORTANT error msg
        
        uint256[] memory ammsLiquidity = new uint256[](amms.length);
        for (uint256 i = 0; i < amms.length; i++) {
            ITempusAMM amm = amms[i];
            ITempusPool pool = amm.tempusPool();
                
            /// TODO: IMPORTANT verify all backingTokens match
        }
    }

    function calculateAmmValue(ITempusAMM amm) private view returns (uint256) {
        ITempusPool pool = amm.tempusPool();

        /// TODO: IMPORTANT maybe use the Balancer Vault to query these
        uint256 principalBalance = IERC20(address(pool.principalShare())).balanceOf(address(amm));
        uint256 yieldBalance = IERC20(address(pool.yieldShare())).balanceOf(address(amm));
    
        uint256 ybtValue = pool.estimatedRedeem(principalBalance, yieldBalance, false);
        return ybtValue;
    }
}
