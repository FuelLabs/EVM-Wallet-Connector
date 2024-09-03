import { useBalance, useWallet } from '@fuel-wallet/react';
import { bn } from 'fuels';
import { useEffect } from 'react';
import Button from './button';
import Feature from './feature';

export const DEFAULT_AMOUNT = bn.parseUnits('0.001');

type Props = { address: string };

export default function Balance(props: Props) {
  const { address } = props;

  const { refetch } = useWallet(address);
  const { balance } = useBalance({ address });

  useEffect(() => {
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const hasBalance = balance && balance.gte(DEFAULT_AMOUNT);

  return (
    <Feature title="Balance">
      <code>{balance?.format() || '0'} ETH</code>
      {!hasBalance && (
        <a
          href={`https://faucet-beta-5.fuel.network/?address=${address}`}
          target="_blank"
          className="btn btn-primary"
        >
          Get coins
        </a>
      )}
      {hasBalance && <Button disabled>Get coins</Button>}
    </Feature>
  );
}
