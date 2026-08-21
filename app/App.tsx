import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initStorage } from './src/storage/kv';
import { connectAutoLaunchProfiles } from './src/mqtt/connectionManager';
import { startAppLifecycleWatcher } from './src/mqtt/appLifecycle';
import { AppNavigator } from './src/app/navigation';
import { ToastProvider } from './src/ui/Toast';
import { PromptModalHost } from './src/ui/PromptModal';
import { colors } from './src/ui/theme';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initStorage().then(() => {
      connectAutoLaunchProfiles();
      startAppLifecycleWatcher();
      setReady(true);
    });
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <ToastProvider>
          <AppNavigator />
          <PromptModalHost />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
