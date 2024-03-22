import { useDisconnect } from '@fuel-wallet/react';
import Button from './button';
import Feature from './feature';

type Props = { address: string };

export default function ConnectedAccount(props: Props) {
  const { address } = props;

  const { disconnect } = useDisconnect();

  return (
    <Feature title="Connected Account">
      <code className="block md:hidden">{truncAddressMiddle(address, 4)}</code>
      <code className="hidden md:block">{truncAddressMiddle(address, 8)}</code>
      <Button onClick={() => disconnect()} loadingText="Disconnecting...">
        Disconnect
      </Button>
    </Feature>
  );
}

function truncAddressMiddle(address: string, size: number) {
  if (!address) return '';
  return `${address.slice(0, size)}...${address.slice(-size)}`;
}
