import React from 'react';
import {
  NavigationContainer,
  DarkTheme,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../ui/theme';
import { HubScreen } from '../features/hub/HubScreen';
import { WorkspaceScreen } from '../features/workspace/WorkspaceScreen';
import { ProfileFormScreen } from '../features/profile/ProfileFormScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { BrokersScreen } from '../features/brokers/BrokersScreen';
import { BrokerFormScreen } from '../features/brokers/BrokerFormScreen';
import { ExportPickerScreen } from '../features/backup/ExportPickerScreen';
import { ImportScreen } from '../features/backup/ImportScreen';

export type RootStackParamList = {
  Hub: undefined;
  Workspace: { profileId: string };
  ProfileForm: { profileId?: string };
  Settings: undefined;
  Brokers: undefined;
  BrokerForm: { brokerId?: string };
  ExportPicker: undefined;
  Import: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.hairline,
    primary: colors.accent,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Hub" component={HubScreen} />
        <Stack.Screen name="Workspace" component={WorkspaceScreen} />
        <Stack.Screen
          name="ProfileForm"
          component={ProfileFormScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="Brokers"
          component={BrokersScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="BrokerForm"
          component={BrokerFormScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="ExportPicker"
          component={ExportPickerScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="Import"
          component={ImportScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
