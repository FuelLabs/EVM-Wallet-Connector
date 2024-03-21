import { useEffect, useState } from 'react';
import { useWallet, useBalance } from '@fuel-wallet/react';
import { bn, Address, BaseAssetId } from 'fuels';
import { DEFAULT_AMOUNT } from './balance';

const DEFAULT_ADDRESS = Address.fromRandom().toString();

type Props = { address: string };

export default function Transfer(props: Props) {
  const { address } = props;

  const [receiver, setReceiver] = useState(DEFAULT_ADDRESS);
  const [isLoading, setLoading] = useState(false);
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
      //   const receiverAddress = prompt('Receiver address', DEFAULT_ADDRESS);
      const receiverAddress = Address.fromString(receiver || DEFAULT_ADDRESS);
      const resp = await wallet?.transfer(
        receiverAddress,
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

  return (
    <div id="transfer">
      <h3 className="pb-0.5 text-sm font-medium text-gray-400/80">Transfer</h3>
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Receiver address"
          value={receiver}
          onChange={(e) => setReceiver(e.target.value)}
          className="mr-6 w-2/3 shrink basis-2/3 bg-gray-50 p-2 font-mono outline-none dark:bg-gray-900/30 dark:text-gray-50"
        />

        <button
          onClick={() => handleTransfer()}
          disabled={isLoading || !hasBalance}
          className="btn btn-primary shrink-0"
        >
          {isLoading
            ? 'Transferring...'
            : `Transfer ${DEFAULT_AMOUNT.format()} ETH`}
        </button>
      </div>
    </div>
  );
}
