const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

// Path to PNG files directory
const pngDir = 'E:\\Users\\adamosk\\Downloads\\hcalculator-logo';
// Output path for ICO file
const outPath = path.join(__dirname, 'assets', 'hcalculator-logo.ico');
// Path for the resized PNG
const resizedPngPath = path.join(__dirname, 'assets', 'hcalculator-logo-256.png');

// Ensure the assets directory exists
if (!fs.existsSync(path.join(__dirname, 'assets'))) {
    fs.mkdirSync(path.join(__dirname, 'assets'), { recursive: true });
}

// Install Sharp if needed
try {
    require.resolve('sharp');
} catch (err) {
    console.log('Installing Sharp for image resizing...');
    require('child_process').execSync('npm install --save-dev sharp');
}

// Get all PNG files from the directory
let pngFiles = fs.readdirSync(pngDir)
    .filter(file => file.toLowerCase().endsWith('.png'))
    .map(file => path.join(pngDir, file));

if (pngFiles.length === 0) {
    console.error('No PNG files found in the directory!');
    process.exit(1);
}

console.log(`Found ${pngFiles.length} PNG files to convert`);

// Find the largest PNG
const largestPng = pngFiles.reduce((largest, file) => {
    const filename = path.basename(file);
    const match = filename.match(/(\d+)\.png$/);
    if (match) {
        const size = parseInt(match[1]);
        if (!largest || size > largest.size) {
            return { file, size };
        }
    }
    return largest;
}, null);

if (!largestPng) {
    console.error('Could not determine the largest PNG file.');
    process.exit(1);
}

console.log(`Largest PNG: ${largestPng.file} (${largestPng.size}x${largestPng.size})`);

// Resize the largest PNG to 256x256
sharp(largestPng.file)
    .resize(256, 256)
    .toFile(resizedPngPath)
    .then(() => {
        console.log(`Created resized 256x256 PNG at: ${resizedPngPath}`);

        // Add the 256x256 image to our files array
        pngFiles.push(resizedPngPath);

        // Convert all PNGs to ICO
        return pngToIco(pngFiles);
    })
    .then(buf => {
        // Write the ICO file
        fs.writeFileSync(outPath, buf);
        console.log(`Successfully created ICO file at: ${outPath}`);
    })
    .catch(err => {
        console.error('Error:', err);
    }); 