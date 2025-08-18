// Test Plus codes for Google Maps compatibility
const { OpenLocationCode } = require('open-location-code');

const olc = new OpenLocationCode();

console.log('=== Plus Code Google Maps Test ===\n');

// Test coordinates from your result
const yourCoords = [15.123187, 120.603187];
console.log('Your location coordinates:', yourCoords);
console.log('Standard Plus Code:', olc.encode(yourCoords[0], yourCoords[1], 10));
console.log('Higher Precision Plus Code:', olc.encode(yourCoords[0], yourCoords[1], 11));

console.log('\nGoogle Maps URLs to test:');
console.log('Standard:', `https://maps.google.com/maps?q=${olc.encode(yourCoords[0], yourCoords[1], 10)}`);
console.log('Higher Precision:', `https://maps.google.com/maps?q=${olc.encode(yourCoords[0], yourCoords[1], 11)}`);

console.log('\n=== Manila Test (Known Good Location) ===');
const manilaCoords = [14.5995, 120.9842];
console.log('Manila coordinates:', manilaCoords);
console.log('Standard Plus Code:', olc.encode(manilaCoords[0], manilaCoords[1], 10));
console.log('Higher Precision Plus Code:', olc.encode(manilaCoords[0], manilaCoords[1], 11));

console.log('\nGoogle Maps URLs for Manila:');
console.log('Standard:', `https://maps.google.com/maps?q=${olc.encode(manilaCoords[0], manilaCoords[1], 10)}`);
console.log('Higher Precision:', `https://maps.google.com/maps?q=${olc.encode(manilaCoords[0], manilaCoords[1], 11)}`);

console.log('\n=== Testing Instructions ===');
console.log('1. Copy any of the Google Maps URLs above');
console.log('2. Paste them in your browser');
console.log('3. The map should show the exact location');
console.log('4. You can also search directly in Google Maps by just typing the Plus code');