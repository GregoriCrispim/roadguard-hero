import "leaflet";

declare module "leaflet" {
  function heatLayer(
    latlngs: [number, number, number?][],
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      gradient?: Record<number, string>;
    },
  ): Layer;
}

declare module "leaflet" {
  namespace heatLayer {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class HeatLayer extends Layer {}
  }
}
