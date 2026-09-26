import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import MealsScreen from './screens/MealsScreen';
import AddMealScreen from './screens/AddMealScreen';
import MealDetailScreen from './screens/MealDetailScreen';
import WorkoutsScreen from './screens/WorkoutsScreen';
import AddWorkoutScreen from './screens/AddWorkoutScreen';
import WorkoutDetailScreen from './screens/WorkoutDetailScreen';
import InsulinCalcScreen from './screens/InsulinCalcScreen';

const Tab = createBottomTabNavigator();
const MealsStack = createNativeStackNavigator();
const WorkoutsStack = createNativeStackNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#0f172a' },
  headerTintColor: 'white',
  headerShadowVisible: false,
};

function MealsStackScreen({ userId }) {
  return (
    <MealsStack.Navigator screenOptions={stackScreenOptions}>
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
  return (
    <WorkoutsStack.Navigator screenOptions={stackScreenOptions}>
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

export default function App() {
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
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!userId) {
    return <LoginScreen onLoggedIn={setUserId} />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
          tabBarActiveTintColor: '#22c55e',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        <Tab.Screen name="Dashboard">{() => <DashboardScreen userId={userId} onLogOut={logOut} />}</Tab.Screen>
        <Tab.Screen name="Meals">{() => <MealsStackScreen userId={userId} />}</Tab.Screen>
        <Tab.Screen name="Workouts">{() => <WorkoutsStackScreen userId={userId} />}</Tab.Screen>
        <Tab.Screen name="Insulin Calc" component={InsulinCalcScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
