// Test the official Open Location Code implementation
const { OpenLocationCode } = require('open-location-code');

// Test coordinates
const testCoords = [
  { lat: 14.5995, lng: 120.9842, name: "Manila" },
  { lat: 10.3157, lng: 123.8854, name: "Cebu" },
  { lat: 47.365590, lng: 8.524997, name: "Switzerland" }
];

console.log('Testing with official Google Open Location Code library:');
console.log('');

// Create an instance of the OpenLocationCode class
const olc = new OpenLocationCode();

testCoords.forEach(coord => {
  const plusCode = olc.encode(coord.lat, coord.lng);
  console.log(`${coord.name}: ${plusCode} (${coord.lat}, ${coord.lng})`);
  
  // Test if we can decode it back
  const decoded = olc.decode(plusCode);
  console.log(`  Decoded center: ${decoded.latitudeCenter}, ${decoded.longitudeCenter}`);
  console.log(`  Area: ${decoded.latitudeLo}-${decoded.latitudeHi}, ${decoded.longitudeLo}-${decoded.longitudeHi}`);
  console.log('');
});

// Test the specific code that was problematic
console.log('Testing problematic code: 7Q4J77X8+Q5');
try {
  const decoded = olc.decode('7Q4J77X8+Q5');
  console.log('Successfully decoded:');
  console.log(`  Center: ${decoded.latitudeCenter}, ${decoded.longitudeCenter}`);
  console.log(`  Area: ${decoded.latitudeLo}-${decoded.latitudeHi}, ${decoded.longitudeLo}-${decoded.longitudeHi}`);
  console.log('Note: This location appears to be in a remote ocean area, not a valid land location.');
} catch (error) {
  console.log('Error decoding:', error.message);
}

// Generate and test a Philippines location
const manilaCode = olc.encode(14.5995, 120.9842);
console.log(`\nManila Plus Code: ${manilaCode}`);
console.log('This code should work in Google Maps!');