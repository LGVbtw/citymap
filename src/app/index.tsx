import { Redirect } from 'expo-router';

// Route "/" : redirige toujours vers la carte
export default function Index() {
  return <Redirect href="/map" />;
}
