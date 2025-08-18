declare module 'open-location-code' {
  export interface CodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    codeLength: number;
    latitudeCenter: number;
    longitudeCenter: number;
  }

  export class OpenLocationCode {
    constructor();
    
    encode(latitude: number, longitude: number, codeLength?: number): string;
    decode(code: string): CodeArea;
    isValid(code: string): boolean;
    isShort(code: string): boolean;
    isFull(code: string): boolean;
    recoverNearest(shortCode: string, latitude: number, longitude: number): string;
    shorten(code: string, latitude: number, longitude: number): string;
  }

  export { OpenLocationCode as default };
}