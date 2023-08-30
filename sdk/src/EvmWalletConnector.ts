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
      return false;
    }
    
    async connect(): Promise<boolean> {
      return false;
    }
    
    async disconnect(): Promise<boolean> {
      return false;
    }
    
    async accounts(): Promise<Array<string>> {
      return [];
    }
    
    async currentAccount(): Promise<string> {
      return "Placeholder";
    }
    
    async signMessage(address: string, message: string): Promise<string> {
      return "Placeholder";
    }
    
    async sendTransaction(
      transaction: TransactionRequestLike & { signer?: string },
      providerConfig: FuelProviderConfig,
      signer?: string
    ): Promise<string> {
      return "Placeholder";
    }
    
    async assets(): Promise<Array<Asset>> {
      return [];
    }
    
    async addAsset(asset: Asset): Promise<boolean> {
      return false;
    }
    
    async addAssets(assets: Asset[]): Promise<boolean> {
      return false;
    }
    
    async addAbi(abiMap: AbiMap): Promise<boolean> {
      return false;
    }
    
    async getAbi(contractId: string): Promise<JsonAbi> {
      return {} as JsonAbi;
    }
    
    async hasAbi(contractId: string): Promise<boolean> {
      return false;
    }
    
    async network(): Promise<FuelProviderConfig> {
      return {} as FuelProviderConfig;
    }
    
    async networks(): Promise<FuelProviderConfig[]> {
      return {} as FuelProviderConfig[];
    }
    
    async addNetwork(network: Network): Promise<boolean> {
      return false;
    }
    
    // on<E extends FuelEvents['type'], D extends FuelEventArg<E>>(
    //   eventName: E,
    //   listener: (data: D) => void
    // ): this {
    //   return super.on(eventName, listener);
    // }
}
