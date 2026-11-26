import { registerRootComponent } from 'expo';
import { initNativeLiveKitIfAvailable } from './src/utils/nativeLiveKit';
import App from './app/App';

// Register native C++ WebRTC globals before React mounts when running in APK / EAS build.
// Safely skipped inside Expo Go.
initNativeLiveKitIfAvailable();

registerRootComponent(App);
