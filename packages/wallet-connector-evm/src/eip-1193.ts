import EventEmitter from 'events';

export interface EIP1193Provider extends EventEmitter {
  request(args: { method: string; params?: any[] }): Promise<any>;
}
