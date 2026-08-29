import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

const TabBarHiddenContext = createContext(false);
const TabBarHiddenCountSetterContext = createContext<
  Dispatch<SetStateAction<number>> | undefined
>(undefined);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hiddenCount, setHiddenCount] = useState(0);

  return (
    <TabBarHiddenCountSetterContext.Provider value={setHiddenCount}>
      <TabBarHiddenContext.Provider value={hiddenCount > 0}>
        {children}
      </TabBarHiddenContext.Provider>
    </TabBarHiddenCountSetterContext.Provider>
  );
}

export function useTabBarHidden() {
  return useContext(TabBarHiddenContext);
}

export function useHideTabBarWhileFocused() {
  const setHiddenCount = useContext(TabBarHiddenCountSetterContext);

  useFocusEffect(
    useCallback(() => {
      setHiddenCount?.((count) => count + 1);
      return () =>
        setHiddenCount?.((count) => Math.max(0, count - 1));
    }, [setHiddenCount]),
  );
}
