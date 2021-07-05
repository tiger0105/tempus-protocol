module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy('TempusToken', {
    from: deployer,
    args: [100000000],
    log: true,
  });
};