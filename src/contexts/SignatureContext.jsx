import React, { useState, createContext, useContext } from 'react';
import { ethers } from 'ethers';
import * as ecies from 'eciesjs';
import clsx from 'clsx';

// ■■■ Logic Control ■■■

// We use a Context to keep the key in memory without saving to disk
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [privateKey, setPrivateKey] = useState(null); // Stays in RAM only

  const login = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // We use your template with a dynamic nonce (e.g., date or counter)
    const message = "Sign to access my private emails on SecureMail dApp (v1). Only sign this on https://securemail.io. nonce: 12345";
    
    const signature = await signer.signMessage(message);
    const seed = ethers.utils.keccak256(signature);
    
    // Create the ECIES private key
    const derivedKey = new ecies.PrivateKey(ethers.utils.arrayify(seed));
    
    setPrivateKey(derivedKey); // Now available to the whole app
  };

  return (
    <AuthContext.Provider value={{ privateKey, login }}>
      {children}
    </AuthContext.Provider>
  );
};

// ■■■ Component View ■■■

export const SecureScreen = () => {
  const { privateKey, login } = useContext(AuthContext);

  return (
    <div className={clsx("vault-gate", privateKey && "vault-gate--unlocked")}>
      {!privateKey ? (
        <div className="vault-gate__locked">
          <p className="vault-gate__text">Your inbox is encrypted. Unlock it with your wallet.</p>
          <button className="vault-gate__btn" onClick={login}>
            Unlock Secure Vault
          </button>
        </div>
      ) : (
        <div className="vault-gate__unlocked">
          <p>Vault Active. Keys are currently in memory.</p>
          {/* Email components go here */}
        </div>
      )}
    </div>
  );
};