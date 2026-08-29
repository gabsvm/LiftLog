import { useFocusEffect } from 'expo-router';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';

const TabBarVisibilityContext = createContext<{
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
} | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <TabBarVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarHidden() {
  const context = useContext(TabBarVisibilityContext);
  return context?.hidden ?? false;
}

export function useHideTabBarWhileFocused() {
  const context = useContext(TabBarVisibilityContext);

  useFocusEffect(
    useCallback(() => {
      context?.setHidden(true);
      return () => context?.setHidden(false);
    }, [context]),
  );
}
