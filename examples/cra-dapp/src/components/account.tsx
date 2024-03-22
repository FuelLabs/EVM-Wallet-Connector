import { useDisconnect } from '@fuel-wallet/react';

type Props = { address: string };

export default function ConnectedAccount(props: Props) {
  const { address } = props;

  const { disconnect } = useDisconnect();

  return (
    <div id="account">
      <h3 className="text-sm font-medium text-gray-400/80">
        Connected accounts
      </h3>
      <div className="flex items-center justify-between">
        <code>{truncAddressMiddle(address)}</code>
        <button className="btn btn-primary" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    </div>
  );
}

function truncAddressMiddle(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
