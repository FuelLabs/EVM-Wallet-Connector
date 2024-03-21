import { useEffect, useState } from 'react';
import { useWallet, useBalance } from '@fuel-wallet/react';
import { CounterContractAbi__factory } from '../contracts';
import { bn, Address, BaseAssetId } from 'fuels';
import { COUNTER_CONTRACT_ID } from './counter';
import { DEFAULT_AMOUNT } from './balance';

const DEFAULT_ADDRESS = Address.fromRandom().toString();

export default function AccountItem({ address }: { address: string }) {
  const [isLoading, setLoading] = useState(false);
  const [isLoadingCall, setLoadingCall] = useState(false);
  const { balance, refetch } = useBalance({
    address
  });
  const { wallet } = useWallet(address);
  const hasBalance = balance && balance.gte(DEFAULT_AMOUNT);

  useEffect(() => {
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  async function handleTransfer() {
    setLoading(true);
    try {
      const receiverAddress = prompt('Receiver address', DEFAULT_ADDRESS);
      const receiver = Address.fromString(receiverAddress || DEFAULT_ADDRESS);
      const resp = await wallet?.transfer(
        receiver,
        DEFAULT_AMOUNT,
        BaseAssetId,
        {
          gasPrice: 1,
          gasLimit: 10_000
        }
      );
      const result = await resp?.waitForResult();
      console.log(result?.status);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  // async function increment() {
  //   if (wallet) {
  //     setLoadingCall(true);
  //     const contract = CounterContractAbi__factory.connect(
  //       COUNTER_CONTRACT_ID,
  //       wallet
  //     );
  //     try {
  //       await contract.functions
  //         .increment()
  //         .txParams({ gasPrice: 1, gasLimit: 100_000 })
  //         .call();
  //     } catch (err) {
  //       console.log('error sending transaction...', err);
  //     } finally {
  //       setLoadingCall(false);
  //     }
  //   }
  // }

  return (
    <div className="AccountItem">
      <div className="AccountColumns">
        <span>
          <b>Account:</b> {address}{' '}
        </span>
        <span>
          <b>Balance:</b> {balance?.format() || '0'} ETH
        </span>
      </div>
      <div className="accountActions">
        {!hasBalance && (
          <a
            href={`https://faucet-beta-5.fuel.network/?address=${address}`}
            target="_blank"
          >
            <button>Get some coins</button>
          </a>
        )}

        <button
          onClick={() => handleTransfer()}
          disabled={isLoading || !hasBalance}
        >
          {isLoading
            ? 'Transferring...'
            : `Transfer ${DEFAULT_AMOUNT.format()} ETH`}
        </button>
      </div>
    </div>
  );
}
