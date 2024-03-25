import { useEffect, useState } from 'react';
import { useWallet, useBalance } from '@fuel-wallet/react';
import { Address, BaseAssetId } from 'fuels';
import { DEFAULT_AMOUNT } from './balance';
import Feature from './feature';
import Button from './button';

const DEFAULT_ADDRESS = Address.fromRandom().toString();

type Props = { address: string };

export default function Transfer(props: Props) {
  const { address } = props;

  const [receiver, setReceiver] = useState(DEFAULT_ADDRESS);
  const [isLoading, setLoading] = useState(false);
  const { balance, refetch } = useBalance({ address });
  const { wallet } = useWallet(address);

  const hasBalance = balance && balance.gte(DEFAULT_AMOUNT);

  useEffect(() => {
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <Feature title="Transfer">
      <input
        type="text"
        placeholder="Receiver address"
        value={receiver}
        onChange={(e) => setReceiver(e.target.value)}
        className="-ml-1 mr-2 mt-1 w-2/3 shrink basis-2/3 rounded-lg border border-zinc-500/25 p-1 font-mono outline-none md:-ml-2 md:mt-2 md:p-2 dark:bg-transparent"
      />

      <Button
        onClick={handleTransfer}
        disabled={isLoading || !hasBalance}
        className="mt-1 shrink-0 md:mt-2"
        loading={isLoading}
        loadingText="Transferring..."
      >
        {`Transfer ${DEFAULT_AMOUNT.format()} ETH`}
      </Button>
    </Feature>
  );

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
}
