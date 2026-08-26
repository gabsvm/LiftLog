import { useAppTheme } from '@/hooks/useAppTheme';
import { useScroll } from '@/hooks/useScrollListener';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, useState } from 'react';
import { View, StyleProp, ViewStyle, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FullHeightScrollView({
  children,
  floatingChildren,
  scrollStyle,
  avoidKeyboard,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  floatingChildren?: React.ReactNode;
  avoidKeyboard?: boolean;
  scrollStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const { handleScroll } = useScroll();
  const [floatingBottomSize, setFloatingBottomSize] = useState(0);
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext); // Intentionally don't use useHeaderHeight as it might not be in a stack

  // Headerless Android screens need a fixed viewport inset. Putting this as a
  // spacer inside the ScrollView lets content scroll underneath the status bar.
  const androidTopInset =
    Platform.OS === 'android' && !headerHeight ? insets.top : 0;
  // Preserve the existing iOS header compensation behavior.
  const scrollTopInset = Platform.OS === 'ios' ? (headerHeight ?? 0) : 0;
  const bottomInsetHeight =
    floatingBottomSize + (Platform.select({ ios: insets.bottom }) ?? 0);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        flex: 1,
        paddingTop: androidTopInset,
      }}
    >
      {!avoidKeyboard ? (
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={32}
          style={[{ flex: 1 }, scrollStyle]}
          contentContainerStyle={[contentContainerStyle]}
        >
          {scrollTopInset > 0 ? <View style={{ height: scrollTopInset }} /> : null}
          {children}
          <View style={{ height: bottomInsetHeight }} />
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          // @ts-expect-error -- Scrollview keeps flitting between compat and not
          ScrollViewComponent={ScrollView}
          onScroll={handleScroll}
          scrollEventThrottle={32}
          style={[{ flex: 1 }, scrollStyle]}
          contentContainerStyle={[contentContainerStyle]}
        >
          {scrollTopInset > 0 ? <View style={{ height: scrollTopInset }} /> : null}
          {children}
          <View style={{ height: bottomInsetHeight }} />
        </KeyboardAwareScrollView>
      )}
      {floatingChildren && (
        <View
          onLayout={(event) =>
            setFloatingBottomSize(event.nativeEvent.layout.height)
          }
          style={{
            position: 'absolute',
            bottom: Platform.select({ ios: insets.bottom }) ?? 0,
            width: '100%',
          }}
        >
          {floatingChildren}
        </View>
      )}
    </View>
  );
}
