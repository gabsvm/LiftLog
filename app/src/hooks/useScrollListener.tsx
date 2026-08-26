import { useAppTheme } from '@/hooks/useAppTheme';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  ColorValue,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useAnimatedValue,
} from 'react-native';

type ScrollContextValues = {
  isScrolled: boolean;
  setScrolled: (_: boolean) => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const noopScrollHandler = (_event: NativeSyntheticEvent<NativeScrollEvent>) => {};

// Create a context with default value
const ScrollContext = createContext<ScrollContextValues>({
  isScrolled: false,
  setScrolled: (_: boolean) => {},
  handleScroll: noopScrollHandler,
});

type ScrollProviderCallbackProps =
  | {
      setScrolled: (scroll: boolean) => void;
      isScrolled: boolean;
    }
  | {
      setScrolled?: undefined;
      isScrolled?: undefined;
    };

type ScrollProviderProps = {
  children: ReactNode;
} & ScrollProviderCallbackProps;

export const ScrollProvider = ({
  children,
  isScrolled: isScrolledOverride,
  setScrolled: setScrolledOverride,
}: ScrollProviderProps) => {
  const [isScrolledGlobal, setScrolledGlobal] = useState(false);
  const value = useMemo<ScrollContextValues>(
    () => ({
      isScrolled: isScrolledOverride ?? isScrolledGlobal,
      setScrolled: setScrolledOverride ?? setScrolledGlobal,
      handleScroll: noopScrollHandler,
    }),
    [isScrolledGlobal, isScrolledOverride, setScrolledOverride],
  );

  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>;
};

export const useScroll = (invertedScroll?: boolean): ScrollContextValues => {
  const ctx = useContext(ScrollContext);
  const scrollHandlerLastFired = useRef<boolean | undefined>(undefined);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      const scrollHeight = contentHeight - layoutHeight;
      const isScrolled = invertedScroll ? offsetY < scrollHeight : offsetY > 0;
      if (scrollHandlerLastFired.current === isScrolled) {
        return;
      }
      scrollHandlerLastFired.current = isScrolled;
      ctx.setScrolled(isScrolled);
    },
    [ctx, invertedScroll],
  );

  return useMemo(
    () => ({
      ...ctx,
      handleScroll,
    }),
    [ctx, handleScroll],
  );
};

export const useScrollHeaderColor = (): ColorValue => {
  const { isScrolled } = useScroll();
  const { colors } = useAppTheme();
  const scrollColor = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(scrollColor, {
      toValue: isScrolled ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // color interpolation can't use native driver
    }).start();
  }, [isScrolled, scrollColor]);

  const backgroundColor = scrollColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface, colors.surfaceContainer],
  }) as unknown as ColorValue;

  return backgroundColor;
};
