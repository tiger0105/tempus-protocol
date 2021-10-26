import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { NumberOrString, parseDecimal, formatDecimal, MAX_NUMBER_DIGITS, DecimalConvertible } from "./Decimal";
import * as signers from "@nomiclabs/hardhat-ethers/dist/src/signers";

export type Signer = signers.SignerWithAddress;
export type SignerOrAddress = Signer|string;

/** @return Address field from signer or address string */
export function addressOf(signer:SignerOrAddress) {
  if (typeof(signer) === "string")
    return signer;
  if (signer.address)
    return signer.address;
  throw new Error("Invalid signer (no address): " + signer);
}

/**
 * Base class for Any contract
 * Contains several utilities for deploying, attaching and type conversions
 */
export abstract class ContractBase extends DecimalConvertible
{
  contractName:string;
  contract:Contract;
  address:string; // address of the contract, `this.contract.address`

  constructor(contractName:string, decimals:number, contract?:Contract) {
    super(decimals);
    if (!contractName)
      throw new Error("`contractName` cannot be empty or null");
    this.contractName = contractName;
    this.contract = contract!;
    this.address = contract ? contract.address : '0x0';
  }

  protected initialize(contract:Contract) {
    if (!contract)
      throw new Error("`contract` cannot be null");
    this.contract = contract;
    this.address = contract.address;
  }
  
  /** Connects a user to the contract, so that transactions can be sent by the user */
  connect(user:SignerOrAddress): Contract {
    return this.contract.connect(user);
  }

  /**
   * Deploy a contract of any type
   * @param contractName Name of the solidity contract
   * @param args... Optional arguments for the deployed contract
   */
  static async deployContract(contractName:string, ...args: any[]): Promise<Contract> {
    const factory = await ethers.getContractFactory(contractName);
    return await factory.deploy(...args);
  }

  /**
   * Deploy a contract of any type by Deployer user
   * @param contractName Name of the solidity contract
   * @param deployer User who deploys this contract and is marked as `msg.sender` in contract constructor
   * @param args... Optional arguments for the deployed contract
   */
  static async deployContractBy(contractName:string, deployer:Signer, ...args: any[]): Promise<Contract> {
    const factory = await ethers.getContractFactory(contractName, deployer);
    return await factory.deploy(...args);
  }

  /**
   * Attaches to any contract address
   * @param contractName Name of the solidity contract
   * @param contractAddress Address of the contract
   */
  static async attachContract(contractName:string, contractAddress:string): Promise<Contract> {
    const factory = await ethers.getContractFactory(contractName);
    return await factory.attach(contractAddress);
  }
}
