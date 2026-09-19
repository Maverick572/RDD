/**
 * Mock administrative boundaries. State outlines are simplified hand-drawn
 * polygons; district and city outlines are derived from their bounding boxes.
 * Replace with real GeoJSON (e.g. from datameet/maps) when available.
 */
import type { Bounds } from "@/types";

export const stateOutlines: Record<string, [number, number][]> = {
  // [lng, lat] rings (GeoJSON order)
  MH: [[72.65, 20.1], [72.9, 21.2], [74.3, 22.0], [76.4, 21.3], [78.4, 21.6], [80.9, 21.5], [80.5, 19.6], [79.0, 18.9], [77.8, 17.9], [76.6, 17.3], [76.2, 15.7], [74.3, 15.7], [73.4, 17.5], [72.7, 19.0]],
  KA: [[74.1, 14.8], [74.5, 16.3], [75.6, 18.4], [77.4, 18.3], [78.6, 15.6], [77.9, 13.4], [78.3, 12.6], [77.5, 11.7], [76.4, 11.7], [75.2, 12.4], [74.3, 13.6]],
  TN: [[76.8, 8.3], [77.6, 8.1], [78.2, 8.9], [79.4, 10.3], [80.3, 12.3], [80.3, 13.6], [79.2, 13.4], [78.3, 12.6], [77.5, 11.7], [76.4, 11.6], [77.1, 10.1], [76.5, 9.0]],
  DL: [[76.85, 28.42], [77.1, 28.4], [77.35, 28.5], [77.33, 28.88], [77.0, 28.9], [76.85, 28.7]],
  GJ: [[68.2, 23.7], [69.6, 24.4], [71.1, 24.7], [73.4, 24.5], [74.4, 23.0], [73.4, 21.2], [72.9, 20.1], [72.6, 21.3], [70.2, 20.7], [69.0, 22.3]],
};

export function boundsToRing(b: Bounds): [number, number][] {
  const [[s, w], [n, e]] = b;
  return [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ];
}
