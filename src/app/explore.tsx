import { Redirect } from 'expo-router';

// Route "/explore" (héritée du template) : redirige vers la racine
export default function ExploreScreen() {
  return <Redirect href="/" />;
}
