import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './theme';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import MealsScreen from './screens/MealsScreen';
import AddMealScreen from './screens/AddMealScreen';
import MealDetailScreen from './screens/MealDetailScreen';
import WorkoutsScreen from './screens/WorkoutsScreen';
import AddWorkoutScreen from './screens/AddWorkoutScreen';
import WorkoutDetailScreen from './screens/WorkoutDetailScreen';
import ChatScreen from './screens/ChatScreen';
import InsulinCalcScreen from './screens/InsulinCalcScreen';

const Tab = createBottomTabNavigator();
const MealsStack = createNativeStackNavigator();
const WorkoutsStack = createNativeStackNavigator();

const makeStackScreenOptions = (colors) => ({
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerShadowVisible: false,
});

function MealsStackScreen({ userId }) {
  const { colors } = useTheme();
  return (
    <MealsStack.Navigator screenOptions={makeStackScreenOptions(colors)}>
      <MealsStack.Screen name="MealsList" options={{ title: 'Meals' }}>
        {(props) => <MealsScreen {...props} userId={userId} />}
      </MealsStack.Screen>
      <MealsStack.Screen name="AddMeal" options={{ title: 'New Meal' }}>
        {(props) => <AddMealScreen {...props} userId={userId} />}
      </MealsStack.Screen>
      <MealsStack.Screen name="MealDetail" options={{ title: 'Meal Detail' }}>
        {(props) => <MealDetailScreen {...props} userId={userId} />}
      </MealsStack.Screen>
    </MealsStack.Navigator>
  );
}

function WorkoutsStackScreen({ userId }) {
  const { colors } = useTheme();
  return (
    <WorkoutsStack.Navigator screenOptions={makeStackScreenOptions(colors)}>
      <WorkoutsStack.Screen name="WorkoutsList" options={{ title: 'Workouts' }}>
        {(props) => <WorkoutsScreen {...props} userId={userId} />}
      </WorkoutsStack.Screen>
      <WorkoutsStack.Screen name="AddWorkout" options={{ title: 'New Workout' }}>
        {(props) => <AddWorkoutScreen {...props} userId={userId} />}
      </WorkoutsStack.Screen>
      <WorkoutsStack.Screen name="WorkoutDetail" options={{ title: 'Workout Detail' }}>
        {(props) => <WorkoutDetailScreen {...props} userId={userId} />}
      </WorkoutsStack.Screen>
    </WorkoutsStack.Navigator>
  );
}

function AppInner() {
  const { colors } = useTheme();
  const [userId, setUserId] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((stored) => {
      setUserId(stored);
      setChecking(false);
    });
  }, []);

  const logOut = async () => {
    await AsyncStorage.removeItem('userId');
    setUserId(null);
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!userId) {
    return <LoginScreen onLoggedIn={setUserId} />;
  }

  return (
    <NavigationContainer
      theme={{
        ...(colors.mode === 'dark' ? DarkTheme : DefaultTheme), // keeps the fonts object React Navigation 7 needs
        colors: {
          primary: colors.accent,
          background: colors.bg,
          card: colors.bg,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
      }}
    >
      <StatusBar style={colors.mode === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accentText,
          tabBarInactiveTintColor: colors.faint,
        }}
      >
        <Tab.Screen name="Dashboard">{() => <DashboardScreen userId={userId} onLogOut={logOut} />}</Tab.Screen>
        <Tab.Screen name="Meals">{() => <MealsStackScreen userId={userId} />}</Tab.Screen>
        <Tab.Screen name="Workouts">{() => <WorkoutsStackScreen userId={userId} />}</Tab.Screen>
        <Tab.Screen name="Assistant">{() => <ChatScreen userId={userId} />}</Tab.Screen>
        <Tab.Screen name="Insulin Calc" component={InsulinCalcScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
