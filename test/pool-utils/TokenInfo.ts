
export interface TokenInfo {
    decimals:number;
    name:string;
    symbol:string;
    totalSupply?:number;
    deploymentName?:string; // name from git/deployments/mainnet/*.json
}
