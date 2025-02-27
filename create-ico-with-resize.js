const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');
const Jimp = require('jimp/dist/jimp.js');

// Path to PNG files directory
const pngDir = 'E:\\Users\\adamosk\\Downloads\\hcalculator-logo';
// Output path for ICO file
const outPath = path.join(__dirname, 'assets', 'hcalculator-logo.ico');

// Get all PNG files from the directory
let pngFiles = fs.readdirSync(pngDir)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .map(file => path.join(pngDir, file));

if (pngFiles.length === 0) {
    console.error('No PNG files found in the directory!');
    process.exit(1);
}

console.log(`Found ${pngFiles.length} PNG files to convert`);
pngFiles.forEach(file => console.log(`- ${file}`));

// Find the largest PNG file
let largestPng = '';
let largestSize = 0;

for (const file of pngFiles) {
    const filename = path.basename(file);
    const match = filename.match(/(\d+)\.png$/);
    if (match && parseInt(match[1]) > largestSize) {
        largestSize = parseInt(match[1]);
        largestPng = file;
    }
}

console.log(`Largest PNG: ${largestPng} (${largestSize}x${largestSize})`);

// Create a resized 256x256 version
const resizedPngPath = path.join(__dirname, 'assets', 'hcalculator-logo-256.png');

// Ensure the assets directory exists
if (!fs.existsSync(path.join(__dirname, 'assets'))) {
    fs.mkdirSync(path.join(__dirname, 'assets'), { recursive: true });
}

// First install Jimp package using npm
console.log('Installing Jimp for image resizing...');
require('child_process').execSync('npm install --save-dev jimp');

async function resizeAndCreateIco() {
    try {
        // Load the largest image
        console.log('Reading the largest PNG...');
        const image = await Jimp.read(largestPng);
        
        // Resize it to 256x256 with high quality
        console.log('Resizing to 256x256...');
        await image.resize(256, 256, Jimp.RESIZE_BICUBIC);
        
        // Save the resized image
        console.log('Saving the resized image...');
        await image.writeAsync(resizedPngPath);
        console.log(`Created resized 256x256 PNG at: ${resizedPngPath}`);
        
        // Add the 256x256 image to our files array
        pngFiles.push(resizedPngPath);
        
        // Convert PNG files to ICO
        console.log('Converting PNGs to ICO...');
        const buffer = await pngToIco(pngFiles);
        
        // Write the ICO file
        fs.writeFileSync(outPath, buffer);
        console.log(`Successfully created ICO file at: ${outPath}`);
    } catch (err) {
        console.error('Error creating ICO file:', err);
    }
}

resizeAndCreateIco(); 