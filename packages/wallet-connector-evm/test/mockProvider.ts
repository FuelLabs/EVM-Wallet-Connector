import {
  bytesToHex,
  ecsign,
  hashPersonalMessage,
  hexToBytes,
  privateToAddress,
  randomBytes,
  toRpcSig
} from '@ethereumjs/util';
import EventEmitter from 'events';

type ProviderSetup = {
  address: string;
  privateKey: string;
  networkVersion: number;
  debug?: boolean;
  manualConfirmEnable?: boolean;
};

interface IMockProvider {
  request(args: {
    method: 'eth_accounts';
    params: string[];
  }): Promise<string[]>;
  request(args: {
    method: 'eth_requestAccounts';
    params: string[];
  }): Promise<string[]>;
  request(args: {
    method: 'wallet_requestPermissions';
    params: string[];
  }): Promise<string[]>;

  request(args: { method: 'net_version' }): Promise<number>;
  request(args: { method: 'eth_chainId'; params: string[] }): Promise<string>;

  request(args: { method: 'personal_sign'; params: string[] }): Promise<string>;
  request(args: { method: 'eth_decrypt'; params: string[] }): Promise<string>;

  request(args: { method: string; params?: any[] }): Promise<any>;
}

// eslint-disable-next-line import/prefer-default-export
export class MockProvider extends EventEmitter implements IMockProvider {
  private accounts: { address: string; privateKey: Uint8Array }[] = [];
  private connected = false;

  public debug = false;

  public isMetaMask = true;
  public manualConfirmEnable = false;

  private acceptEnable?: (value: unknown) => void;

  private rejectEnable?: (value: unknown) => void;

  constructor(numAccounts = 3) {
    super();
    for (let i = 0; i < numAccounts; i += 1) {
      // const privateKey = randomBytes(32);
      const privateKey = hexToBytes(
        '0x96dfa8c25bdae93fa0b6460079f8bb18aaec70c8451b5e32251cbc22f0dbf308'
      );
      const address = bytesToHex(privateToAddress(privateKey));
      this.accounts.push({ address, privateKey: privateKey });
    }
  }

  // eslint-disable-next-line no-console
  private log = (...args: (any | null)[]) =>
    this.debug && console.log('🦄', ...args);

  get selectedAddress(): string {
    return this.accounts[0]!.address;
  }

  get networkVersion(): number {
    return 1;
  }

  get chainId(): string {
    return `0x${(1).toString(16)}`;
  }

  answerEnable(acceptance: boolean) {
    if (acceptance) this.acceptEnable!('Accepted');
    else this.rejectEnable!('User rejected');
  }

  getAccounts(): string[] {
    return this.accounts.map(({ address }) => address);
  }

  async request({ method, params }: any): Promise<any> {
    this.log(`request[${method}]`);

    switch (method) {
      case 'eth_requestAccounts':
        if (this.manualConfirmEnable) {
          return new Promise((resolve, reject) => {
            this.acceptEnable = resolve;
            this.rejectEnable = reject;
          }).then(() => this.accounts.map(({ address }) => address));
        }
        this.connected = true;
        return this.accounts.map(({ address }) => address);

      case 'wallet_requestPermissions':
        if (this.manualConfirmEnable) {
          return new Promise((resolve, reject) => {
            this.acceptEnable = resolve;
            this.rejectEnable = reject;
          }).then(() => this.accounts.map(({ address }) => address));
        }
        this.connected = true;
        return this.accounts.map(({ address }) => address);

      case 'eth_accounts':
        return this.connected ? this.getAccounts() : [];

      case 'net_version':
        return this.networkVersion;

      case 'eth_chainId':
        return this.chainId;

      case 'personal_sign': {
        const [message, address] = params;
        const account = this.accounts.find((a) => a.address === address);
        if (!account) throw new Error('Account not found');

        const hash = hashPersonalMessage(hexToBytes(message));
        const signed = ecsign(hash, account.privateKey);
        const signedStr = toRpcSig(signed.v, signed.r, signed.s);

        return signedStr;
      }

      case 'eth_sendTransaction': {
        throw new Error('This service can not send transactions.');
      }

      default:
        this.log(`requesting missing method ${method}`);
        // eslint-disable-next-line prefer-promise-reject-errors
        throw new Error(
          `The method ${method} is not implemented by the mock provider.`
        );
    }
  }

  sendAsync(props: { method: string }, cb: any) {
    switch (props.method) {
      case 'eth_accounts':
        cb(null, { result: [this.getAccounts()] });
        break;

      case 'net_version':
        cb(null, { result: this.networkVersion });
        break;

      default:
        this.log(`Method '${props.method}' is not supported yet.`);
    }
  }

  on(props: string, listener: (...args: any[]) => void) {
    super.on(props, listener);
    this.log('registering event:', props);
    return this;
  }

  removeAllListeners() {
    super.removeAllListeners();
    this.log('removeAllListeners', null);
    return this;
  }
}
