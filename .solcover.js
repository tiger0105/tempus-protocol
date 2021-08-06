module.exports = {
  skipFiles: [
    'mocks/lido/StETH.sol', // 1:1 with Lido, already tested by upstream
    'mocks/aave/WadRayMath.sol', // 1:1 with Aave, already tested by upstream
    'mocks/compound/CEther.sol', // TODO: remove CEther support
    'amm/Vault.sol', // Balancer implementation
    'amm/TempusAMMFactory.sol', // Balancer implementation
    'amm/StableMath.sol', // Balancer implementation
    'amm/TempusAMMUserDataHelpers.sol', // Balancer implementation
    'amm/Authorizer.sol' // Balancer implementation
  ]
};
