import { requireNativeComponent, type ViewProps } from 'react-native';

export interface GlassNativeProps extends ViewProps {
  lensRadius?: number;
  lensStrength?: number;
}

// RN's Fabric interop registers the application-local ViewGroupManager.
export default requireNativeComponent<GlassNativeProps>('GapGlassView');
