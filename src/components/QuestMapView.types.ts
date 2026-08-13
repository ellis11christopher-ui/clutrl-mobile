import type { StyleProp, ViewStyle } from 'react-native';

export type QuestMapViewProps = {
  venueLatitude: number;
  venueLongitude: number;
  playRadiusMeters: number;
  /** Null until this chapter's placement has been resolved. */
  pinLatitude?: number | null;
  pinLongitude?: number | null;
  style?: StyleProp<ViewStyle>;
};
