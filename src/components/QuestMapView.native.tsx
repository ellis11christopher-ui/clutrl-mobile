import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, radii } from '../theme';
import type { QuestMapViewProps } from './QuestMapView.types';

// Real map for device builds. The web build resolves QuestMapView.web.tsx
// instead, because react-native-maps has no web implementation.
export function QuestMapView({
  venueLatitude,
  venueLongitude,
  playRadiusMeters,
  pinLatitude,
  pinLongitude,
  style,
}: QuestMapViewProps) {
  // Frame the whole play area with a little margin. 111320 m per degree of
  // latitude is close enough at the scale of a single park.
  const latitudeDelta = ((playRadiusMeters * 2.6) / 111320) || 0.01;

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: pinLatitude ?? venueLatitude,
          longitude: pinLongitude ?? venueLongitude,
          latitudeDelta,
          longitudeDelta: latitudeDelta,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <Circle
          center={{ latitude: venueLatitude, longitude: venueLongitude }}
          radius={playRadiusMeters}
          strokeColor={colors.lime}
          strokeWidth={2}
          fillColor="rgba(200, 255, 0, 0.12)"
        />
        {pinLatitude != null && pinLongitude != null ? (
          <Marker
            coordinate={{ latitude: pinLatitude, longitude: pinLongitude }}
            pinColor="red"
            title="Your target"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
  },
});
