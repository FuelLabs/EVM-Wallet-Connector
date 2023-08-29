import type {
  AbiMap,
  Asset,
  FuelEventArg,
  FuelProviderConfig,
  FuelEvents,
  Network,
} from '@fuel-wallet/types';
import { FuelWalletConnection } from '@fuel-wallet/sdk';
import { JsonAbi, TransactionRequestLike } from 'fuels';

class Web3Wallet extends FuelWalletConnection {
    async isConnected(): Promise<boolean> {

    }
    
    async connect(): Promise<boolean> {

    }
    
    async disconnect(): Promise<boolean> {

    }
    
    async accounts(): Promise<Array<string>> {

    }
    
    async currentAccount(): Promise<string> {

    }
    
    async signMessage(address: string, message: string): Promise<string> {

    }
    
    async sendTransaction(
      transaction: TransactionRequestLike & { signer?: string },
      providerConfig: FuelProviderConfig,
      signer?: string
    ): Promise<string> {

    }
    
    async assets(): Promise<Array<Asset>> {

    }
    
    async addAsset(asset: Asset): Promise<boolean> {
      
    }
    
    async addAssets(assets: Asset[]): Promise<boolean> {
      
    }
    
    async addAbi(abiMap: AbiMap): Promise<boolean> {
      
    }
    
    async getAbi(contractId: string): Promise<JsonAbi> {
      
    }
    
    async hasAbi(contractId: string): Promise<boolean> {
      
    }
    
    async network(): Promise<FuelProviderConfig> {
      
    }
    
    async networks(): Promise<FuelProviderConfig[]> {
      
    }
    
    async addNetwork(network: Network): Promise<boolean> {
      
    }
    
    on<E extends FuelEvents['type'], D extends FuelEventArg<E>>(
      eventName: E,
      listener: (data: D) => void
    ): this {
      return super.on(eventName, listener);
    }
}
