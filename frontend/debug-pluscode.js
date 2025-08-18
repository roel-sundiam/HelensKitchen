// Debug Plus Code validation
console.log('Testing individual parts:');

const validChars = '[23456789CFGHJMPQRVWX]';
const testString = '7Q63G5J5+XY';

console.log('Test string:', testString);
console.log('Length:', testString.length);
console.log('Parts:');
console.log('  Before +:', testString.split('+')[0], 'Length:', testString.split('+')[0].length);
console.log('  After +:', testString.split('+')[1], 'Length:', testString.split('+')[1].length);

// Test the character class
const charPattern = /^[23456789CFGHJMPQRVWX]+$/i;
console.log('');
console.log('Character validation:');
console.log('  "7Q63G5J5" matches chars:', charPattern.test('7Q63G5J5'));
console.log('  "XY" matches chars:', charPattern.test('XY'));

// Test length requirements
console.log('');
console.log('Length validation:');
console.log('  Before + (8 chars):', /^[23456789CFGHJMPQRVWX]{4,8}$/i.test('7Q63G5J5'));
console.log('  After + (2 chars):', /^[23456789CFGHJMPQRVWX]{2,3}$/i.test('XY'));

// Full pattern breakdown
console.log('');
console.log('Full pattern test:');
const fullPattern = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;
console.log('Pattern:', fullPattern.toString());
console.log('Test result:', fullPattern.test(testString));
