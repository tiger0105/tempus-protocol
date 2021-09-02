module.exports = {
  skipFiles: [
    'mocks/lido/StETH.sol', // 1:1 with Lido, already tested by upstream
    'mocks/aave/WadRayMath.sol', // 1:1 with Aave, already tested by upstream
    'amm/TempusAMMFactory.sol' // Balancer implementation
  ]
};
