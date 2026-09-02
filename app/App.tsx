import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initStorage } from './src/storage/kv';
import { connectAutoLaunchProfiles } from './src/mqtt/connectionManager';
import { startAppLifecycleWatcher } from './src/mqtt/appLifecycle';
import { AppNavigator } from './src/app/navigation';
import { SplashScreen } from './src/app/SplashScreen';
import { ToastProvider } from './src/ui/Toast';
import { PromptModalHost } from './src/ui/PromptModal';

function App() {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initStorage().then(() => {
      connectAutoLaunchProfiles();
      startAppLifecycleWatcher();
      setReady(true);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        {ready && (
          <ToastProvider>
            <AppNavigator />
            <PromptModalHost />
          </ToastProvider>
        )}
        {showSplash && (
          <SplashScreen
            exiting={ready}
            onFinished={() => setShowSplash(false)}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
