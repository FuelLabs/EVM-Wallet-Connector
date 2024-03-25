import { FuelProvider } from '@fuel-wallet/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { EVMWalletConnector } from '@fuels/wallet-connector-evm';
import * as Toast from '@radix-ui/react-toast';

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import ScreenSizeIndicator from './components/screensize-indicator';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <FuelProvider
      // devMode is used to show Connectors that are focused on development versions
      // like Fuel Wallet Development
      fuelConfig={{
        devMode: true,
        connectors: [new EVMWalletConnector()]
      }}
    >
      <Toast.Provider>
        <App />
        <Toast.Viewport
          id="toast-viewport"
          className="fixed bottom-0 right-0 z-[100] m-0 flex w-[420px] max-w-[100vw] list-none flex-col gap-[10px] p-[var(--viewport-padding)] outline-none [--viewport-padding:_25px]"
        />
      </Toast.Provider>
      <ScreenSizeIndicator />
    </FuelProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
