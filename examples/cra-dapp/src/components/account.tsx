import { useDisconnect } from '@fuel-wallet/react';
import Button from './button';
import Feature from './feature';

type Props = { address: string };

export default function ConnectedAccount(props: Props) {
  const { address } = props;

  const { disconnect } = useDisconnect();

  return (
    <Feature title="Connected account">
      <code>{truncAddressMiddle(address)}</code>
      <Button onClick={() => disconnect()} loadingText="Disconnecting...">
        Disconnect
      </Button>
    </Feature>
  );
}

function truncAddressMiddle(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
