import { useBalance, useWallet } from '@fuel-wallet/react';
import { bn } from 'fuels';
import { useEffect } from 'react';

export const DEFAULT_AMOUNT = bn.parseUnits('0.001');

export default function Balance() {
  const { wallet, refetch } = useWallet();
  const { balance } = useBalance({
    address: wallet?.address.toString()
  });

  useEffect(() => {
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const hasBalance = balance && balance.gte(DEFAULT_AMOUNT);

  return (
    <div id="balance">
      <h3 className="text-sm font-medium text-gray-400/80">Balance</h3>
      <div className="flex items-center justify-between">
        <code>{balance?.format() || '0'} ETH</code>
        {!hasBalance && (
          <a
            href={`https://faucet-beta-5.fuel.network/?address=${wallet?.address.toString()}`}
            target="_blank"
            className="btn btn-primary"
          >
            Get coins
          </a>
        )}
        {hasBalance && (
          <button className="btn btn-primary" disabled>
            Get coins
          </button>
        )}
      </div>
    </div>
  );
}
