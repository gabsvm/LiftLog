import { useFocusEffect } from 'expo-router';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useState,
} from 'react';

const TabBarHiddenContext = createContext(false);
const TabBarVisibilitySetterContext = createContext<
  Dispatch<SetStateAction<boolean>> | undefined
>(undefined);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <TabBarVisibilitySetterContext.Provider value={setHidden}>
      <TabBarHiddenContext.Provider value={hidden}>
        {children}
      </TabBarHiddenContext.Provider>
    </TabBarVisibilitySetterContext.Provider>
  );
}

export function useTabBarHidden() {
  return useContext(TabBarHiddenContext);
}

export function useHideTabBarWhileFocused() {
  const setHidden = useContext(TabBarVisibilitySetterContext);

  useFocusEffect(
    useCallback(() => {
      setHidden?.(true);
      return () => setHidden?.(false);
    }, [setHidden]),
  );
}
