import { inspections, roadImages } from "@/mock-data/images";
import { roads } from "@/mock-data/roads";
import { rhiBand } from "@/lib/rhi";
import type { AreaFilter, Inspection, Road, RoadFeatureProps, RoadImage } from "@/types";

export const roadsService = {
  async getRoads(filter?: AreaFilter): Promise<Road[]> {
    let result = [...roads];
    if (filter?.stateId) {
      result = result.filter((r) => r.stateId === filter.stateId);
    }
    if (filter?.districtId) {
      result = result.filter((r) => r.districtId === filter.districtId);
    }
    if (filter?.cityId) {
      result = result.filter((r) => r.cityId === filter.cityId);
    }
    return result;
  },

  async getRoadById(id: string): Promise<Road | undefined> {
    return roads.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase());
  },

  async getRoadsMapGeoJSON(
    filter?: AreaFilter
  ): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString, RoadFeatureProps>> {
    const list = await this.getRoads(filter);
    const features: GeoJSON.Feature<GeoJSON.LineString, RoadFeatureProps>[] = list.map((road) => ({
      type: "Feature",
      id: road.id,
      properties: {
        id: road.id,
        code: road.code,
        name: road.name,
        rhi: road.rhi,
        band: rhiBand(road.rhi),
        priority: road.priority,
        defectCount: road.defectCount,
        cityId: road.cityId,
      },
      geometry: road.geometry,
    }));

    return {
      type: "FeatureCollection",
      features,
    };
  },

  async getRoadImages(roadId?: string): Promise<RoadImage[]> {
    if (!roadId) return roadImages;
    return roadImages.filter((img) => img.roadId === roadId);
  },

  async getInspections(roadId?: string): Promise<Inspection[]> {
    if (!roadId) return inspections;
    return inspections.filter((ins) => ins.roadId === roadId);
  },
};
