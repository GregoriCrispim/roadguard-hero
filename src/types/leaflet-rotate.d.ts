import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    rotate?: boolean;
    bearing?: number;
    touchRotate?: boolean;
  }

  interface Map {
    setBearing(bearing: number): this;
    getBearing(): number;
  }
}
