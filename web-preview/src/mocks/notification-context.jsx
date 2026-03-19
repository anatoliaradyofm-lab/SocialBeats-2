import React, { createContext, useContext } from 'react';
const Ctx = createContext({ unreadCount: 0, notifications: [], markAsRead: () => {}, markAllAsRead: () => {}, refresh: () => {} });
export const useNotifications = () => useContext(Ctx);
export function NotificationProvider({ children }) {
  return <Ctx.Provider value={{ unreadCount: 3, notifications: [], markAsRead: () => {}, markAllAsRead: () => {}, refresh: () => {} }}>{children}</Ctx.Provider>;
}
export default Ctx;
