import React, { createContext, useContext } from 'react';
const Ctx = createContext({ showAlert: () => {}, hideAlert: () => {} });
export const useAlert = () => useContext(Ctx);
export function AlertProvider({ children }) {
  return <Ctx.Provider value={{ showAlert: (msg) => window.alert(msg), hideAlert: () => {} }}>{children}</Ctx.Provider>;
}
export default Ctx;
