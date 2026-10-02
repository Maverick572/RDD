import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

interface LocateMapAtCurrentPositionProps {
  zoom?: number;
  onLocated?: (location: { latitude: number; longitude: number }) => void;
}

export function LocateMapAtCurrentPosition({
  zoom,
  onLocated,
}: LocateMapAtCurrentPositionProps) {
  const map = useMap();
  const onLocatedRef = useRef(onLocated);
  onLocatedRef.current = onLocated;

  useEffect(() => {
    if (!navigator.geolocation) return;

    let active = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!active) return;
        const { latitude, longitude } = coords;
        map.setView([latitude, longitude], zoom ?? map.getZoom());
        onLocatedRef.current?.({ latitude, longitude });
      },
      () => {
        // Keep the map's existing fallback center when location is unavailable.
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );

    return () => {
      active = false;
    };
  }, [map, zoom]);

  return null;
}
